// ============================================================
// Foundry Ontology Reader — web app data layer
//
// Reads MacroIndicator, SectorSnapshot, CryptoMetric, and
// CategorySnapshot objects from Palantir Foundry using the
// REST API v2 with Bearer token authentication.
//
// Architecture:
//   CLI pipeline → writes → Foundry Ontology
//   Web app      → reads  → Foundry Ontology → Dashboard
//
// Requires env vars (set in Vercel project settings):
//   FOUNDRY_URL   — e.g. https://density.usw-3.palantirfoundry.com
//   FOUNDRY_TOKEN — User or service-account Bearer token
//
// API reference:
//   https://www.palantir.com/docs/foundry/api/ontology-resources/
// ============================================================

import type {
  MacroIndicator,
  SectorSnapshot,
  CryptoMetric,
  CategorySnapshot,
  PipelineOutput,
} from "./types";

// Object type API names must match the Foundry Ontology Manager config
const OBJECT_TYPE = {
  MACRO_INDICATOR:   "macro_indicator",
  SECTOR_SNAPSHOT:   "sector_snapshot",
  CRYPTO_METRIC:     "crypto_metric",
  CATEGORY_SNAPSHOT: "category_snapshot",
} as const;

// ---------------------------------------------------------------------------
// Configuration check
// ---------------------------------------------------------------------------

export function isFoundryConfigured(): boolean {
  return !!(process.env.FOUNDRY_URL && process.env.FOUNDRY_TOKEN);
}

// ---------------------------------------------------------------------------
// Ontology RID discovery
// Foundry REST v2 requires an ontology identifier as the path prefix.
// We call GET /api/v2/ontologies to discover it once per process.
// ---------------------------------------------------------------------------

let _cachedOntologyRid: string | null = null;

async function getOntologyRid(): Promise<string | null> {
  if (_cachedOntologyRid) return _cachedOntologyRid;

  const foundryUrl   = process.env.FOUNDRY_URL!;
  const foundryToken = process.env.FOUNDRY_TOKEN!;

  try {
    const res = await fetch(`${foundryUrl}/api/v2/ontologies`, {
      headers: { Authorization: `Bearer ${foundryToken}` },
      next: { revalidate: 86_400 }, // re-discover once per day
    });

    if (!res.ok) {
      console.warn(`[Foundry] Ontology discovery failed: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json() as {
      data?: Array<{ rid: string; apiName: string }>;
      ontologies?: Array<{ rid: string; apiName: string }>;
    };

    const list = json.data ?? json.ontologies ?? [];
    if (list.length === 0) {
      console.warn("[Foundry] No ontologies returned from API");
      return null;
    }

    _cachedOntologyRid = list[0].apiName ?? list[0].rid;
    return _cachedOntologyRid;
  } catch (err) {
    console.warn("[Foundry] Ontology discovery error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic object list fetch with Next.js ISR caching
// ---------------------------------------------------------------------------

async function listObjects(ontologyRid: string, objectType: string): Promise<Record<string, unknown>[]> {
  const foundryUrl   = process.env.FOUNDRY_URL!;
  const foundryToken = process.env.FOUNDRY_TOKEN!;

  const url = `${foundryUrl}/api/v2/ontologies/${ontologyRid}/objects/${objectType}?pageSize=200`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${foundryToken}` },
    next: { revalidate: 300 }, // ISR: refresh every 5 minutes
  });

  if (!res.ok) {
    throw new Error(`[Foundry] Read failed [${objectType}]: HTTP ${res.status}`);
  }

  const data = await res.json() as { data?: unknown[] };
  const items = data.data ?? [];

  // Foundry v2 wraps properties under a `properties` key; fall back to the
  // object itself if the stack returns a flat structure.
  return items.map((obj) => {
    const o = obj as Record<string, unknown>;
    return (o.properties as Record<string, unknown>) ?? o;
  });
}

// ---------------------------------------------------------------------------
// Type mappers — safely coerce Foundry property values to domain types
// ---------------------------------------------------------------------------

function n(v: unknown): number  { return Number(v ?? 0); }
function s(v: unknown): string  { return String(v ?? ""); }
function nullable(v: unknown): number | null { return v != null ? Number(v) : null; }
function str(v: unknown): string | null { return v != null ? String(v) : null; }
function jsonArr(v: unknown): string[] {
  try { return JSON.parse(String(v ?? "[]")); } catch { return []; }
}

