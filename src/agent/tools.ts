import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { writeFileSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { Config } from "../config.js";
import { getDb } from "../db/client.js";
import { scoreResearchNote } from "./scorer.js";
import {
  macroIndicators,
  sectorSnapshots,
  cryptoMetrics as cryptoMetricsTable,
  categorySnapshots as categorySnapshotsTable,
  agentFindings,
  openhandsTasks,
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
      "Returns the last N research notes — each includes regime call, confidence, conviction score, " +
      "verification status (was the prior call right?), key findings, anomalies, and investment ideas. " +
      "Use this to understand what has been observed, what anomalies persisted, and how accurate prior calls were.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of recent findings (default: 5, max: 20)" },
      },
      required: [],
    },
  },
  {
    name: "verify_prior_calls",
    description:
      "Check prior regime calls against current market reality to build a track record. " +
      "Returns unverified findings (status=PENDING) with their predictions. " +
      "After calling this and reading live data, you can assess whether those calls were " +
      "CONFIRMED, PARTIAL, or WRONG. Include your verdicts in write_research_note under 'verifications'. " +
      "This is how the system builds a calibrated track record over time.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of unverified findings to check (default: 3)" },
      },
      required: [],
    },
  },
  {
    name: "query_similar_regimes",
    description:
      "Search historical findings for similar macro configurations — pattern memory. " +
      "Use this to ask: 'Have I seen this before? What happened next?' " +
      "Find prior runs with the same regime or similar anomalies to identify recurring patterns. " +
      "Returns matching findings ordered by recency.",
    input_schema: {
      type: "object" as const,
      properties: {
        regime: {
          type: "string",
          enum: ["EXPANSION", "SLOWDOWN", "CONTRACTION", "RECOVERY"],
          description: "Regime to match",
        },
        keyword: {
          type: "string",
          description: "Optional: search within findings text (e.g. 'HY spreads', 'yield curve', 'sentiment')",
        },
        limit: { type: "number", description: "Max results (default: 5)" },
      },
      required: ["regime"],
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
      "Use 'CategorySnapshot' to get crypto category breakdowns (Bitcoin, Ethereum, DeFi, Stablecoins, Altcoins).",
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
        seriesId: { type: "string", description: "FRED series ID (e.g. 'T10Y2Y', 'BAMLH0A0HYM2')" },
        limit: { type: "number", description: "Number of recent observations (default: 24, max: 60)" },
      },
      required: ["seriesId"],
    },
  },
  {
    name: "expand_data_sources",
    description:
      "Task OpenHands (an AI software engineer) to build a new data source or analysis tool. " +
      "Use this when you identify a data gap that limits your analysis — e.g., you need Treasury auction data, " +
      "options flow data, earnings revision data, or a new crypto metric. " +
      "OpenHands will write the code, add it to the pipeline, and open a PR. " +
      "This is how the platform grows its own capabilities. Use sparingly — only for genuine data gaps.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "What to build — be specific. Include: what data to fetch, the API/source, what table to write to, what signal logic to add.",
        },
        dataGap: {
          type: "string",
          description: "What analysis you couldn't complete because of this missing data",
        },
      },
      required: ["description", "dataGap"],
    },
  },
  {
    name: "write_research_note",
    description:
      "Save your completed research note to disk AND persist it to the database as a finding. " +
      "Call this ONCE at the end after reading prior findings, verifying prior calls, and analyzing live data. " +
      "This note becomes part of the world model — future agent runs will read it as context. " +
      "Be specific — use exact numbers. Rate your own conviction honestly.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        macroRegime: {
          type: "string",
          enum: ["EXPANSION", "SLOWDOWN", "CONTRACTION", "RECOVERY"],
        },
        convictionScore: {
          type: "number",
          description: "Your conviction 1-10. 10=multiple confirming signals, unambiguous regime. 1=contradictory data, high uncertainty.",
        },
        summary: { type: "string", description: "2-3 sentence bottom line with the most important insight" },
        keyFindings: {
          type: "array",
          items: { type: "string" },
          description: "4-6 specific, data-driven findings with exact numbers",
        },
        anomalies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indicator: { type: "string" },
              observation: { type: "string" },
              implication: { type: "string" },
            },
            required: ["indicator", "observation", "implication"],
          },
        },
        investmentIdeas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              direction: { type: "string", enum: ["LONG", "SHORT"] },
              thesis: { type: "string" },
              catalyst: { type: "string" },
              keyRisk: { type: "string" },
            },
            required: ["ticker", "direction", "thesis", "catalyst", "keyRisk"],
          },
        },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        verifications: {
          type: "array",
          description: "Your verdicts on prior regime calls — builds the track record",
          items: {
            type: "object",
            properties: {
              findingId:  { type: "string", description: "The findingId from verify_prior_calls" },
              accuracy:   { type: "string", enum: ["CONFIRMED", "PARTIAL", "WRONG"] },
              notes:      { type: "string", description: "How the prior call played out vs actual data" },
            },
            required: ["findingId", "accuracy", "notes"],
          },
        },
      },
      required: ["title", "macroRegime", "convictionScore", "summary", "keyFindings", "anomalies", "investmentIdeas", "confidence"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution functions
// ---------------------------------------------------------------------------

export async function execReadPriorFindings(limit: number, cfg: Config): Promise<string> {
  if (!cfg.DATABASE_URL) return "No DATABASE_URL — no prior findings. This is the first run.";
  const db = getDb(cfg.DATABASE_URL);
  const rows = await db
    .select()
    .from(agentFindings)
    .orderBy(desc(agentFindings.runAt))
    .limit(Math.min(Math.max(limit, 1), 20));

  if (rows.length === 0) return "No prior findings. This is the first agent run — establish a baseline.";

  const parsed = rows.map((r) => ({
    ...r,
    keyFindings:     JSON.parse(r.keyFindings),
    anomalies:       JSON.parse(r.anomalies),
    investmentIdeas: JSON.parse(r.investmentIdeas),
  }));
  return JSON.stringify(parsed, null, 2);
}

export async function execVerifyPriorCalls(limit: number, cfg: Config): Promise<string> {
  if (!cfg.DATABASE_URL) return "No DATABASE_URL — cannot verify prior calls.";
  const db = getDb(cfg.DATABASE_URL);
  const rows = await db
    .select()
    .from(agentFindings)
    .where(eq(agentFindings.verificationStatus, "PENDING"))
    .orderBy(desc(agentFindings.runAt))
    .limit(Math.min(Math.max(limit, 1), 10));

  if (rows.length === 0) return "No pending verifications — all prior calls have been assessed.";

  const parsed = rows.map((r) => ({
    findingId:    r.findingId,
    runAt:        r.runAt,
    macroRegime:  r.macroRegime,
    confidence:   r.confidence,
    convictionScore: r.convictionScore,
    summary:      r.summary,
    keyFindings:  JSON.parse(r.keyFindings),
    anomalies:    JSON.parse(r.anomalies),
    investmentIdeas: JSON.parse(r.investmentIdeas),
  }));

  return JSON.stringify({
    message: "Compare these prior calls to current live data and include your verdicts in write_research_note under 'verifications'.",
    pendingVerifications: parsed,
  }, null, 2);
}

export async function execQuerySimilarRegimes(
  regime: string,
  keyword: string | undefined,
  limit: number,
  cfg: Config,
): Promise<string> {
  if (!cfg.DATABASE_URL) return "No DATABASE_URL — cannot query historical patterns.";
  const db = getDb(cfg.DATABASE_URL);

  const rows = await db
    .select()
    .from(agentFindings)
    .where(
      keyword
        ? sql`${agentFindings.macroRegime} = ${regime} AND (
            ${agentFindings.keyFindings} ILIKE ${"%" + keyword + "%"} OR
            ${agentFindings.anomalies} ILIKE ${"%" + keyword + "%"} OR
            ${agentFindings.summary} ILIKE ${"%" + keyword + "%"}
          )`
        : eq(agentFindings.macroRegime, regime),
    )
    .orderBy(desc(agentFindings.runAt))
    .limit(Math.min(limit || 5, 10));

  if (rows.length === 0) {
    return `No prior findings with regime=${regime}${keyword ? ` matching "${keyword}"` : ""}. You're establishing the first data point for this configuration.`;
  }

  const parsed = rows.map((r) => ({
    findingId:        r.findingId,
    runAt:            r.runAt,
    macroRegime:      r.macroRegime,
    confidence:       r.confidence,
    convictionScore:  r.convictionScore,
    verificationStatus: r.verificationStatus,
    summary:          r.summary,
    keyFindings:      JSON.parse(r.keyFindings),
    investmentIdeas:  JSON.parse(r.investmentIdeas),
  }));

  return JSON.stringify({
    message: `Found ${rows.length} prior run(s) matching regime=${regime}${keyword ? ` + "${keyword}"` : ""}. Use these to identify recurring patterns.`,
    matches: parsed,
  }, null, 2);
}

export async function execExpandDataSources(
  description: string,
  dataGap: string,
  findingId: string,
  cfg: Config,
): Promise<string> {
  if (!cfg.OPENHANDS_API_KEY) {
    return "No OPENHANDS_API_KEY configured — cannot task the engineering agent. Add it to .env.";
  }

  const taskId = randomUUID();
  const task = `You are working on the foundry-macro-research repository.

DATA GAP IDENTIFIED BY RESEARCH AGENT:
${dataGap}

TASK:
${description}

REQUIREMENTS:
- Follow the existing patterns in src/ingestion/ for new data sources
- Follow src/db/schema.ts for any new Drizzle table definitions
- Add a Drizzle migration in drizzle/
- Update src/index.ts to call the new ingestion function
- Write tests following the pattern in src/tests/
- The pipeline runs with: npm run dev

Commit your changes with a clear message.`;

  try {
    const res = await axios.post(
      "https://app.all-hands.dev/api/v1/app-conversations",
      {
        initial_message: {
          content: [{ type: "text", text: task }],
        },
        selected_repository: cfg.GITHUB_REPO,
      },
      {
        headers: {
          Authorization: `Bearer ${cfg.OPENHANDS_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      },
    );

    const conversationId = res.data.app_conversation_id ?? res.data.id ?? "unknown";

    // Persist to DB
    if (cfg.DATABASE_URL) {
      const db = getDb(cfg.DATABASE_URL);
      await db.insert(openhandsTasks).values({
        taskId,
        requestedAt:          new Date().toISOString(),
        triggeredByFindingId: findingId,
        description,
        status:               "RUNNING",
        conversationId,
      });
    }

    return JSON.stringify({
      taskId,
      conversationId,
      status: "RUNNING",
      message: `OpenHands is building: "${description}". Track at https://app.all-hands.dev/conversations/${conversationId}`,
    }, null, 2);
  } catch (err) {
    return `OpenHands API error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function execReadFoundryObjects(objectType: string, cfg: Config): Promise<string> {
  if (!cfg.DATABASE_URL) return `No DATABASE_URL — cannot read ${objectType}.`;
  const db = getDb(cfg.DATABASE_URL);

  let rows: unknown[];
  switch (objectType) {
    case "Density":      rows = await db.select().from(macroIndicators); break;
    case "SectorSnapshot": rows = await db.select().from(sectorSnapshots); break;
    case "CryptoMetric": rows = await db.select().from(cryptoMetricsTable); break;
    case "CategorySnapshot": rows = await db.select().from(categorySnapshotsTable); break;
    default: return `Unknown objectType: ${objectType}`;
  }

  const cleaned = rows.map((r) => {
    const row = { ...(r as Record<string, unknown>) };
    for (const key of ["primaryMacroDrivers", "primaryMetricDrivers"]) {
      if (typeof row[key] === "string") {
        try { row[key] = JSON.parse(row[key] as string); } catch { /* leave */ }
      }
    }
    return row;
  });
  return JSON.stringify(cleaned, null, 2);
}

export async function execFetchFredSeries(seriesId: string, limit: number, cfg: Config): Promise<string> {
  if (!cfg.FRED_API_KEY) return `No FRED_API_KEY — cannot fetch ${seriesId}.`;
  try {
    const res = await axios.get("https://api.stlouisfed.org/fred/series/observations", {
      params: { series_id: seriesId, api_key: cfg.FRED_API_KEY, file_type: "json", sort_order: "desc", limit: Math.min(limit, 60) },
      timeout: 10_000,
    });
    const obs = (res.data.observations as Array<{ date: string; value: string }>)
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
    return JSON.stringify({ seriesId, observations: obs }, null, 2);
  } catch (err) {
    return `Error fetching ${seriesId}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export interface ResearchNote {
  title: string;
  macroRegime: string;
  convictionScore: number;
  summary: string;
  keyFindings: string[];
  anomalies: Array<{ indicator: string; observation: string; implication: string }>;
  investmentIdeas: Array<{ ticker: string; direction: string; thesis: string; catalyst: string; keyRisk: string }>;
  confidence: string;
  verifications?: Array<{ findingId: string; accuracy: string; notes: string }>;
  generatedAt?: string;
}

export async function execWriteResearchNote(input: ResearchNote, cfg: Config): Promise<string> {
  const note: ResearchNote = { ...input, generatedAt: new Date().toISOString() };
  mkdirSync("reports", { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mdPath = `reports/agent_note_${ts}.md`;

  const md = [
    `# ${note.title}`,
    ``,
    `**Generated:** ${note.generatedAt}  `,
    `**Regime:** \`${note.macroRegime}\`  `,
    `**Confidence:** \`${note.confidence}\`  `,
    `**Conviction:** ${note.convictionScore}/10`,
    ``,
    `## Summary`,
    note.summary,
    ``,
    `## Key Findings`,
    note.keyFindings.map((f) => `- ${f}`).join("\n"),
    ``,
    `## Anomalies`,
    note.anomalies.map((a) => `### ${a.indicator}\n**Observation:** ${a.observation}\n\n**Implication:** ${a.implication}`).join("\n\n"),
    ``,
    `## Investment Ideas`,
    note.investmentIdeas.map((i) => `### ${i.direction} ${i.ticker}\n**Thesis:** ${i.thesis}\n\n**Catalyst:** ${i.catalyst}\n\n**Key Risk:** ${i.keyRisk}`).join("\n\n"),
    note.verifications?.length
      ? `\n## Prior Call Verifications\n` + note.verifications.map((v) => `- **${v.accuracy}** (${v.findingId.slice(0, 8)}): ${v.notes}`).join("\n")
      : "",
  ].join("\n");

  writeFileSync(mdPath, md);

  // Score quality regardless of DB — non-blocking, failure returns null
  const quality = await scoreResearchNote(note);

  if (cfg.DATABASE_URL) {
    const db = getDb(cfg.DATABASE_URL);

    // Persist this finding
    const findingId = randomUUID();
    await db.insert(agentFindings).values({
      findingId,
      runAt:           note.generatedAt!,
      title:           note.title,
      macroRegime:     note.macroRegime,
      confidence:      note.confidence,
      convictionScore: note.convictionScore,
      summary:         note.summary,
      keyFindings:     JSON.stringify(note.keyFindings),
      anomalies:       JSON.stringify(note.anomalies),
      investmentIdeas: JSON.stringify(note.investmentIdeas),
      verificationStatus: "PENDING",
      qualityScore:    quality?.overall ?? null,
      qualityScores:   quality ? JSON.stringify(quality) : null,
    });

    // Write verification verdicts on prior findings
    if (note.verifications?.length) {
      const confirmed = note.verifications.filter((v) => v.accuracy === "CONFIRMED").length;
      const accuracy = confirmed / note.verifications.length;

      for (const v of note.verifications) {
        await db
          .update(agentFindings)
          .set({
            verificationStatus: v.accuracy,
            verifiedAt:         note.generatedAt!,
            priorCallAccuracy:  v.accuracy === "CONFIRMED" ? 1 : v.accuracy === "PARTIAL" ? 0.5 : 0,
          })
          .where(eq(agentFindings.findingId, v.findingId));
      }

      // Annotate this finding with how accurate the prior calls it verified were
      await db
        .update(agentFindings)
        .set({ priorCallAccuracy: accuracy })
        .where(eq(agentFindings.findingId, findingId));
    }
  }

  const qualityMsg = quality
    ? ` | quality=${quality.overall}/10 (relevance=${quality.relevance}, depth=${quality.depth}, temporal=${quality.temporalAccuracy}, consistency=${quality.dataConsistency})`
    : "";
  return `Research note saved → ${mdPath} (persisted to agent_findings with conviction=${note.convictionScore}/10${qualityMsg})`;
}
