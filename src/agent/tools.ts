import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import type { Config } from "../config.js";
import { getDb } from "../db/client.js";
import {
  macroIndicators,
  sectorSnapshots,
  cryptoMetrics as cryptoMetricsTable,
  categorySnapshots as categorySnapshotsTable,
  agentFindings,
} from "../db/schema.js";

// ---------------------------------------------------------------------------
// Tool schemas — passed to Claude
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_prior_findings",
    description:
      "Read conclusions from previous agent runs stored in the database. " +
      "ALWAYS call this first before reading live data. " +
      "Returns the last N research notes written by prior agent runs — each includes the macro regime call, " +
      "confidence level, key findings, anomalies flagged, and investment ideas proposed. " +
      "Use this to understand what has already been observed, what anomalies have persisted across runs, " +
      "and whether the current regime call confirms or contradicts prior conclusions.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of recent findings to read (default: 5, max: 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "read_foundry_objects",
    description:
      "Read live objects from the Postgres database. " +
      "Use 'Density' to get all macro indicator snapshots (GDP, CPI, unemployment, rates, yield curve, housing, sentiment, etc.) " +
      "with 52-week percentile rankings, period deltas, and BULLISH/BEARISH/NEUTRAL signals. " +
      "Use 'SectorSnapshot' to get all sector ETF performance (XLK, XLE, XLF, XLP, XLI, XLB, XLRE, XLU, XLV, XLY, SPY) " +
      "with YTD%, relative strength vs SPY, macro regime, and signals. " +
      "Use 'CryptoMetric' to get crypto market metrics (total market cap, BTC dominance, Fear & Greed, stablecoin supply, DeFi TVL, etc.) " +
      "with period deltas and BULLISH/BEARISH/NEUTRAL signals. " +
      "Use 'CategorySnapshot' to get crypto category breakdowns (Bitcoin, Ethereum, DeFi, Stablecoins, Altcoins) " +
      "with market cap, dominance %, crypto regime, and signals.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectType: {
          type: "string",
          enum: ["Density", "SectorSnapshot", "CryptoMetric", "CategorySnapshot"],
          description: "The object type to read",
        },
      },
      required: ["objectType"],
    },
  },
  {
    name: "fetch_fred_series",
    description:
      "Fetch historical observations for a specific FRED economic series to get deeper time-series context. " +
      "Use this when you spot an anomaly and want to validate whether it is a new trend or a one-off. " +
      "Common IDs: CPIAUCSL (CPI), CPILFESL (Core CPI), FEDFUNDS (Fed Funds Rate), UNRATE (Unemployment), " +
      "GDP (Gross Domestic Product), T10Y2Y (10Y-2Y Spread), MORTGAGE30US (30Y Mortgage Rate), " +
      "HOUST (Housing Starts), INDPRO (Industrial Production), UMCSENT (Consumer Sentiment), " +
      "PPIACO (PPI), BAMLH0A0HYM2 (HY Spread).",
    input_schema: {
      type: "object" as const,
      properties: {
        seriesId: {
          type: "string",
          description: "FRED series ID (e.g. 'CPIAUCSL', 'FEDFUNDS', 'T10Y2Y')",
        },
        limit: {
          type: "number",
          description: "Number of recent observations to fetch (default: 24, max: 60)",
        },
      },
      required: ["seriesId"],
    },
  },
  {
    name: "write_research_note",
    description:
      "Save your completed research note to disk AND persist it to the database as a finding. " +
      "Call this ONCE at the end of your analysis after reading prior findings and all live data. " +
      "This note becomes part of the world model — future agent runs will read it as context. " +
      "Be specific — use exact numbers. Explicitly note whether anomalies from prior runs have resolved or persisted.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Concise research note title",
        },
        macroRegime: {
          type: "string",
          enum: ["EXPANSION", "SLOWDOWN", "CONTRACTION", "RECOVERY"],
          description: "Current macro regime classification",
        },
        summary: {
          type: "string",
          description: "2-3 sentence bottom line up front with the most important insight",
        },
        keyFindings: {
          type: "array",
          items: { type: "string" },
          description: "4-6 specific, data-driven findings with exact numbers from the data",
        },
        anomalies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indicator: { type: "string" },
              observation: { type: "string", description: "What is unusual, with the exact value and percentile" },
              implication: { type: "string", description: "What this means for markets or the economy" },
            },
            required: ["indicator", "observation", "implication"],
          },
          description: "Readings that are at extreme percentiles or diverging from correlated series",
        },
        investmentIdeas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              direction: { type: "string", enum: ["LONG", "SHORT"] },
              thesis: { type: "string", description: "Specific data-driven thesis referencing exact indicators" },
              catalyst: { type: "string", description: "What event or data point would confirm the trade" },
              keyRisk: { type: "string", description: "The single biggest risk to the thesis" },
            },
            required: ["ticker", "direction", "thesis", "catalyst", "keyRisk"],
          },
        },
        confidence: {
          type: "string",
          enum: ["HIGH", "MEDIUM", "LOW"],
          description: "Overall confidence in this analysis given data quality and regime clarity",
        },
      },
      required: [
        "title",
        "macroRegime",
        "summary",
        "keyFindings",
        "anomalies",
        "investmentIdeas",
        "confidence",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution functions
// ---------------------------------------------------------------------------

export async function execReadPriorFindings(
  limit: number,
  cfg: Config,
): Promise<string> {
  if (!cfg.DATABASE_URL) {
    return "No DATABASE_URL configured — no prior findings available. This is the first run.";
  }
  const db = getDb(cfg.DATABASE_URL);
  const rows = await db
    .select()
    .from(agentFindings)
    .orderBy(desc(agentFindings.runAt))
    .limit(Math.min(Math.max(limit, 1), 20));

  if (rows.length === 0) {
    return "No prior findings in the database. This is the first agent run — establish a baseline.";
  }

  const parsed = rows.map((r) => ({
    ...r,
    keyFindings:     JSON.parse(r.keyFindings),
    anomalies:       JSON.parse(r.anomalies),
    investmentIdeas: JSON.parse(r.investmentIdeas),
  }));

  return JSON.stringify(parsed, null, 2);
}

export async function execReadFoundryObjects(
  objectType: string,
  cfg: Config,
): Promise<string> {
  if (!cfg.DATABASE_URL) {
    return `No DATABASE_URL configured — cannot read ${objectType}.`;
  }
  const db = getDb(cfg.DATABASE_URL);

  let rows: unknown[];
  switch (objectType) {
    case "Density":
      rows = await db.select().from(macroIndicators);
      break;
    case "SectorSnapshot":
      rows = await db.select().from(sectorSnapshots);
      break;
    case "CryptoMetric":
      rows = await db.select().from(cryptoMetricsTable);
      break;
    case "CategorySnapshot":
      rows = await db.select().from(categorySnapshotsTable);
      break;
    default:
      return `Unknown objectType: ${objectType}`;
  }

  // Parse stored JSON strings back into arrays
  const cleaned = rows.map((r) => {
    const row = { ...(r as Record<string, unknown>) };
    if (typeof row.primaryMacroDrivers === "string") {
      try { row.primaryMacroDrivers = JSON.parse(row.primaryMacroDrivers); } catch { /* leave as string */ }
    }
    if (typeof row.primaryMetricDrivers === "string") {
      try { row.primaryMetricDrivers = JSON.parse(row.primaryMetricDrivers); } catch { /* leave as string */ }
    }
    return row;
  });

  return JSON.stringify(cleaned, null, 2);
}

export async function execFetchFredSeries(
  seriesId: string,
  limit: number,
  cfg: Config,
): Promise<string> {
  if (!cfg.FRED_API_KEY) {
    return `No FRED_API_KEY configured — cannot fetch ${seriesId}. Analysis limited to database snapshot data.`;
  }
  try {
    const res = await axios.get(
      "https://api.stlouisfed.org/fred/series/observations",
      {
        params: {
          series_id: seriesId,
          api_key: cfg.FRED_API_KEY,
          file_type: "json",
          sort_order: "desc",
          limit: Math.min(limit, 60),
        },
        timeout: 10_000,
      },
    );
    const obs = res.data.observations as Array<{ date: string; value: string }>;
    const valid = obs
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
    return JSON.stringify({ seriesId, observations: valid }, null, 2);
  } catch (err) {
    return `Error fetching ${seriesId}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export interface ResearchNote {
  title: string;
  macroRegime: string;
  summary: string;
  keyFindings: string[];
  anomalies: Array<{
    indicator: string;
    observation: string;
    implication: string;
  }>;
  investmentIdeas: Array<{
    ticker: string;
    direction: string;
    thesis: string;
    catalyst: string;
    keyRisk: string;
  }>;
  confidence: string;
  generatedAt?: string;
}

export async function execWriteResearchNote(
  input: ResearchNote,
  cfg: Config,
): Promise<string> {
  const note: ResearchNote = { ...input, generatedAt: new Date().toISOString() };
  mkdirSync("reports", { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = `reports/agent_note_${ts}.json`;
  const mdPath = `reports/agent_note_${ts}.md`;

  writeFileSync(jsonPath, JSON.stringify(note, null, 2));

  const md = [
    `# ${note.title}`,
    ``,
    `**Generated:** ${note.generatedAt}  `,
    `**Regime:** \`${note.macroRegime}\`  `,
    `**Confidence:** \`${note.confidence}\``,
    ``,
    `## Summary`,
    note.summary,
    ``,
    `## Key Findings`,
    note.keyFindings.map((f) => `- ${f}`).join("\n"),
    ``,
    `## Anomalies Detected`,
    note.anomalies
      .map(
        (a) =>
          `### ${a.indicator}\n**Observation:** ${a.observation}\n\n**Implication:** ${a.implication}`,
      )
      .join("\n\n"),
    ``,
    `## Investment Ideas`,
    note.investmentIdeas
      .map(
        (i) =>
          `### ${i.direction} ${i.ticker}\n**Thesis:** ${i.thesis}\n\n**Catalyst:** ${i.catalyst}\n\n**Key Risk:** ${i.keyRisk}`,
      )
      .join("\n\n"),
  ].join("\n");

  writeFileSync(mdPath, md);

  // Persist finding to DB so future runs can read it as prior context
  if (cfg.DATABASE_URL) {
    const db = getDb(cfg.DATABASE_URL);
    await db.insert(agentFindings).values({
      findingId:       randomUUID(),
      runAt:           note.generatedAt!,
      title:           note.title,
      macroRegime:     note.macroRegime,
      confidence:      note.confidence,
      summary:         note.summary,
      keyFindings:     JSON.stringify(note.keyFindings),
      anomalies:       JSON.stringify(note.anomalies),
      investmentIdeas: JSON.stringify(note.investmentIdeas),
    });
  }

  return `Research note saved → ${mdPath} (JSON: ${jsonPath}, persisted to agent_findings)`;
}