function mapIndicator(p: Record<string, unknown>): MacroIndicator {
  return {
    seriesId:        s(p.seriesId),
    name:            s(p.name),
    source:          (p.source as "FRED" | "MANUAL") ?? "FRED",
    category:        (p.category as MacroIndicator["category"]) ?? "GROWTH",
    latestValue:     n(p.latestValue),
    latestDate:      s(p.latestDate),
    unit:            s(p.unit),
    priorValue:      nullable(p.priorValue),
    priorDate:       str(p.priorDate),
    periodDelta:     nullable(p.periodDelta),
    periodDeltaPct:  nullable(p.periodDeltaPct),
    yearLow:         nullable(p.yearLow),
    yearHigh:        nullable(p.yearHigh),
    yearPercentile:  nullable(p.yearPercentile),
    signal:          (p.signal as "BULLISH" | "BEARISH" | "NEUTRAL") ?? "NEUTRAL",
    signalRationale: s(p.signalRationale),
    frequency:       (p.frequency as MacroIndicator["frequency"]) ?? "MONTHLY",
    lastUpdated:     s(p.lastUpdated),
    sourceUrl:       s(p.sourceUrl),
  };
}

function mapSector(p: Record<string, unknown>): SectorSnapshot {
  return {
    snapshotId:            s(p.snapshotId),
    sectorTicker:          s(p.sectorTicker),
    sectorName:            s(p.sectorName),
    date:                  s(p.date),
    dayChangePct:          nullable(p.dayChangePct),
    weekChangePct:         nullable(p.weekChangePct),
    monthChangePct:        nullable(p.monthChangePct),
    ytdChangePct:          nullable(p.ytdChangePct),
    relativeStrengthVsSPY: nullable(p.relativeStrengthVsSPY),
    macroRegime:           (p.macroRegime as SectorSnapshot["macroRegime"]) ?? null,
    primaryMacroDrivers:   jsonArr(p.primaryMacroDrivers),
    sectorSignal:          (p.sectorSignal as "BULLISH" | "BEARISH" | "NEUTRAL") ?? "NEUTRAL",
    signalRationale:       s(p.signalRationale),
    ingestedAt:            s(p.ingestedAt),
  };
}

function mapCryptoMetric(p: Record<string, unknown>): CryptoMetric {
  return {
    metricId:        s(p.metricId),
    name:            s(p.name),
    category:        (p.category as CryptoMetric["category"]) ?? "MARKET_STRUCTURE",
    source:          s(p.source),
    unit:            s(p.unit),
    latestValue:     n(p.latestValue),
    latestDate:      s(p.latestDate),
    priorValue:      nullable(p.priorValue),
    periodDelta:     nullable(p.periodDelta),
    periodDeltaPct:  nullable(p.periodDeltaPct),
    signal:          (p.signal as "BULLISH" | "BEARISH" | "NEUTRAL") ?? "NEUTRAL",
    signalRationale: s(p.signalRationale),
    lastUpdated:     s(p.lastUpdated),
  };
}

function mapCategory(p: Record<string, unknown>): CategorySnapshot {
  return {
    snapshotId:           s(p.snapshotId),
    categoryName:         s(p.categoryName),
    categorySlug:         s(p.categorySlug),
    totalMarketCapUsd:    nullable(p.totalMarketCapUsd),
    dayChangePct:         nullable(p.dayChangePct),
    dominancePct:         nullable(p.dominancePct),
    cryptoRegime:         (p.cryptoRegime as CategorySnapshot["cryptoRegime"]) ?? null,
    primaryMetricDrivers: jsonArr(p.primaryMetricDrivers),
    categorySignal:       (p.categorySignal as "BULLISH" | "BEARISH" | "NEUTRAL") ?? "NEUTRAL",
    signalRationale:      s(p.signalRationale),
    ingestedAt:           s(p.ingestedAt),
  };
}

// ---------------------------------------------------------------------------
// Public API
// Returns null if Foundry is not configured, credentials are invalid,
// or the Ontology contains no data yet (indicating the CLI hasn't run).
// ---------------------------------------------------------------------------

export async function getFoundryData(): Promise<PipelineOutput | null> {
  if (!isFoundryConfigured()) return null;

  const ontologyRid = await getOntologyRid();
  if (!ontologyRid) return null;

  try {
    const [rawIndicators, rawSectors, rawCrypto, rawCategories] = await Promise.all([
      listObjects(ontologyRid, OBJECT_TYPE.MACRO_INDICATOR),
      listObjects(ontologyRid, OBJECT_TYPE.SECTOR_SNAPSHOT),
      listObjects(ontologyRid, OBJECT_TYPE.CRYPTO_METRIC).catch(() => [] as Record<string, unknown>[]),
      listObjects(ontologyRid, OBJECT_TYPE.CATEGORY_SNAPSHOT).catch(() => [] as Record<string, unknown>[]),
    ]);

    // If Foundry has no objects yet (CLI hasn't run), fall back to external APIs
    if (rawIndicators.length === 0 && rawSectors.length === 0) {
      console.log("[Foundry] Ontology is empty — falling back to external APIs");
      return null;
    }

    return {
      indicators:   rawIndicators.map(mapIndicator),
      sectors:      rawSectors.map(mapSector),
      cryptoMetrics: rawCrypto.map(mapCryptoMetric),
      categories:   rawCategories.map(mapCategory),
      generatedAt:  new Date().toISOString(),
      dataSource:   "FOUNDRY",
    };
  } catch (err) {
    console.warn(
      "[Foundry] Read failed, falling back to external APIs:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
