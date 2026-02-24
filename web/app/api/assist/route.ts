/**
 * Sentient Agent Framework — /api/assist
 *
 * Implements the Sentient Chat SSE protocol so this agent is discoverable
 * and queryable from the Sentient ecosystem.
 *
 * Protocol:
 *   POST /api/assist  { query: string, session?: { processor_id?: string } }
 *   → text/event-stream
 *
 * Event types (Sentient Agent Framework spec):
 *   TextChunkEvent  — streaming text chunk
 *   DoneEvent       — signals end of response
 *   ErrorEvent      — error with code + message
 *
 * SSE format:
 *   event: TextChunkEvent
 *   data: {"schema_version":"1.0","id":"...","source":"...","content_type":"TEXT_STREAM",...}
 *
 *   event: DoneEvent
 *   data: {"schema_version":"1.0","id":"...","source":"...","content_type":"DONE","event_name":"done"}
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const SOURCE = "macro-research-agent";

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 26);
}

function sse(eventType: string, payload: object): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function chunkEvent(streamId: string, content: string, isComplete = false) {
  return sse("TextChunkEvent", {
    schema_version: "1.0",
    id: makeId(),
    source: SOURCE,
    content_type: "TEXT_STREAM",
    stream_id: streamId,
    is_complete: isComplete,
    content,
  });
}

function doneEvent() {
  return sse("DoneEvent", {
    schema_version: "1.0",
    id: makeId(),
    source: SOURCE,
    content_type: "DONE",
    event_name: "done",
  });
}

function errorEvent(message: string, code = 500) {
  return sse("ErrorEvent", {
    schema_version: "1.0",
    id: makeId(),
    source: SOURCE,
    content_type: "ERROR",
    event_name: "error",
    content: { error_message: message, error_code: code },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
};

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? body.message ?? "";

  if (!query.trim()) {
    return new Response(
      errorEvent("No query provided.", 400) + doneEvent(),
      { headers: SSE_HEADERS }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      errorEvent("Agent not configured — ANTHROPIC_API_KEY missing.", 503) + doneEvent(),
      { headers: SSE_HEADERS }
    );
  }

  // Load recent research findings as context
  let context = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("agent_findings")
      .select("title, macro_regime, conviction_score, summary, run_at")
      .order("run_at", { ascending: false })
      .limit(3);

    if (data?.length) {
      context =
        "\n\nMost recent research from the live pipeline:\n" +
        data
          .map(
            (f) =>
              `• [${f.run_at?.slice(0, 10)} | ${f.macro_regime} | conviction ${f.conviction_score}/10]\n` +
              `  ${f.title}\n  ${f.summary}`
          )
          .join("\n\n");
    }
  } catch {
    // No DB available — still respond with general knowledge
  }

  const system =
    "You are a live macro and crypto research agent backed by real economic data. " +
    "You analyze Federal Reserve policy, yield curves, sector ETF rotation, crypto market structure, " +
    "and their interplay. Responses are precise, data-driven, and actionable — cite specific " +
    "indicators and exact values when available. Keep responses focused and under 400 words." +
    context;

  const streamId = makeId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const resp = await fetch(ANTHROPIC_API, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            stream: true,
            system,
            messages: [{ role: "user", content: query }],
          }),
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`Anthropic API ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const ev = JSON.parse(raw);
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                controller.enqueue(
                  encoder.encode(chunkEvent(streamId, ev.delta.text))
                );
              }
            } catch { /* skip malformed lines */ }
          }
        }

        controller.enqueue(encoder.encode(chunkEvent(streamId, "", true)));
        controller.enqueue(encoder.encode(doneEvent()));
      } catch (err) {
        controller.enqueue(
          encoder.encode(errorEvent(err instanceof Error ? err.message : "Agent error"))
        );
        controller.enqueue(encoder.encode(doneEvent()));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
