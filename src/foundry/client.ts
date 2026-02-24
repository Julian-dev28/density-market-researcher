import chalk from "chalk";
import type { MacroIndicator, SectorSnapshot, CryptoMetric, CategorySnapshot } from "../types/index.js";
import type { Config } from "../config.js";

// ============================================================
// Foundry Actions Client
//
// Writes all four object types to Palantir Foundry using the
// Ontology Actions API v2.
//
// Object types in Foundry:
//   "Density"         → MacroIndicator  (matched by sourceUrl)
//   "SectorSnapshot"  → SectorSnapshot  (matched by sectorTicker+date)
//   "CryptoMetric"    → CryptoMetric    (matched by metricId)
//   "CategorySnapshot"→ CategorySnapshot(matched by snapshotId)
//
// Actions used:
//   create-density           / edit-density
//   create-sector-snapshot   / edit-sector-snapshot
//   create-crypto-metric     / edit-crypto-metric
//   create-category-snapshot / edit-category-snapshot
//
// API: POST /api/v2/ontologies/{ontology}/actions/{action}/apply
// ============================================================

const ONTOLOGY = "ontology-e6a83f07-70c3-4ec1-b7ce-b106a895b7ce";

// ---------------------------------------------------------------------------
// Foundry REST helpers
// ---------------------------------------------------------------------------

async function applyAction(
  foundryUrl: string,
  token: string,
  actionName: string,
  parameters: Record<string, unknown>,
): Promise<void> {
  const url = `${foundryUrl}/api/v2/ontologies/${ONTOLOGY}/actions/${actionName}/apply`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parameters }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Action [${actionName}] failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  // HTTP 200 + VALID = success
}

