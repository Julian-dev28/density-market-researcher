import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import type { Config } from "../config.js";
import {
  AGENT_TOOLS,
  execReadPriorFindings,
  execReadFoundryObjects,
  execFetchFredSeries,
  execWriteResearchNote,
  type ResearchNote,
} from "./tools.js";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an autonomous macro research analyst with direct read/write access to a Postgres database.

The database is your persistent world model. It accumulates intelligence across runs — raw data comes in, gets enriched by the pipeline, and your conclusions from prior runs are stored alongside it. You reason over this accumulated state, not over raw API responses.

The database contains five live tables:

**agent_findings** — conclusions from previous agent runs (YOUR prior memory):
- Fields: runAt, title, macroRegime, confidence, summary, keyFindings[], anomalies[], investmentIdeas[]
- Read this FIRST on every run. Understand what regime was called, what anomalies were flagged,
  and whether those anomalies have since resolved, persisted, or intensified.

**macro_indicators (objectType "Density")** — enriched macro indicator snapshots:
- Fields: name, latestValue, latestDate, unit, priorValue, periodDelta, periodDeltaPct,
  yearLow, yearHigh, yearPercentile (0=52wk low, 1=52wk high), signal (BULLISH/BEARISH/NEUTRAL),
  signalRationale, category, frequency, sourceUrl
- Sources: FRED (GDP, CPI, Core CPI, PPI, Fed Funds, 10Y-2Y Spread, Unemployment,
  Industrial Production, Housing Starts, Consumer Sentiment, HY Spread, Mortgage Rate)

**sector_snapshots (objectType "SectorSnapshot")** — enriched sector ETF performance:
- Fields: sectorTicker, sectorName, date, dayChangePct, weekChangePct, monthChangePct,
  ytdChangePct, relativeStrengthVsSpy, macroRegime, primaryMacroDrivers,
  sectorSignal (BULLISH/BEARISH/NEUTRAL), signalRationale
- Sectors: SPY, XLK, XLF, XLE, XLP, XLI, XLB, XLRE, XLU, XLV, XLY

**crypto_metrics (objectType "CryptoMetric")** and **category_snapshots (objectType "CategorySnapshot")**
— crypto market state with signals and regime classification.

Your analytical process — ALWAYS follow this order:
1. FIRST: Call read_prior_findings to understand what previous runs concluded
2. Read live macro_indicators (Density) — compare to prior anomalies; what has changed?
3. Read live sector_snapshots — identify rotation, regime confirmation or divergence
4. Investigate 1-2 anomalies with fetch_fred_series for historical validation
5. Write research note — explicitly state whether prior anomalies have resolved, persisted, or worsened

Be precise. Reference exact numbers and prior findings by date.
Surface what is NEW or CHANGED since the last run — regime shifts, resolved anomalies, new divergences.
Your note becomes part of the world model. Future runs will read it.`;

// ---------------------------------------------------------------------------
// Agentic loop
// ---------------------------------------------------------------------------

export async function runAgent(cfg: Config): Promise<string> {
  if (!cfg.DATABASE_URL) {
    throw new Error(
      "Agent requires DATABASE_URL. Run the pipeline first to populate the database.",
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Agent requires ANTHROPIC_API_KEY in environment.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Analyze the current state of the world model. " +
        "Start by reading prior findings to understand what previous runs concluded, " +
        "then read live macro and sector data to identify what has changed. " +
        "Investigate the most compelling anomalies with FRED historical data, then write your research note.",
    },
  ];

  console.log(chalk.bold.cyan("\n🤖  Research Agent"));
  console.log(
    chalk.dim(
      `  Model: claude-opus-4-6 | Adaptive thinking ON\n` +
      `  Tools: read_prior_findings · read_foundry_objects · fetch_fred_series · write_research_note\n`,
    ),
  );

  let notePath = "";
  let turn = 0;
  const MAX_TURNS = 14; // +2 for the prior findings read

  while (turn < MAX_TURNS) {
    turn++;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    // Render each content block
    for (const block of response.content) {
      if (block.type === "thinking") {
        const preview = block.thinking.slice(0, 200).replace(/\n+/g, " ");
        console.log(
          chalk.dim(`  [thinking] ${preview}${block.thinking.length > 200 ? "…" : ""}`),
        );
      } else if (block.type === "text" && block.text.trim()) {
        console.log(chalk.white(`\n${block.text.trim()}`));
      } else if (block.type === "tool_use") {
        const inputPreview = JSON.stringify(block.input).slice(0, 100);
        console.log(chalk.cyan(`\n  ▶ ${block.name}  ${chalk.dim(inputPreview)}`));
      }
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      // Preserve full content array (including thinking blocks) before adding tool results
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const input = block.input as Record<string, unknown>;
        let result: string;

        try {
          switch (block.name) {
            case "read_prior_findings":
              result = await execReadPriorFindings(Number(input.limit ?? 5), cfg);
              console.log(chalk.green(`  ✓ read_prior_findings`));
              break;

            case "read_foundry_objects":
              result = await execReadFoundryObjects(String(input.objectType), cfg);
              console.log(chalk.green(`  ✓ read_foundry_objects(${input.objectType})`));
              break;

            case "fetch_fred_series":
              result = await execFetchFredSeries(
                String(input.seriesId),
                Number(input.limit ?? 24),
                cfg,
              );
              console.log(chalk.green(`  ✓ fetch_fred_series(${input.seriesId})`));
              break;

            case "write_research_note":
              result = await execWriteResearchNote(input as unknown as ResearchNote, cfg);
              const match = result.match(/reports\/[^\s]+\.md/);
              if (match) notePath = match[0];
              console.log(chalk.green(`  ✓ write_research_note → ${notePath}`));
              break;

            default:
              result = `Unknown tool: ${block.name}`;
          }
        } catch (err) {
          result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
          console.log(chalk.red(`  ✗ ${block.name} failed: ${result}`));
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  if (turn >= MAX_TURNS) {
    console.log(chalk.yellow("\n  [Agent] Max turns reached — stopping."));
  }

  return notePath;
}
