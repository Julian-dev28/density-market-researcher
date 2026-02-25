/**
 * Research Note Quality Scorer
 *
 * Evaluates agent-generated research notes on four dimensions using the
 * CryptoAnalystBench evaluation framework from Sentient.
 *
 * Judge model: Deepseek-v3.1-671B via Fireworks AI — the same model used
 * by CryptoAnalystBench (https://github.com/sentient-agi/CryptoAnalystBench).
 * Falls back to Claude Haiku if FIREWORKS_API_KEY is not set.
 *
 * Dimensions (each scored 1-10):
 *   Relevance         — analysis directly addresses the identified regime with evidence
 *   Depth             — specific data values cited, implications fully explored
 *   Temporal Accuracy — data is current, time references specific, staleness flagged
 *   Data Consistency  — internally consistent, no contradictions, ideas follow regime
 */

import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import type { ResearchNote } from "./tools.js";

export interface QualityScores {
  relevance: number;
  depth: number;
  temporalAccuracy: number;
  dataConsistency: number;
  overall: number; // average of the four, rounded to 1dp
}

// Matches CryptoAnalystBench's judge prompt dimensions exactly
const JUDGE_PROMPT = `You are a financial research quality evaluator. Score the AI-generated macro research note on four dimensions (1-10 each):

1. **Relevance** (1-10): Does the analysis directly address the macro regime? Are investment ideas connected to the data? Low = generic advice. High = specific regime-matched thesis.

2. **Depth** (1-10): Are specific values cited (e.g., "T10Y2Y at 0.14%", "UMCSENT -29% over 22 months", "XLF -7.65% YTD")? Are second-order implications explored? Low = surface-level. High = multiple confirming indicators with exact numbers.

3. **Temporal Accuracy** (1-10): Is the data current? Are dates specific and recent? Does the note flag when data may be stale? Low = vague or potentially outdated. High = timestamps on all key data points.

4. **Data Consistency** (1-10): Are claims internally consistent? Do investment ideas follow from the stated findings? Any contradictions between regime call and ideas? Low = contradictory. High = every idea is logically derived from cited data.

Respond with ONLY valid JSON, nothing else:
{"relevance": <1-10>, "depth": <1-10>, "temporal_accuracy": <1-10>, "data_consistency": <1-10>}`;

function formatNoteForScoring(note: ResearchNote): string {
  return [
    `Title: ${note.title}`,
    `Regime: ${note.macroRegime} | Confidence: ${note.confidence} | Conviction: ${note.convictionScore}/10`,
    `\nSummary:\n${note.summary}`,
    `\nKey Findings:\n${note.keyFindings.map((f) => `- ${f}`).join("\n")}`,
    `\nAnomalies:\n${note.anomalies.map((a) => `- ${a.indicator}: ${a.observation} → ${a.implication}`).join("\n")}`,
    `\nInvestment Ideas:\n${note.investmentIdeas.map((i) => `- ${i.direction} ${i.ticker}: ${i.thesis} (catalyst: ${i.catalyst}; risk: ${i.keyRisk})`).join("\n")}`,
  ].join("\n");
}

function parseScores(text: string): QualityScores | null {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const relevance        = clamp(Number(parsed.relevance));
  const depth            = clamp(Number(parsed.depth));
  const temporalAccuracy = clamp(Number(parsed.temporal_accuracy));
  const dataConsistency  = clamp(Number(parsed.data_consistency));
  const overall = Math.round(((relevance + depth + temporalAccuracy + dataConsistency) / 4) * 10) / 10;
  return { relevance, depth, temporalAccuracy, dataConsistency, overall };
}

// ---------------------------------------------------------------------------
// Primary judge: Deepseek-v3.1-671B via Fireworks AI
// This is the exact model CryptoAnalystBench uses for evaluation.
// ---------------------------------------------------------------------------

async function scoreWithFireworks(note: ResearchNote): Promise<QualityScores | null> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) return null;

  const response = await axios.post(
    "https://api.fireworks.ai/inference/v1/chat/completions",
    {
      model: "accounts/fireworks/models/deepseek-v3p1",
      max_tokens: 150,
      temperature: 0.1,
      messages: [
        { role: "system", content: JUDGE_PROMPT },
        { role: "user",   content: formatNoteForScoring(note) },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 20_000,
    }
  );

  const text: string = response.data?.choices?.[0]?.message?.content?.trim() ?? "";
  return parseScores(text);
}

// ---------------------------------------------------------------------------
// Fallback judge: Claude Haiku (if no FIREWORKS_API_KEY)
// ---------------------------------------------------------------------------

async function scoreWithClaude(note: ResearchNote): Promise<QualityScores | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: JUDGE_PROMPT,
    messages: [{ role: "user", content: formatNoteForScoring(note) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return parseScores(text);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scoreResearchNote(note: ResearchNote): Promise<QualityScores | null> {
  try {
    // Try Fireworks (CryptoAnalystBench judge) first
    const fireworksResult = await scoreWithFireworks(note);
    if (fireworksResult) return fireworksResult;

    // Fall back to Claude Haiku
    return await scoreWithClaude(note);
  } catch {
    return null; // scoring is non-critical — never block the research note
  }
}

function clamp(n: number): number {
  if (isNaN(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}