async function listObjects(
  foundryUrl: string,
  token: string,
  objectType: string,
): Promise<Record<string, unknown>[]> {
  const url = `${foundryUrl}/api/v2/ontologies/${ONTOLOGY}/objects/${objectType}?pageSize=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as { data?: Record<string, unknown>[] };
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Density (MacroIndicator) upsert
// Match existing objects by sourceUrl — a stable unique identifier per series.
// ---------------------------------------------------------------------------

function densityParams(ind: MacroIndicator): Record<string, unknown> {
  return {
    name:            ind.name,
    source:          ind.source,
    category:        ind.category,
    latestValue:     ind.latestValue,
    latestDate:      ind.latestDate,
    unit:            ind.unit,
    priorValue:      ind.priorValue ?? 0,
    priorDate:       ind.priorDate ?? ind.latestDate,
    periodDelta:     ind.periodDelta ?? 0,
    periodDeltaPct:  ind.periodDeltaPct ?? 0,
    yearLow:         ind.yearLow ?? ind.latestValue,
    yearHigh:        ind.yearHigh ?? ind.latestValue,
    yearPercentile:  ind.yearPercentile ?? 0.5,
    signal:          ind.signal,
    signalRationale: ind.signalRationale,
    frequency:       ind.frequency,
    lastUpdated:     ind.lastUpdated,
    sourceUrl:       ind.sourceUrl,
  };
}

async function upsertIndicators(
  foundryUrl: string,
  token: string,
  indicators: MacroIndicator[],
): Promise<{ synced: number; failed: number }> {
  // Build map of existing Density objects: sourceUrl → primary key
  const existing = await listObjects(foundryUrl, token, "Density");
  const byUrl = new Map<string, string>(
    existing
      .filter(o => o.sourceUrl && o.__primaryKey)
      .map(o => [String(o.sourceUrl), String(o.__primaryKey)])
  );

  const results = await Promise.allSettled(
    indicators.map(async (ind) => {
      const params = densityParams(ind);
      const existingPk = byUrl.get(ind.sourceUrl);

      if (existingPk) {
        // Update existing object
        await applyAction(foundryUrl, token, "edit-density", {
          Density: existingPk,
          ...params,
        });
      } else {
        // Create new object
        await applyAction(foundryUrl, token, "create-density", params);
      }
    })
  );

  const synced = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map(r => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  Density: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// SectorSnapshot upsert
// Match existing objects by sectorTicker + date composite key.
// ---------------------------------------------------------------------------

function sectorParams(s: SectorSnapshot): Record<string, unknown> {
  return {
    sectorTicker:          s.sectorTicker,
    sectorName:            s.sectorName,
    date:                  s.date,
    dayChangePct:          s.dayChangePct ?? 0,
    weekChangePct:         s.weekChangePct ?? 0,
    monthChangePct:        s.monthChangePct ?? 0,
    ytdChangePct:          s.ytdChangePct ?? 0,
    relativeStrengthVsSpy: s.relativeStrengthVsSPY ?? 0,
    macroRegime:           s.macroRegime ?? "SLOWDOWN",
    primaryMacroDrivers:   JSON.stringify(s.primaryMacroDrivers),
    sectorSignal:          s.sectorSignal,
    signalRationale:       s.signalRationale,
    ingestedAt:            s.ingestedAt,
  };
}

async function upsertSectors(
  foundryUrl: string,
  token: string,
  sectors: SectorSnapshot[],
): Promise<{ synced: number; failed: number }> {
  // Build map: "TICKER_DATE" → primary key
  const existing = await listObjects(foundryUrl, token, "SectorSnapshot");
  const byComposite = new Map<string, string>(
    existing
      .filter(o => o.sectorTicker && o.date && o.__primaryKey)
      .map(o => [`${o.sectorTicker}_${o.date}`, String(o.__primaryKey)])
  );

  const results = await Promise.allSettled(
    sectors.map(async (s) => {
      const params = sectorParams(s);
      const compositeKey = `${s.sectorTicker}_${s.date}`;
      const existingPk = byComposite.get(compositeKey);

      if (existingPk) {
        await applyAction(foundryUrl, token, "edit-sector-snapshot", {
          SectorSnapshot: existingPk,
          ...params,
        });
      } else {
        await applyAction(foundryUrl, token, "create-sector-snapshot", params);
      }
    })
  );

  const synced = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map(r => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  SectorSnapshot: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// CryptoMetric upsert
// Match existing objects by metricId — stable identifier per metric.
// ---------------------------------------------------------------------------

function cryptoMetricParams(m: CryptoMetric): Record<string, unknown> {
  return {
    metricId:        m.metricId,
    name:            m.name,
    category:        m.category,
    source:          m.source,
    unit:            m.unit,
    latestValue:     m.latestValue,
    latestDate:      m.latestDate,
    priorValue:      m.priorValue ?? 0,
    periodDelta:     m.periodDelta ?? 0,
    periodDeltaPct:  m.periodDeltaPct ?? 0,
    signal:          m.signal,
    signalRationale: m.signalRationale,
    lastUpdated:     m.lastUpdated,
  };
}

async function upsertCryptoMetrics(
  foundryUrl: string,
  token: string,
  metrics: CryptoMetric[],
): Promise<{ synced: number; failed: number }> {
  const existing = await listObjects(foundryUrl, token, "CryptoMetric");
  const byMetricId = new Map<string, string>(
    existing
      .filter(o => o.metricId && o.__primaryKey)
      .map(o => [String(o.metricId), String(o.__primaryKey)])
  );

  const results = await Promise.allSettled(
    metrics.map(async (m) => {
      const params = cryptoMetricParams(m);
      const existingPk = byMetricId.get(m.metricId);
      if (existingPk) {
        await applyAction(foundryUrl, token, "edit-crypto-metric", {
          CryptoMetric: existingPk,
          ...params,
        });
      } else {
        await applyAction(foundryUrl, token, "create-crypto-metric", params);
      }
    })
  );

  const synced = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map(r => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  CryptoMetric: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// CategorySnapshot upsert
// Match existing objects by snapshotId (categorySlug + date).
// ---------------------------------------------------------------------------

function categorySnapshotParams(c: CategorySnapshot): Record<string, unknown> {
  return {
    snapshotId:           c.snapshotId,
    categoryName:         c.categoryName,
    categorySlug:         c.categorySlug,
    totalMarketCapUsd:    c.totalMarketCapUsd ?? 0,
    dayChangePct:         c.dayChangePct ?? 0,
    dominancePct:         c.dominancePct ?? 0,
    cryptoRegime:         c.cryptoRegime ?? "BEAR_MARKET",
    primaryMetricDrivers: JSON.stringify(c.primaryMetricDrivers),
    categorySignal:       c.categorySignal,
    signalRationale:      c.signalRationale,
    ingestedAt:           c.ingestedAt,
  };
}

async function upsertCategorySnapshots(
  foundryUrl: string,
  token: string,
  categories: CategorySnapshot[],
): Promise<{ synced: number; failed: number }> {
  const existing = await listObjects(foundryUrl, token, "CategorySnapshot");
  const bySnapshotId = new Map<string, string>(
    existing
      .filter(o => o.snapshotId && o.__primaryKey)
      .map(o => [String(o.snapshotId), String(o.__primaryKey)])
  );

  const results = await Promise.allSettled(
    categories.map(async (c) => {
      const params = categorySnapshotParams(c);
      const existingPk = bySnapshotId.get(c.snapshotId);
      if (existingPk) {
        await applyAction(foundryUrl, token, "edit-category-snapshot", {
          CategorySnapshot: existingPk,
          ...params,
        });
      } else {
        await applyAction(foundryUrl, token, "create-category-snapshot", params);
      }
    })
  );

  const synced = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    const errs = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map(r => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  CategorySnapshot: ${failed} failed — ${errs.join(" | ")}`));
  }
  return { synced, failed };
}

