import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  isPaymentEnabled,
  getPaymentRequirements,
  build402Response,
  verifyPaymentHeader,
  buildPaymentResponse,
} from "@/lib/x402";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  // x402 payment gate — only enforced when PAYMENT_ENABLED=true
  if (isPaymentEnabled()) {
    const requirements = getPaymentRequirements(request.url);
    const xPayment = (request as Request & { headers: Headers }).headers.get("x-payment");
    const { valid, error } = verifyPaymentHeader(xPayment, requirements);
    if (!valid) {
      console.log(`[x402] Payment required — ${error ?? "no payment"}`);
      return build402Response(requirements);
    }
    console.log("[x402] Payment verified — serving feed");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_findings")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(50);

  const findings = data ?? [];

  if (format === "rss") {
    const rss = buildRSS(findings, request.url);
    return new Response(rss, {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  }

  const paymentResponseHeaders = isPaymentEnabled() ? buildPaymentResponse() : {};

  return NextResponse.json(
    {
      title: "Macro Research — AI Research Desk",
      description: "Autonomous macro + crypto research. Updates every 6 hours.",
      feedUrl: new URL("/api/feed", request.url).toString(),
      rssUrl: new URL("/api/feed?format=rss", request.url).toString(),
      updatedAt: findings[0]?.run_at ?? null,
      findings: findings.map((f) => ({
        id:              f.finding_id,
        publishedAt:     f.run_at,
        title:           f.title,
        macroRegime:     f.macro_regime,
        confidence:      f.confidence,
        convictionScore: f.conviction_score,
        verificationStatus: f.verification_status,
        summary:         f.summary,
        keyFindings:     safeParseJson(f.key_findings, []),
        anomalies:       safeParseJson(f.anomalies, []),
        investmentIdeas: safeParseJson(f.investment_ideas, []),
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
        ...paymentResponseHeaders,
      },
    },
  );
}

function buildRSS(findings: Record<string, unknown>[], requestUrl: string): string {
  const base = new URL(requestUrl).origin;
  const items = findings
    .map((f) => {
      const keyFindings: string[] = safeParseJson(f.key_findings as string, []);
      const ideas = safeParseJson(f.investment_ideas as string, []) as Array<{ ticker: string; direction: string; thesis: string }>;

      const description = [
        `<b>Regime:</b> ${f.macro_regime} (${f.confidence} confidence, conviction ${f.conviction_score ?? "?"}/10)`,
        ``,
        `<b>Summary:</b> ${f.summary}`,
        ``,
        `<b>Key Findings:</b>`,
        keyFindings.map((k) => `• ${k}`).join("\n"),
        ``,
        ideas.length ? `<b>Investment Ideas:</b> ` + ideas.map((i) => `${i.direction} ${i.ticker}`).join(", ") : "",
      ].filter(Boolean).join("\n");

      return `
    <item>
      <title><![CDATA[${f.title}]]></title>
      <link>${base}/dashboard/research</link>
      <guid isPermaLink="false">${f.finding_id}</guid>
      <pubDate>${new Date(f.run_at as string).toUTCString()}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Macro Research — AI Research Desk</title>
    <link>${base}/dashboard/research</link>
    <description>Autonomous macro + crypto research. Compounds intelligence across runs.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

function safeParseJson<T>(json: unknown, fallback: T): T {
  try { return JSON.parse(json as string) as T; } catch { return fallback; }
}
