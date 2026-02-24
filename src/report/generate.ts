import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { MacroIndicator, SectorSnapshot, CryptoMetric, CategorySnapshot } from "../types/index.js";

// ============================================================
// Report Generator
//
// Pipes pipeline output to Claude Opus 4.6 and writes
// a markdown investment research report to ./reports/
// ============================================================

export interface ReportInput {
  indicators: MacroIndicator[];
  sectors: SectorSnapshot[];
  cryptoMetrics: CryptoMetric[];
  categories: CategorySnapshot[];
  mode: string;
}

function buildPrompt(input: ReportInput): string {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const sections: string[] = [
    `You are a senior macro research analyst. Generate a professional investment research report based on the live data below.`,
    `Report date: ${date}`,
    `Pipeline mode: ${input.mode.toUpperCase()}`,
    ``,
    `## Structure your report as follows:`,
    `1. **BOTTOM LINE UP FRONT** — 3-4 sentence executive summary of the current environment`,
    `2. **Macro Environment** (if macro data present) — key signals, tensions, and regime analysis`,
    `3. **Crypto Market** (if crypto data present) — on-chain signals, sentiment, and category analysis`,
    `4. **Cross-Market Synthesis** (if both present) — how macro and crypto interact right now`,
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

  if (input.indicators.length > 0) {
    sections.push(`\n## MACRO INDICATORS (Live FRED Data)\n`);
    sections.push(`| Series | Value | Delta | Signal | 52w Pctile |`);
    sections.push(`|--------|-------|-------|--------|-----------|`);
    for (const ind of input.indicators) {
      const delta = ind.periodDelta !== null
        ? `${ind.periodDelta > 0 ? "+" : ""}${ind.periodDelta.toFixed(3)} (${ind.periodDeltaPct?.toFixed(2)}%)`
        : "n/a";
      const pctile = ind.yearPercentile !== null
        ? `${(ind.yearPercentile * 100).toFixed(0)}th`
        : "n/a";
      sections.push(`| ${ind.seriesId} (${ind.name}) | ${ind.latestValue} | ${delta} | ${ind.signal} | ${pctile} |`);
    }

    const regime = input.sectors[0]?.macroRegime ?? "UNKNOWN";
    sections.push(`\n**Inferred Macro Regime: ${regime}**`);
  }

  if (input.sectors.length > 0) {
    sections.push(`\n## SECTOR SNAPSHOTS\n`);
    sections.push(`| Ticker | Sector | Signal | YTD | Relative Strength vs SPY |`);
    sections.push(`|--------|--------|--------|-----|--------------------------|`);
    for (const s of input.sectors) {
      const ytd = s.ytdChangePct !== null ? `${s.ytdChangePct > 0 ? "+" : ""}${s.ytdChangePct.toFixed(2)}%` : "n/a";
      const rs = s.relativeStrengthVsSPY !== null ? `${s.relativeStrengthVsSPY > 0 ? "+" : ""}${s.relativeStrengthVsSPY.toFixed(2)}%` : "n/a";
      sections.push(`| ${s.sectorTicker} | ${s.sectorName} | ${s.sectorSignal} | ${ytd} | ${rs} |`);
    }
  }

  if (input.cryptoMetrics.length > 0) {
    sections.push(`\n## CRYPTO METRICS (Live Data)\n`);
    sections.push(`| Metric | Value | Delta | Signal |`);
    sections.push(`|--------|-------|-------|--------|`);
    for (const m of input.cryptoMetrics) {
      const val = m.unit === "USD"
        ? `$${(m.latestValue / 1e9).toFixed(2)}B`
        : `${m.latestValue.toFixed(2)}${m.unit === "%" ? "%" : ""}`;
      const delta = m.periodDeltaPct !== null
        ? `${m.periodDeltaPct > 0 ? "+" : ""}${m.periodDeltaPct.toFixed(2)}%`
        : "n/a";
      sections.push(`| ${m.name} | ${val} | ${delta} | ${m.signal} |`);
    }
    sections.push(`\n**Signal Rationales:**`);
    for (const m of input.cryptoMetrics) {
      sections.push(`- **${m.name}**: ${m.signalRationale}`);
    }
  }

  if (input.categories.length > 0) {
    sections.push(`\n## CRYPTO CATEGORIES\n`);
    sections.push(`| Category | Market Cap | Dominance | Signal |`);
    sections.push(`|----------|------------|-----------|--------|`);
    for (const c of input.categories) {
      const mc = c.totalMarketCapUsd ? `$${(c.totalMarketCapUsd / 1e9).toFixed(0)}B` : "n/a";
      sections.push(`| ${c.categoryName} | ${mc} | ${c.dominancePct?.toFixed(1)}% | ${c.categorySignal} |`);
    }

    const regime = input.categories[0]?.cryptoRegime ?? "UNKNOWN";
    sections.push(`\n**Inferred Crypto Regime: ${regime}**`);
  }

  return sections.join("\n");
}

export async function generateReport(
  input: ReportInput,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const prompt = buildPrompt(input);

  console.log("\n🤖  Generating research report via Claude Opus 4.6...\n");

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  // Stream to stdout so user sees progress
  process.stdout.write("─".repeat(60) + "\n");
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
    }
  }
  process.stdout.write("\n" + "─".repeat(60) + "\n");

  const final = await stream.finalMessage();
  const reportText = final.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Write to ./reports/
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const outDir = "./reports";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `report_${timestamp}.md`);

  const header = [
    `# Macro + Crypto Research Report`,
    `**Generated:** ${new Date().toLocaleString()}`,
    `**Mode:** ${input.mode.toUpperCase()}`,
    `**Model:** claude-opus-4-6`,
    ``,
    "---",
    "",
  ].join("\n");

  writeFileSync(outPath, header + reportText, "utf-8");

  return outPath;
}
