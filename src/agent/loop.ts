import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import type { Config } from "../config.js";
import {
  AGENT_TOOLS,
  execReadFoundryObjects,
  execFetchFredSeries,
  execWriteResearchNote,
  type ResearchNote,
} from "./tools.js";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an autonomous macro research analyst with direct read/write access to a Palantir Foundry Ontology.

The Foundry Ontology contains two live object types populated by a real-time data pipeline:

**Density objects** — macro economic indicators:
- Fields: name, latestValue, latestDate, unit, priorValue, periodDelta, periodDeltaPct,
  yearLow, yearHigh, yearPercentile (0=52wk low, 1=52wk high), signal (BULLISH/BEARISH/NEUTRAL),
  signalRationale, category, frequency, sourceUrl
- Sources: FRED (GDP, CPI, Core CPI, PPI, Fed Funds, 10Y-2Y Spread, Unemployment,
  Industrial Production, Housing Starts, Consumer Sentiment, HY Spread, Mortgage Rate)

**SectorSnapshot objects** — sector ETF performance:
- Fields: sectorTicker, sectorName, date, dayChangePct, weekChangePct, monthChangePct,
  ytdChangePct, relativeStrengthVsSpy, macroRegime, primaryMacroDrivers,
  sectorSignal (BULLISH/BEARISH/NEUTRAL), signalRationale
- Sectors: SPY, XLK, XLF, XLE, XLP, XLI, XLB, XLRE, XLU, XLV, XLY

Your analytical process:
1. Read Density objects — find indicators at extreme percentiles (>0.90 or <0.10) or showing unusual divergences
2. Read SectorSnapshot objects — identify sector rotation patterns and cross-sector signals
3. Investigate 1-2 specific anomalies using fetch_fred_series for historical context
4. Write a structured research note with actionable investment ideas

Be precise. Reference exact numbers (e.g. "Core CPI at 0.29% MoM, 100th percentile of its 52-week range").
Surface non-obvious insights — cross-series divergences, regime mismatches, contrarian setups.
Do not just summarize all the data; identify what is genuinely unusual and actionable.`;

// ---------------------------------------------------------------------------
// Agentic loop
// ---------------------------------------------------------------------------

export async function runAgent(cfg: Config): Promise<string> {
  if (!cfg.FOUNDRY_URL || !cfg.FOUNDRY_TOKEN) {
    throw new Error(
      "Agent requires FOUNDRY_URL and FOUNDRY_TOKEN. Run with DRY_RUN= to set live mode.",
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
        "Analyze the current macro and sector data in Foundry. " +
        "Read both Density and SectorSnapshot objects, identify the most anomalous or noteworthy readings, " +
        "investigate any compelling patterns with FRED historical data, then write your research note.",
    },
  ];

  console.log(chalk.bold.cyan("\n🤖  Foundry Research Agent"));
  console.log(
    chalk.dim(
      `  Model: claude-opus-4-6 | Adaptive thinking ON\n` +
      `  Tools: read_foundry_objects · fetch_fred_series · write_research_note\n`,
    ),
  );

  let notePath = "";
  let turn = 0;
  const MAX_TURNS = 12;

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
            case "read_foundry_objects":
              result = await execReadFoundryObjects(String(input.objectType), cfg);
              console.log(
                chalk.green(`  ✓ read_foundry_objects(${input.objectType})`),
              );
              break;

            case "fetch_fred_series":
              result = await execFetchFredSeries(
                String(input.seriesId),
                Number(input.limit ?? 24),
                cfg,
              );
              console.log(
                chalk.green(`  ✓ fetch_fred_series(${input.seriesId})`),
              );
              break;

            case "write_research_note":
              result = execWriteResearchNote(input as unknown as ResearchNote);
              // Extract path from result string for summary
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
