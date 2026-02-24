import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  MacroIndicator,
  SectorSnapshot,
  CryptoMetric,
  CategorySnapshot,
} from "../../../lib/types";

interface ReportRequestBody {
  indicators: MacroIndicator[];
  sectors: SectorSnapshot[];
  cryptoMetrics: CryptoMetric[];
  categories: CategorySnapshot[];
}

function buildPrompt(body: ReportRequestBody): string {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [
    `You are a senior macro research analyst. Generate a professional investment research report based on the live data below.`,
    `Report date: ${date}`,
    ``,
    `## Structure your report as follows:`,
    `1. **BOTTOM LINE UP FRONT** — 3-4 sentence executive summary of the current environment`,
    `2. **Macro Environment** — key signals, tensions, and regime analysis`,
    `3. **Crypto Market** — on-chain signals, sentiment, and category analysis`,
    `4. **Cross-Market Synthesis** — how macro and crypto interact right now`,
    `5. **Investment Ideas** — 3-5 specific actionable ideas. For each idea include:`,
    `   - A primary single-stock ticker (e.g. JPM, DHI, COIN) as the lead — not just an ETF`,
    `   - The macro/crypto driver from the data that supports the thesis`,
    `   - A specific price target or % upside estimate`,
    `   - The key risk in one sentence`,
    `   - Alternative expression (ETF or second ticker) if relevant`,
    ``,
    `Be direct and quantitative. Use the actual numbers from the data. Name specific companies, not just sectors. BLUF first, details after.`,
    `---`,
  ];

  if (body.indicators.length > 0) {
    lines.push(`\n## MACRO INDICATORS\n`);
    lines.push(`| Series | Value | Delta | Signal | 52w Pctile |`);
    lines.push(`|--------|-------|-------|--------|-----------|`);
    for (const ind of body.indicators) {
      const delta =
        ind.periodDelta !== null
          ? `${ind.periodDelta > 0 ? "+" : ""}${ind.periodDelta.toFixed(3)}`
          : "n/a";
      const pctile =
        ind.yearPercentile !== null
          ? `${(ind.yearPercentile * 100).toFixed(0)}th`
          : "n/a";
      lines.push(
        `| ${ind.seriesId} (${ind.name}) | ${ind.latestValue} ${ind.unit} | ${delta} | ${ind.signal} | ${pctile} |`
      );
    }
    const regime = body.sectors[0]?.macroRegime ?? "UNKNOWN";
    lines.push(`\n**Inferred Macro Regime: ${regime}**`);
  }

  if (body.sectors.length > 0) {
    lines.push(`\n## SECTOR SNAPSHOTS\n`);
    lines.push(`| Ticker | Sector | Signal | YTD | RS vs SPY |`);
    lines.push(`|--------|--------|--------|-----|-----------|`);
    for (const s of body.sectors) {
      const ytd =
        s.ytdChangePct !== null
          ? `${s.ytdChangePct > 0 ? "+" : ""}${s.ytdChangePct.toFixed(2)}%`
          : "n/a";
      const rs =
        s.relativeStrengthVsSPY !== null
          ? `${s.relativeStrengthVsSPY > 0 ? "+" : ""}${s.relativeStrengthVsSPY.toFixed(2)}%`
          : "n/a";
      lines.push(
        `| ${s.sectorTicker} | ${s.sectorName} | ${s.sectorSignal} | ${ytd} | ${rs} |`
      );
    }
  }

  if (body.cryptoMetrics.length > 0) {
    lines.push(`\n## CRYPTO METRICS\n`);
    lines.push(`| Metric | Value | Delta % | Signal |`);
    lines.push(`|--------|-------|---------|--------|`);
    for (const m of body.cryptoMetrics) {
      const val =
        m.unit === "USD"
          ? `$${(m.latestValue / 1e9).toFixed(2)}B`
          : `${m.latestValue.toFixed(2)}${m.unit === "%" ? "%" : ""}`;
      const delta =
        m.periodDeltaPct !== null
          ? `${m.periodDeltaPct > 0 ? "+" : ""}${m.periodDeltaPct.toFixed(2)}%`
          : "n/a";
      lines.push(`| ${m.name} | ${val} | ${delta} | ${m.signal} |`);
    }
    lines.push(`\n**Signal Rationales:**`);
    for (const m of body.cryptoMetrics) {
      lines.push(`- **${m.name}**: ${m.signalRationale}`);
    }
  }

  if (body.categories.length > 0) {
    lines.push(`\n## CRYPTO CATEGORIES\n`);
    lines.push(`| Category | Market Cap | Dominance | Signal |`);
    lines.push(`|----------|------------|-----------|--------|`);
    for (const c of body.categories) {
      const mc = c.totalMarketCapUsd
        ? `$${(c.totalMarketCapUsd / 1e9).toFixed(0)}B`
        : "n/a";
      lines.push(
        `| ${c.categoryName} | ${mc} | ${c.dominancePct?.toFixed(1)}% | ${c.categorySignal} |`
      );
    }
    const regime = body.categories[0]?.cryptoRegime ?? "UNKNOWN";
    lines.push(`\n**Inferred Crypto Regime: ${regime}**`);
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  let body: ReportRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const prompt = buildPrompt(body);
  const anthropic = new Anthropic({ apiKey });

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
