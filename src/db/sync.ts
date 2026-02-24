import chalk from "chalk";
import { sql } from "drizzle-orm";
import { getDb } from "./client.js";
import {
  macroIndicators,
  sectorSnapshots,
  cryptoMetrics as cryptoMetricsTable,
  categorySnapshots as categorySnapshotsTable,
} from "./schema.js";
import type { MacroIndicator, SectorSnapshot, CryptoMetric, CategorySnapshot } from "../types/index.js";
import type { Config } from "../config.js";

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

async function upsertIndicators(
  db: ReturnType<typeof getDb>,
  indicators: MacroIndicator[],
): Promise<{ synced: number; failed: number }> {
  const results = await Promise.allSettled(
    indicators.map((ind) =>
      db.insert(macroIndicators)
        .values({
          seriesId:        ind.seriesId,
          name:            ind.name,
          source:          ind.source,
          category:        ind.category,
          latestValue:     ind.latestValue,
          latestDate:      ind.latestDate,
          unit:            ind.unit,
          priorValue:      ind.priorValue ?? null,
          priorDate:       ind.priorDate ?? null,
          periodDelta:     ind.periodDelta ?? null,
          periodDeltaPct:  ind.periodDeltaPct ?? null,
          yearLow:         ind.yearLow ?? null,
          yearHigh:        ind.yearHigh ?? null,
          yearPercentile:  ind.yearPercentile ?? null,
          signal:          ind.signal,
          signalRationale: ind.signalRationale,
          frequency:       ind.frequency,
          lastUpdated:     ind.lastUpdated,
          sourceUrl:       ind.sourceUrl,
        })
        .onConflictDoUpdate({
          target: macroIndicators.seriesId,
          set: {
            latestValue:     sql`excluded.latest_value`,
            latestDate:      sql`excluded.latest_date`,
            priorValue:      sql`excluded.prior_value`,
            priorDate:       sql`excluded.prior_date`,
            periodDelta:     sql`excluded.period_delta`,
            periodDeltaPct:  sql`excluded.period_delta_pct`,
            yearLow:         sql`excluded.year_low`,
            yearHigh:        sql`excluded.year_high`,
            yearPercentile:  sql`excluded.year_percentile`,
            signal:          sql`excluded.signal`,
            signalRationale: sql`excluded.signal_rationale`,
            lastUpdated:     sql`excluded.last_updated`,
          },
        })
    )
  );
  const synced = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map((r) => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  macro_indicators: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

async function upsertSectors(
  db: ReturnType<typeof getDb>,
  sectors: SectorSnapshot[],
): Promise<{ synced: number; failed: number }> {
  const results = await Promise.allSettled(
    sectors.map((s) =>
      db.insert(sectorSnapshots)
        .values({
          snapshotId:            s.snapshotId,
          sectorTicker:          s.sectorTicker,
          sectorName:            s.sectorName,
          date:                  s.date,
          dayChangePct:          s.dayChangePct ?? null,
          weekChangePct:         s.weekChangePct ?? null,
          monthChangePct:        s.monthChangePct ?? null,
          ytdChangePct:          s.ytdChangePct ?? null,
          relativeStrengthVsSpy: s.relativeStrengthVsSPY ?? null,
          macroRegime:           s.macroRegime ?? null,
          primaryMacroDrivers:   JSON.stringify(s.primaryMacroDrivers),
          sectorSignal:          s.sectorSignal,
          signalRationale:       s.signalRationale,
          ingestedAt:            s.ingestedAt,
        })
        .onConflictDoUpdate({
          target: sectorSnapshots.snapshotId,
          set: {
            dayChangePct:          sql`excluded.day_change_pct`,
            weekChangePct:         sql`excluded.week_change_pct`,
            monthChangePct:        sql`excluded.month_change_pct`,
            ytdChangePct:          sql`excluded.ytd_change_pct`,
            relativeStrengthVsSpy: sql`excluded.relative_strength_vs_spy`,
            macroRegime:           sql`excluded.macro_regime`,
            primaryMacroDrivers:   sql`excluded.primary_macro_drivers`,
            sectorSignal:          sql`excluded.sector_signal`,
            signalRationale:       sql`excluded.signal_rationale`,
            ingestedAt:            sql`excluded.ingested_at`,
          },
        })
    )
  );
  const synced = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map((r) => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  sector_snapshots: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

async function upsertCryptoMetrics(
  db: ReturnType<typeof getDb>,
  metrics: CryptoMetric[],
): Promise<{ synced: number; failed: number }> {
  const results = await Promise.allSettled(
    metrics.map((m) =>
      db.insert(cryptoMetricsTable)
        .values({
          metricId:        m.metricId,
          name:            m.name,
          category:        m.category,
          source:          m.source,
          unit:            m.unit,
          latestValue:     m.latestValue,
          latestDate:      m.latestDate,
          priorValue:      m.priorValue ?? null,
          periodDelta:     m.periodDelta ?? null,
          periodDeltaPct:  m.periodDeltaPct ?? null,
          signal:          m.signal,
          signalRationale: m.signalRationale,
          lastUpdated:     m.lastUpdated,
        })
        .onConflictDoUpdate({
          target: cryptoMetricsTable.metricId,
          set: {
            latestValue:    sql`excluded.latest_value`,
            latestDate:     sql`excluded.latest_date`,
            priorValue:     sql`excluded.prior_value`,
            periodDelta:    sql`excluded.period_delta`,
            periodDeltaPct: sql`excluded.period_delta_pct`,
            signal:         sql`excluded.signal`,
            signalRationale:sql`excluded.signal_rationale`,
            lastUpdated:    sql`excluded.last_updated`,
          },
        })
    )
  );
  const synced = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 5)
      .map((r) => {
        const cause = r.reason?.cause?.message ?? r.reason?.cause ?? "";
        const msg = r.reason?.message ?? String(r.reason);
        return cause ? `${msg} | cause: ${cause}` : msg;
      });
    console.warn(chalk.yellow(`  ⚠  crypto_metrics: ${failed} failed — ${errs.join("\n    ")}`));
  }
  return { synced, failed };
}

async function upsertCategorySnapshots(
  db: ReturnType<typeof getDb>,
  categories: CategorySnapshot[],
): Promise<{ synced: number; failed: number }> {
  const results = await Promise.allSettled(
    categories.map((c) =>
      db.insert(categorySnapshotsTable)
        .values({
          snapshotId:           c.snapshotId,
          categoryName:         c.categoryName,
          categorySlug:         c.categorySlug,
          totalMarketCapUsd:    c.totalMarketCapUsd ?? null,
          dayChangePct:         c.dayChangePct ?? null,
          dominancePct:         c.dominancePct ?? null,
          cryptoRegime:         c.cryptoRegime ?? null,
          primaryMetricDrivers: JSON.stringify(c.primaryMetricDrivers),
          categorySignal:       c.categorySignal,
          signalRationale:      c.signalRationale,
          ingestedAt:           c.ingestedAt,
        })
        .onConflictDoUpdate({
          target: categorySnapshotsTable.snapshotId,
          set: {
            totalMarketCapUsd:    sql`excluded.total_market_cap_usd`,
            dayChangePct:         sql`excluded.day_change_pct`,
            dominancePct:         sql`excluded.dominance_pct`,
            cryptoRegime:         sql`excluded.crypto_regime`,
            primaryMetricDrivers: sql`excluded.primary_metric_drivers`,
            categorySignal:       sql`excluded.category_signal`,
            signalRationale:      sql`excluded.signal_rationale`,
            ingestedAt:           sql`excluded.ingested_at`,
          },
        })
    )
  );
  const synced = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map((r) => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  category_snapshots: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// Dry-run console output (preserved from foundry/client.ts)
// ---------------------------------------------------------------------------

function printIndicator(ind: MacroIndicator): void {
  const c = ind.signal === "BULLISH" ? chalk.green : ind.signal === "BEARISH" ? chalk.red : chalk.yellow;
  const delta = ind.periodDelta !== null
    ? `${ind.periodDelta > 0 ? "+" : ""}${ind.periodDelta.toFixed(3)} (${ind.periodDeltaPct?.toFixed(2)}%)`
    : "n/a";
  const pct = ind.yearPercentile !== null ? `${(ind.yearPercentile * 100).toFixed(0)}th pctile` : "";
  console.log(
    `    ${chalk.cyan(ind.seriesId.padEnd(14))}  ` +
    `${chalk.white(String(ind.latestValue).padEnd(10))}  ` +
    `${chalk.dim(delta.padEnd(20))}  ` +
    `${c(ind.signal.padEnd(8))}  ` +
    `${chalk.dim(pct)}`
  );
}

function printSector(s: SectorSnapshot): void {
  const c = s.sectorSignal === "BULLISH" ? chalk.green : s.sectorSignal === "BEARISH" ? chalk.red : chalk.yellow;
  const ytd = s.ytdChangePct !== null ? `YTD: ${s.ytdChangePct > 0 ? "+" : ""}${s.ytdChangePct.toFixed(2)}%` : "";
  const rs = s.relativeStrengthVsSPY !== null ? ` RS: ${s.relativeStrengthVsSPY > 0 ? "+" : ""}${s.relativeStrengthVsSPY.toFixed(2)}%` : "";
  console.log(
    `    ${chalk.cyan(s.sectorTicker.padEnd(6))}  ` +
    `${chalk.white(s.sectorName.padEnd(26))}  ` +
    `${c(s.sectorSignal.padEnd(8))}  ` +
    `${chalk.dim(ytd + rs)}`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function syncToDb(
  indicators: MacroIndicator[],
  sectors: SectorSnapshot[],
  cryptoMetrics: CryptoMetric[],
  categorySnapshots: CategorySnapshot[],
  cfg: Config,
): Promise<{ indicatorsSynced: number; sectorsSynced: number; cryptoSynced: number; categoriesSynced: number }> {
  if (cfg.DRY_RUN) {
    console.log(chalk.yellow(
      `\n[DRY RUN] Would write ${indicators.length} MacroIndicator + ${sectors.length} SectorSnapshot + ${cryptoMetrics.length} CryptoMetric + ${categorySnapshots.length} CategorySnapshot rows to Postgres\n`
    ));
    console.log(chalk.bold("  MACRO INDICATORS (→ macro_indicators)"));
    console.log(chalk.dim(`  ${"Series ID".padEnd(14)}  ${"Value".padEnd(10)}  ${"Delta".padEnd(20)}  Signal    52w Range`));
    console.log(chalk.dim(`  ${"-".repeat(72)}`));
    indicators.forEach(printIndicator);

    console.log(chalk.bold("\n  SECTOR SNAPSHOTS (→ sector_snapshots)"));
    console.log(chalk.dim(`  ${"Ticker".padEnd(6)}  ${"Sector".padEnd(26)}  Signal    Performance`));
    console.log(chalk.dim(`  ${"-".repeat(65)}`));
    sectors.forEach(printSector);

    const regime = sectors[0]?.macroRegime;
    if (regime) {
      const col = regime === "EXPANSION" ? chalk.green : regime === "RECOVERY" ? chalk.cyan : regime === "SLOWDOWN" ? chalk.yellow : chalk.red;
      console.log(chalk.bold(`\n  Macro Regime: ${col(regime)}`));
    }
    return {
      indicatorsSynced: indicators.length,
      sectorsSynced: sectors.length,
      cryptoSynced: cryptoMetrics.length,
      categoriesSynced: categorySnapshots.length,
    };
  }

  if (!cfg.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Set DRY_RUN=true to skip.");
  }

  const db = getDb(cfg.DATABASE_URL);
  console.log(chalk.cyan(`\n[Postgres] Syncing via Drizzle …`));

  const [indResult, secResult, cryptoResult, catResult] = await Promise.all([
    upsertIndicators(db, indicators),
    upsertSectors(db, sectors),
    cryptoMetrics.length > 0
      ? upsertCryptoMetrics(db, cryptoMetrics)
      : Promise.resolve({ synced: 0, failed: 0 }),
    categorySnapshots.length > 0
      ? upsertCategorySnapshots(db, categorySnapshots)
      : Promise.resolve({ synced: 0, failed: 0 }),
  ]);

  console.log(chalk.green(
    `[Postgres] ✓ Indicators: ${indResult.synced} synced` +
    (indResult.failed ? `, ${indResult.failed} failed` : "") +
    `  |  Sectors: ${secResult.synced} synced` +
    (secResult.failed ? `, ${secResult.failed} failed` : "") +
    (cryptoResult.synced > 0 ? `  |  Crypto: ${cryptoResult.synced} synced` : "") +
    (cryptoResult.failed > 0 ? `, ${cryptoResult.failed} failed` : "") +
    (catResult.synced > 0 ? `  |  Categories: ${catResult.synced} synced` : "") +
    (catResult.failed > 0 ? `, ${catResult.failed} failed` : "")
  ));

  return {
    indicatorsSynced: indResult.synced,
    sectorsSynced: secResult.synced,
    cryptoSynced: cryptoResult.synced,
    categoriesSynced: catResult.synced,
  };
}
