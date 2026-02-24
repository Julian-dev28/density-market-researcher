import chalk from "chalk";
import type { MacroIndicator, SectorSnapshot, CryptoMetric, CategorySnapshot } from "../types/index.js";
import type { Config } from "../config.js";
import { OBJECT_TYPES } from "./objectTypes.js";

// ============================================================
// Foundry REST API v2 Client
//
// Writes pipeline output directly to Foundry Ontology objects
// using the Palantir Foundry API v2 with Bearer token auth.
//
// Requires:
//   FOUNDRY_URL   — Palantir stack base URL
//   FOUNDRY_TOKEN — User or service-account token
//
// Object types written:
//   • macro_indicator     (primary key: seriesId)
//   • sector_snapshot     (primary key: snapshotId)
//   • crypto_metric       (primary key: metricId)
//   • category_snapshot   (primary key: snapshotId)
//
// API reference:
//   https://www.palantir.com/docs/foundry/api/ontology-resources/
// ============================================================

// Cached per-process — avoids repeated discovery calls
let _ontologyRid: string | null = null;

async function getOntologyRid(foundryUrl: string, token: string): Promise<string> {
  if (_ontologyRid) return _ontologyRid;

  const res = await fetch(`${foundryUrl}/api/v2/ontologies`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Ontology discovery failed: HTTP ${res.status} ${await res.text().catch(() => "")}`
    );
  }

  const json = await res.json() as { data?: Array<{ rid: string; apiName: string }>; ontologies?: Array<{ rid: string; apiName: string }> };
  // Foundry returns { data: [ { rid, apiName, ... } ] }
  const list: Array<{ rid: string; apiName: string }> = json.data ?? json.ontologies ?? [];
  if (list.length === 0) throw new Error("No ontologies found in Foundry instance");

  _ontologyRid = list[0].apiName ?? list[0].rid;
  return _ontologyRid!;
}

// ---------------------------------------------------------------------------
// Single object upsert via Foundry REST API v2
// Tries PATCH first (update existing); falls back to PUT (create-or-replace).
// Both methods require the object type to allow direct edits.
// ---------------------------------------------------------------------------

async function upsertObject(
  foundryUrl: string,
  token: string,
  ontologyRid: string,
  objectTypeApiName: string,
  primaryKey: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const encoded = encodeURIComponent(primaryKey);
  const url = `${foundryUrl}/api/v2/ontologies/${ontologyRid}/objects/${objectTypeApiName}/${encoded}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // PATCH: update existing object properties
  let res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ properties }),
  });

  // If PATCH not supported or object doesn't exist yet, try PUT
  if (res.status === 404 || res.status === 405 || res.status === 415) {
    res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ primaryKey, properties }),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Write failed [${objectTypeApiName}/${primaryKey}]: HTTP ${res.status} — ${errText.slice(0, 300)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Parallel batch upsert for a collection of objects
// ---------------------------------------------------------------------------

async function batchUpsert<T>(
  items: T[],
  foundryUrl: string,
  token: string,
  ontologyRid: string,
  objectTypeApiName: string,
  getKey: (item: T) => string,
  toProperties: (item: T) => Record<string, unknown>,
  label: string,
): Promise<{ synced: number; failed: number }> {
  const results = await Promise.allSettled(
    items.map(item =>
      upsertObject(
        foundryUrl,
        token,
        ontologyRid,
        objectTypeApiName,
        getKey(item),
        toProperties(item),
      )
    )
  );

  const synced = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  if (failed > 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .slice(0, 3)
      .map(r => r.reason?.message ?? String(r.reason));
    console.warn(chalk.yellow(`  ⚠  ${label}: ${failed} write(s) failed — ${errors.join(" | ")}`));
  }

  return { synced, failed };
}

// ---------------------------------------------------------------------------
// Property serializers — maps domain types to Foundry property maps.
// JSON-serialized arrays (primaryMacroDrivers, primaryMetricDrivers) are
// stored as strings because Foundry string-array properties require a
// multi-value type that may not be configured on every stack.
// ---------------------------------------------------------------------------

function indicatorProps(ind: MacroIndicator): Record<string, unknown> {
  return {
    seriesId:        ind.seriesId,
    name:            ind.name,
    source:          ind.source,
    category:        ind.category,
    latestValue:     ind.latestValue,
    latestDate:      ind.latestDate,
    unit:            ind.unit,
    priorValue:      ind.priorValue,
    priorDate:       ind.priorDate,
    periodDelta:     ind.periodDelta,
    periodDeltaPct:  ind.periodDeltaPct,
    yearLow:         ind.yearLow,
    yearHigh:        ind.yearHigh,
    yearPercentile:  ind.yearPercentile,
    signal:          ind.signal,
    signalRationale: ind.signalRationale,
    frequency:       ind.frequency,
    lastUpdated:     ind.lastUpdated,
    sourceUrl:       ind.sourceUrl,
  };
}

function sectorProps(s: SectorSnapshot): Record<string, unknown> {
  return {
    snapshotId:            s.snapshotId,
    sectorTicker:          s.sectorTicker,
    sectorName:            s.sectorName,
    date:                  s.date,
    dayChangePct:          s.dayChangePct,
    weekChangePct:         s.weekChangePct,
    monthChangePct:        s.monthChangePct,
    ytdChangePct:          s.ytdChangePct,
    relativeStrengthVsSPY: s.relativeStrengthVsSPY,
    macroRegime:           s.macroRegime,
    primaryMacroDrivers:   JSON.stringify(s.primaryMacroDrivers),
    sectorSignal:          s.sectorSignal,
    signalRationale:       s.signalRationale,
    ingestedAt:            s.ingestedAt,
  };
}

function cryptoMetricProps(m: CryptoMetric): Record<string, unknown> {
  return {
    metricId:        m.metricId,
    name:            m.name,
    category:        m.category,
    source:          m.source,
    unit:            m.unit,
    latestValue:     m.latestValue,
    latestDate:      m.latestDate,
    priorValue:      m.priorValue,
    periodDelta:     m.periodDelta,
    periodDeltaPct:  m.periodDeltaPct,
    signal:          m.signal,
    signalRationale: m.signalRationale,
    lastUpdated:     m.lastUpdated,
  };
}

function categoryProps(c: CategorySnapshot): Record<string, unknown> {
  return {
    snapshotId:           c.snapshotId,
    categoryName:         c.categoryName,
    categorySlug:         c.categorySlug,
    totalMarketCapUsd:    c.totalMarketCapUsd,
    dayChangePct:         c.dayChangePct,
    dominancePct:         c.dominancePct,
    cryptoRegime:         c.cryptoRegime,
    primaryMetricDrivers: JSON.stringify(c.primaryMetricDrivers),
    categorySignal:       c.categorySignal,
    signalRationale:      c.signalRationale,
    ingestedAt:           c.ingestedAt,
  };
}

// ---------------------------------------------------------------------------
// Dry-run console output
// ---------------------------------------------------------------------------

function printIndicator(ind: MacroIndicator): void {
  const signalColor =
    ind.signal === "BULLISH" ? chalk.green :
    ind.signal === "BEARISH" ? chalk.red :
    chalk.yellow;

  const delta = ind.periodDelta !== null
    ? `${ind.periodDelta > 0 ? "+" : ""}${ind.periodDelta.toFixed(3)} (${ind.periodDeltaPct?.toFixed(2)}%)`
    : "n/a";
  const percentile = ind.yearPercentile !== null
    ? `${(ind.yearPercentile * 100).toFixed(0)}th pctile`
    : "";

  console.log(
    `    ${chalk.cyan(ind.seriesId.padEnd(14))}  ` +
    `${chalk.white(String(ind.latestValue).padEnd(10))}  ` +
    `${chalk.dim(delta.padEnd(20))}  ` +
    `${signalColor(ind.signal.padEnd(8))}  ` +
    `${chalk.dim(percentile)}`
  );
}

function printSector(snap: SectorSnapshot): void {
  const signalColor =
    snap.sectorSignal === "BULLISH" ? chalk.green :
    snap.sectorSignal === "BEARISH" ? chalk.red :
    chalk.yellow;

  const ytd = snap.ytdChangePct !== null
    ? `YTD: ${snap.ytdChangePct > 0 ? "+" : ""}${snap.ytdChangePct.toFixed(2)}%` : "";
  const rs = snap.relativeStrengthVsSPY !== null
    ? ` RS: ${snap.relativeStrengthVsSPY > 0 ? "+" : ""}${snap.relativeStrengthVsSPY.toFixed(2)}%` : "";

  console.log(
    `    ${chalk.cyan(snap.sectorTicker.padEnd(6))}  ` +
    `${chalk.white(snap.sectorName.padEnd(26))}  ` +
    `${signalColor(snap.sectorSignal.padEnd(8))}  ` +
    `${chalk.dim(ytd + rs)}`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SyncResult = {
  indicatorsSynced: number;
  sectorsSynced: number;
  cryptoSynced: number;
  categoriesSynced: number;
};

export async function syncToFoundry(
  indicators: MacroIndicator[],
  sectors: SectorSnapshot[],
  cryptoMetrics: CryptoMetric[],
  categories: CategorySnapshot[],
  cfg: Config
): Promise<SyncResult> {
  if (cfg.DRY_RUN) {
    const total = indicators.length + sectors.length + cryptoMetrics.length + categories.length;
    console.log(chalk.yellow(
      `\n[DRY RUN] Would write ${total} objects to Foundry Ontology:`
    ));
    console.log(chalk.dim(
      `  MacroIndicator: ${indicators.length}  |  SectorSnapshot: ${sectors.length}  |  ` +
      `CryptoMetric: ${cryptoMetrics.length}  |  CategorySnapshot: ${categories.length}\n`
    ));

    console.log(chalk.bold("  MACRO INDICATORS"));
    console.log(chalk.dim(`  ${"Series ID".padEnd(14)}  ${"Value".padEnd(10)}  ${"Delta".padEnd(20)}  Signal    52w Range`));
    console.log(chalk.dim(`  ${"-".repeat(72)}`));
    indicators.forEach(printIndicator);

    console.log(chalk.bold("\n  SECTOR SNAPSHOTS"));
    console.log(chalk.dim(`  ${"Ticker".padEnd(6)}  ${"Sector".padEnd(26)}  Signal    Performance`));
    console.log(chalk.dim(`  ${"-".repeat(65)}`));
    sectors.forEach(printSector);

    const macroRegime = sectors[0]?.macroRegime;
    if (macroRegime) {
      const col =
        macroRegime === "EXPANSION" ? chalk.green :
        macroRegime === "RECOVERY"  ? chalk.cyan  :
        macroRegime === "SLOWDOWN"  ? chalk.yellow :
        chalk.red;
      console.log(chalk.bold(`\n  Macro Regime: ${col(macroRegime)}`));
    }

    return {
      indicatorsSynced: indicators.length,
      sectorsSynced:    sectors.length,
      cryptoSynced:     cryptoMetrics.length,
      categoriesSynced: categories.length,
    };
  }

  // ── Live Foundry writes ──────────────────────────────────────────────────
  const foundryUrl   = cfg.FOUNDRY_URL;
  const foundryToken = cfg.FOUNDRY_TOKEN;

  if (!foundryUrl || !foundryToken) {
    throw new Error(
      "FOUNDRY_URL and FOUNDRY_TOKEN are required for live writes. " +
      "Set DRY_RUN=true to test without credentials."
    );
  }

  console.log(chalk.cyan(`\n[Foundry] Syncing to ${foundryUrl} …`));

  const ontologyRid = await getOntologyRid(foundryUrl, foundryToken);
  console.log(chalk.dim(`  Ontology: ${ontologyRid}`));

  const [indResult, secResult, cryptoResult, catResult] = await Promise.all([
    batchUpsert(
      indicators, foundryUrl, foundryToken, ontologyRid,
      OBJECT_TYPES.MACRO_INDICATOR.apiName,
      i => i.seriesId, indicatorProps, "MacroIndicator",
    ),
    batchUpsert(
      sectors, foundryUrl, foundryToken, ontologyRid,
      OBJECT_TYPES.SECTOR_SNAPSHOT.apiName,
      s => s.snapshotId, sectorProps, "SectorSnapshot",
    ),
    batchUpsert(
      cryptoMetrics, foundryUrl, foundryToken, ontologyRid,
      OBJECT_TYPES.CRYPTO_METRIC.apiName,
      m => m.metricId, cryptoMetricProps, "CryptoMetric",
    ),
    batchUpsert(
      categories, foundryUrl, foundryToken, ontologyRid,
      OBJECT_TYPES.CATEGORY_SNAPSHOT.apiName,
      c => c.snapshotId, categoryProps, "CategorySnapshot",
    ),
  ]);

  console.log(chalk.green(
    `[Foundry] Sync complete — ` +
    `Indicators: ${indResult.synced}, Sectors: ${secResult.synced}, ` +
    `Crypto: ${cryptoResult.synced}, Categories: ${catResult.synced}`
  ));

  return {
    indicatorsSynced: indResult.synced,
    sectorsSynced:    secResult.synced,
    cryptoSynced:     cryptoResult.synced,
    categoriesSynced: catResult.synced,
  };
}