// ---------------------------------------------------------------------------
// Dry-run console output
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

export async function syncToFoundry(
  indicators: MacroIndicator[],
  sectors: SectorSnapshot[],
  cryptoMetrics: CryptoMetric[],
  categorySnapshots: CategorySnapshot[],
  cfg: Config,
): Promise<{ indicatorsSynced: number; sectorsSynced: number; cryptoSynced: number; categoriesSynced: number }> {
  if (cfg.DRY_RUN) {
    console.log(chalk.yellow(
      `\n[DRY RUN] Would write ${indicators.length} MacroIndicator + ${sectors.length} SectorSnapshot + ${cryptoMetrics.length} CryptoMetric + ${categorySnapshots.length} CategorySnapshot objects to Foundry\n`
    ));
    console.log(chalk.bold("  MACRO INDICATORS (→ Density)"));
    console.log(chalk.dim(`  ${"Series ID".padEnd(14)}  ${"Value".padEnd(10)}  ${"Delta".padEnd(20)}  Signal    52w Range`));
    console.log(chalk.dim(`  ${"-".repeat(72)}`));
    indicators.forEach(printIndicator);

    console.log(chalk.bold("\n  SECTOR SNAPSHOTS (→ SectorSnapshot)"));
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

  const { FOUNDRY_URL, FOUNDRY_TOKEN } = cfg;
  if (!FOUNDRY_URL || !FOUNDRY_TOKEN) {
    throw new Error("FOUNDRY_URL and FOUNDRY_TOKEN are required. Set DRY_RUN=true to skip.");
  }

  console.log(chalk.cyan(`\n[Foundry] Syncing to ${FOUNDRY_URL} via Actions API …`));
  console.log(chalk.dim(`  Ontology: ${ONTOLOGY}`));

  const [indResult, secResult, cryptoResult, catResult] = await Promise.all([
    upsertIndicators(FOUNDRY_URL, FOUNDRY_TOKEN, indicators),
    upsertSectors(FOUNDRY_URL, FOUNDRY_TOKEN, sectors),
    cryptoMetrics.length > 0
      ? upsertCryptoMetrics(FOUNDRY_URL, FOUNDRY_TOKEN, cryptoMetrics)
      : Promise.resolve({ synced: 0, failed: 0 }),
    categorySnapshots.length > 0
      ? upsertCategorySnapshots(FOUNDRY_URL, FOUNDRY_TOKEN, categorySnapshots)
      : Promise.resolve({ synced: 0, failed: 0 }),
  ]);

  console.log(chalk.green(
    `[Foundry] ✓ Indicators: ${indResult.synced} synced` +
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
