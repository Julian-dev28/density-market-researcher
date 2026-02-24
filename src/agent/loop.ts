import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import type { Config } from "../config.js";
import {
  AGENT_TOOLS,
  execReadPriorFindings,
  execVerifyPriorCalls,
  execQuerySimilarRegimes,
  execReadFoundryObjects,
  execFetchFredSeries,
  execExpandDataSources,
  execWriteResearchNote,
  type ResearchNote,
} from "./tools.js";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an autonomous macro research analyst with persistent memory and a track record to maintain.

The database is your world model. It accumulates intelligence across runs — not just raw data, but your own prior conclusions, whether they were right, and patterns you've identified. You compound this knowledge on every run.

**Your analytical process — follow this order:**

1. **read_prior_findings** — what did prior runs conclude? What was the regime call, conviction, and has it been verified?
2. **verify_prior_calls** — check unverified calls against current reality. You maintain a track record.
3. **query_similar_regimes** — have you seen this configuration before? Find pattern matches in historical findings.
4. **read_foundry_objects** — read live macro, sector, and crypto data. What has changed since last run?
5. **fetch_fred_series** — investigate 1-2 anomalies with historical depth.
6. **expand_data_sources** (optional) — if you identify a genuine data gap limiting your analysis, task OpenHands to build the missing ingestion module.
7. **write_research_note** — synthesize everything. Include verification verdicts on prior calls. Rate your conviction 1-10.

**On conviction scoring:**
- 9-10: Multiple confirming signals, clear directional regime, pattern matches from prior runs
- 7-8: Mostly aligned signals with one or two contradictions
- 5-6: Mixed signals, uncertain regime
- 3-4: Contradictory signals, significant data gaps
- 1-2: Cannot form a reliable view

**On verification:**
- CONFIRMED: Prior regime call aligned with observed market behavior (sector rotation, credit spreads, etc.)
- PARTIAL: Directionally right but with meaningful exceptions
- WRONG: Market behavior contradicted the prior call

**On expanding data sources:**
Only call expand_data_sources when you hit a genuine analytical wall — a specific data series you need that isn't in the current dataset. The platform grows itself through you.

Be precise. Reference exact numbers. Surface what is NEW or CHANGED since the last run.
Your note becomes part of the world model. Future runs will read it.`;

// ---------------------------------------------------------------------------
// Agentic loop
// ---------------------------------------------------------------------------

export async function runAgent(cfg: Config): Promise<string> {
  if (!cfg.DATABASE_URL) {
    throw new Error("Agent requires DATABASE_URL.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Agent requires ANTHROPIC_API_KEY.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Run your full analysis cycle. Start by reading prior findings and verifying prior calls, " +
        "then check for similar historical patterns, then read live data. " +
        "Investigate anomalies, expand data sources if you hit a genuine gap, then write your research note.",
    },
  ];

  console.log(chalk.bold.cyan("\n🤖  Research Agent"));
  console.log(
    chalk.dim(
      `  Model: claude-opus-4-6 | Adaptive thinking ON\n` +
      `  Tools: read_prior_findings · verify_prior_calls · query_similar_regimes · read_foundry_objects · fetch_fred_series · expand_data_sources · write_research_note\n`,
    ),
  );

  let notePath = "";
  let turn = 0;
  let lastFindingId = "";
  const MAX_TURNS = 18;

  while (turn < MAX_TURNS) {
    turn++;

    const response = await client.messages.create({
      model:      "claude-opus-4-6",
      max_tokens: 8000,
      thinking:   { type: "adaptive" },
      system:     SYSTEM_PROMPT,
      tools:      AGENT_TOOLS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "thinking") {
        const preview = block.thinking.slice(0, 200).replace(/\n+/g, " ");
        console.log(chalk.dim(`  [thinking] ${preview}${block.thinking.length > 200 ? "…" : ""}`));
      } else if (block.type === "text" && block.text.trim()) {
        console.log(chalk.white(`\n${block.text.trim()}`));
      } else if (block.type === "tool_use") {
        const inputPreview = JSON.stringify(block.input).slice(0, 100);
        console.log(chalk.cyan(`\n  ▶ ${block.name}  ${chalk.dim(inputPreview)}`));
      }
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
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

            case "verify_prior_calls":
              result = await execVerifyPriorCalls(Number(input.limit ?? 3), cfg);
              console.log(chalk.green(`  ✓ verify_prior_calls`));
              break;

            case "query_similar_regimes":
              result = await execQuerySimilarRegimes(
                String(input.regime),
                input.keyword ? String(input.keyword) : undefined,
                Number(input.limit ?? 5),
                cfg,
              );
              console.log(chalk.green(`  ✓ query_similar_regimes(${input.regime})`));
              break;

            case "read_foundry_objects":
              result = await execReadFoundryObjects(String(input.objectType), cfg);
              console.log(chalk.green(`  ✓ read_foundry_objects(${input.objectType})`));
              break;

            case "fetch_fred_series":
              result = await execFetchFredSeries(String(input.seriesId), Number(input.limit ?? 24), cfg);
              console.log(chalk.green(`  ✓ fetch_fred_series(${input.seriesId})`));
              break;

            case "expand_data_sources":
              result = await execExpandDataSources(
                String(input.description),
                String(input.dataGap),
                lastFindingId,
                cfg,
              );
              console.log(chalk.green(`  ✓ expand_data_sources → OpenHands`));
              break;

            case "write_research_note": {
              result = await execWriteResearchNote(input as unknown as ResearchNote, cfg);
              const match = result.match(/reports\/[^\s]+\.md/);
              if (match) notePath = match[0];
              console.log(chalk.green(`  ✓ write_research_note → ${notePath}`));
              break;
            }

            default:
              result = `Unknown tool: ${block.name}`;
          }
        } catch (err) {
          result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
          console.log(chalk.red(`  ✗ ${block.name} failed: ${result}`));
        }

        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  if (turn >= MAX_TURNS) {
    console.log(chalk.yellow("\n  [Agent] Max turns reached."));
  }

  return notePath;
}
