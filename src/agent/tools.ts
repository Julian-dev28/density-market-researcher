import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";
import type { Config } from "../config.js";

const ONTOLOGY = "ontology-e6a83f07-70c3-4ec1-b7ce-b106a895b7ce";

// ---------------------------------------------------------------------------
// Tool schemas — passed to Claude
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_foundry_objects",
    description:
      "Read live objects from the Palantir Foundry Ontology. " +
      "Use 'Density' to get all macro indicator snapshots (GDP, CPI, unemployment, rates, yield curve, housing, sentiment, etc.) " +
      "with 52-week percentile rankings, period deltas, and BULLISH/BEARISH/NEUTRAL signals. " +
      "Use 'SectorSnapshot' to get all sector ETF performance (XLK, XLE, XLF, XLP, XLI, XLB, XLRE, XLU, XLV, XLY, SPY) " +
      "with YTD%, relative strength vs SPY, macro regime, and signals.",
    input_schema: {
      type: "object" as const,
      properties: {
        objectType: {
          type: "string",
          enum: ["Density", "SectorSnapshot"],
          description: "The Foundry object type to read",
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
      "Save your completed research note to disk. Call this ONCE at the end of your analysis " +
      "after reading all necessary data and forming conclusions. Be specific — use exact numbers.",
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
          description: "4-6 specific, data-driven findings with exact numbers from the Foundry data",
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

export async function execReadFoundryObjects(
  objectType: string,
  cfg: Config,
): Promise<string> {
  const url = `${cfg.FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY}/objects/${objectType}?pageSize=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.FOUNDRY_TOKEN}` },
  });
  if (!res.ok) {
    return `Error reading ${objectType} from Foundry: HTTP ${res.status}`;
  }
  const data = (await res.json()) as { data?: Record<string, unknown>[] };
  const objects = data.data ?? [];
  // Strip internal Foundry metadata to reduce token count
  const cleaned = objects.map((o) => {
    const { __rid, __apiName, ...rest } = o as Record<string, unknown>;
    void __rid; void __apiName;
    return rest;
  });
  return JSON.stringify(cleaned, null, 2);
}

export async function execFetchFredSeries(
  seriesId: string,
  limit: number,
  cfg: Config,
): Promise<string> {
  if (!cfg.FRED_API_KEY) {
    return `No FRED_API_KEY configured — cannot fetch ${seriesId}. Analysis limited to Foundry snapshot data.`;
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

export function execWriteResearchNote(input: ResearchNote): string {
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
  return `Research note saved → ${mdPath} (JSON: ${jsonPath})`;
}
