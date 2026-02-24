import { pgTable, text, doublePrecision } from "drizzle-orm/pg-core";

// ------------------------------------------------------------
// macro_indicators  (was: "Density" in Foundry)
// Upsert key: series_id
// ------------------------------------------------------------
export const macroIndicators = pgTable("macro_indicators", {
  seriesId:        text("series_id").primaryKey(),
  name:            text("name").notNull(),
  source:          text("source").notNull(),
  category:        text("category").notNull(),
  latestValue:     doublePrecision("latest_value").notNull(),
  latestDate:      text("latest_date").notNull(),
  unit:            text("unit").notNull(),
  priorValue:      doublePrecision("prior_value"),
  priorDate:       text("prior_date"),
  periodDelta:     doublePrecision("period_delta"),
  periodDeltaPct:  doublePrecision("period_delta_pct"),
  yearLow:         doublePrecision("year_low"),
  yearHigh:        doublePrecision("year_high"),
  yearPercentile:  doublePrecision("year_percentile"),
  signal:          text("signal").notNull(),
  signalRationale: text("signal_rationale").notNull(),
  frequency:       text("frequency").notNull(),
  lastUpdated:     text("last_updated").notNull(),
  sourceUrl:       text("source_url").notNull(),
});

// ------------------------------------------------------------
// sector_snapshots
// Upsert key: snapshot_id = sectorTicker + "_" + date
// ------------------------------------------------------------
export const sectorSnapshots = pgTable("sector_snapshots", {
  snapshotId:            text("snapshot_id").primaryKey(),
  sectorTicker:          text("sector_ticker").notNull(),
  sectorName:            text("sector_name").notNull(),
  date:                  text("date").notNull(),
  dayChangePct:          doublePrecision("day_change_pct"),
  weekChangePct:         doublePrecision("week_change_pct"),
  monthChangePct:        doublePrecision("month_change_pct"),
  ytdChangePct:          doublePrecision("ytd_change_pct"),
  relativeStrengthVsSpy: doublePrecision("relative_strength_vs_spy"),
  macroRegime:           text("macro_regime"),
  primaryMacroDrivers:   text("primary_macro_drivers").notNull(), // JSON string
  sectorSignal:          text("sector_signal").notNull(),
  signalRationale:       text("signal_rationale").notNull(),
  ingestedAt:            text("ingested_at").notNull(),
});

// ------------------------------------------------------------
// crypto_metrics
// Upsert key: metric_id (e.g. "TOTAL_MARKET_CAP", "FEAR_GREED")
// ------------------------------------------------------------
export const cryptoMetrics = pgTable("crypto_metrics", {
  metricId:        text("metric_id").primaryKey(),
  name:            text("name").notNull(),
  category:        text("category").notNull(),
  source:          text("source").notNull(),
  unit:            text("unit").notNull(),
  latestValue:     doublePrecision("latest_value").notNull(),
  latestDate:      text("latest_date").notNull(),
  priorValue:      doublePrecision("prior_value"),
  periodDelta:     doublePrecision("period_delta"),
  periodDeltaPct:  doublePrecision("period_delta_pct"),
  signal:          text("signal").notNull(),
  signalRationale: text("signal_rationale").notNull(),
  lastUpdated:     text("last_updated").notNull(),
});

// ------------------------------------------------------------
// category_snapshots
// Upsert key: snapshot_id = categorySlug + "_" + date
// ------------------------------------------------------------
export const categorySnapshots = pgTable("category_snapshots", {
  snapshotId:           text("snapshot_id").primaryKey(),
  categoryName:         text("category_name").notNull(),
  categorySlug:         text("category_slug").notNull(),
  totalMarketCapUsd:    doublePrecision("total_market_cap_usd"),
  dayChangePct:         doublePrecision("day_change_pct"),
  dominancePct:         doublePrecision("dominance_pct"),
  cryptoRegime:         text("crypto_regime"),
  primaryMetricDrivers: text("primary_metric_drivers").notNull(), // JSON string
  categorySignal:       text("category_signal").notNull(),
  signalRationale:      text("signal_rationale").notNull(),
  ingestedAt:           text("ingested_at").notNull(),
});

// ------------------------------------------------------------
// agent_findings
// Written by the Claude agent after each run.
// Each subsequent run reads prior findings before reasoning —
// persistent memory that accumulates intelligence over time.
// ------------------------------------------------------------
export const agentFindings = pgTable("agent_findings", {
  findingId:           text("finding_id").primaryKey(),          // UUID
  runAt:               text("run_at").notNull(),                  // ISO timestamp
  title:               text("title").notNull(),
  macroRegime:         text("macro_regime").notNull(),            // EXPANSION | SLOWDOWN | CONTRACTION | RECOVERY
  confidence:          text("confidence").notNull(),              // HIGH | MEDIUM | LOW
  convictionScore:     doublePrecision("conviction_score"),       // 1-10: agent self-rated conviction
  summary:             text("summary").notNull(),
  keyFindings:         text("key_findings").notNull(),            // JSON: string[]
  anomalies:           text("anomalies").notNull(),               // JSON: {indicator, observation, implication}[]
  investmentIdeas:     text("investment_ideas").notNull(),        // JSON: {ticker, direction, thesis, catalyst, keyRisk}[]
  verificationStatus:  text("verification_status").default("PENDING"), // PENDING | CONFIRMED | PARTIAL | WRONG
  verifiedAt:          text("verified_at"),
  priorCallAccuracy:   doublePrecision("prior_call_accuracy"),   // 0-1: how accurate this run's prior-call verifications were
});

// ------------------------------------------------------------
// openhands_tasks
// Written when the research agent identifies a capability gap
// and tasks OpenHands to build a new data source or tool.
// Each task = one OpenHands conversation.
// ------------------------------------------------------------
export const openhandsTasks = pgTable("openhands_tasks", {
  taskId:                text("task_id").primaryKey(),          // UUID
  requestedAt:           text("requested_at").notNull(),
  triggeredByFindingId:  text("triggered_by_finding_id"),       // which finding motivated this
  description:           text("description").notNull(),         // what the agent asked OpenHands to build
  status:                text("status").notNull().default("RUNNING"), // RUNNING | COMPLETE | FAILED
  conversationId:        text("conversation_id"),               // OpenHands conversation ID
  result:                text("result"),                        // what was built
  completedAt:           text("completed_at"),
});

// ------------------------------------------------------------
// watchlist_companies
// Not written by the pipeline but kept for future use.
// ------------------------------------------------------------
export const watchlistCompanies = pgTable("watchlist_companies", {
  ticker:               text("ticker").primaryKey(),
  name:                 text("name").notNull(),
  sectorTicker:         text("sector_ticker").notNull(),
  subIndustry:          text("sub_industry"),
  marketCapBn:          doublePrecision("market_cap_bn"),
  rateSensitivity:      doublePrecision("rate_sensitivity"),
  inflationSensitivity: doublePrecision("inflation_sensitivity"),
  usdSensitivity:       doublePrecision("usd_sensitivity"),
  analystNotes:         text("analyst_notes"),
  addedAt:              text("added_at").notNull(),
  lastReviewedAt:       text("last_reviewed_at"),
});
