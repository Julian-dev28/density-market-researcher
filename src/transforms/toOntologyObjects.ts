import type {
  MacroIndicator,
  SectorSnapshot,
  SignalDirection,
  Regime,
  FREDObservation,
  AlphaVantageSectorResponse,
} from "../types/index.js";
import type { FREDFetchResult } from "../ingestion/fred.js";
import { SERIES_BY_ID } from "../ingestion/fredRegistry.js";
import { SECTOR_MAP } from "../ingestion/sectors.js";

// ============================================================
// Transform Layer
//
// All functions here are pure and side-effect-free.
// They accept raw API responses and return canonical Ontology
// objects — no Foundry dependencies required to test them.
// ============================================================

const NOW = () => new Date().toISOString();
const TODAY = () => new Date().toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseObs(obs: FREDObservation[]): Array<{ date: string; value: number }> {
  return obs
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return 0;
  return parseFloat(((current - prior) / Math.abs(prior) * 100).toFixed(4));
}

function percentileInRange(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return parseFloat(((value - min) / (max - min)).toFixed(4));
}

/**
 * Derives a signal direction from a macro indicator.
 * Logic is category-aware — rising rates are bearish for equities,
 * rising employment is bullish, etc.
 */
function deriveMacroSignal(
  seriesId: string,
  delta: number | null,
  yearPercentile: number | null
): { signal: SignalDirection; rationale: string } {
  const def = SERIES_BY_ID.get(seriesId);
  if (!def || delta === null) {
    return { signal: "NEUTRAL", rationale: "Insufficient data for signal." };
  }

  const rising = delta > 0;
  const highRegime = yearPercentile !== null && yearPercentile > 0.7;
  const lowRegime = yearPercentile !== null && yearPercentile < 0.3;

  // For inverse-sentiment series (rates, inflation): rising = BEARISH
  if (def.inverseSentiment) {
    if (rising && highRegime) {
      return {
        signal: "BEARISH",
        rationale: `${def.name} rising and at elevated levels (${(yearPercentile! * 100).toFixed(0)}th percentile of 52-week range).`,
      };
    }
    if (!rising && lowRegime) {
      return {
        signal: "BULLISH",
        rationale: `${def.name} declining from historically low levels — easing pressure on risk assets.`,
      };
    }
    if (rising) {
      return { signal: "BEARISH", rationale: `${def.name} trending higher — headwind for equities.` };
    }
    return { signal: "BULLISH", rationale: `${def.name} trending lower — tailwind for risk assets.` };
  }

  // For positive-sentiment series (employment, growth, sentiment): rising = BULLISH
  if (rising && highRegime) {
    return {
      signal: "BULLISH",
      rationale: `${def.name} rising and near 52-week highs — supportive macro backdrop.`,
    };
  }
  if (!rising && lowRegime) {
    return {
      signal: "BEARISH",
      rationale: `${def.name} declining and near 52-week lows — deteriorating conditions.`,
    };
  }
  if (rising) {
    return { signal: "BULLISH", rationale: `${def.name} trending higher.` };
  }
  return { signal: "BEARISH", rationale: `${def.name} trending lower.` };
}

/** Infers a macro regime from key indicators available in the pipeline. */
export function inferRegime(indicators: MacroIndicator[]): Regime {
  const byId = new Map(indicators.map((i) => [i.seriesId, i]));

  const unrate = byId.get("UNRATE");
  const dff = byId.get("DFF");
  const spread = byId.get("T10Y2Y");
  const sentiment = byId.get("UMCSENT");

  let score = 0; // positive = expansion, negative = contraction

  if (unrate) {
    const risingUnemployment = (unrate.periodDelta ?? 0) > 0;
    score += risingUnemployment ? -2 : 1;
  }
  if (dff) {
    const cuttingRates = (dff.periodDelta ?? 0) < 0;
    score += cuttingRates ? 1 : -1;
  }
  if (spread) {
    const inverted = spread.latestValue < 0;
    score += inverted ? -1 : 1;
  }
  if (sentiment) {
    const weakSentiment = sentiment.latestValue < 70;
    score += weakSentiment ? -1 : 1;
  }

  if (score >= 3) return "EXPANSION";
  if (score >= 1) return "RECOVERY";
  if (score <= -3) return "CONTRACTION";
  return "SLOWDOWN";
}

// ---------------------------------------------------------------------------
// MacroIndicator transform
// ---------------------------------------------------------------------------

export function transformFREDResult(result: FREDFetchResult): MacroIndicator | null {
  const def = SERIES_BY_ID.get(result.seriesId);
  const obs = parseObs(result.observations.observations);

  if (obs.length === 0) return null;

  const latest = obs[0];
  const prior = obs.length > 1 ? obs[1] : null;
  const values = obs.map((o) => o.value);
  const yearMin = Math.min(...values);
  const yearMax = Math.max(...values);

  const delta = prior ? parseFloat((latest.value - prior.value).toFixed(6)) : null;
  const deltaPct = prior ? pctChange(latest.value, prior.value) : null;
  const yearPercentile = percentileInRange(latest.value, yearMin, yearMax);

  const { signal, rationale } = deriveMacroSignal(result.seriesId, delta, yearPercentile);

  const freqMap: Record<string, MacroIndicator["frequency"]> = {
    D: "DAILY", W: "WEEKLY", M: "MONTHLY", Q: "QUARTERLY",
  };

  return {
    seriesId: result.seriesId,
    name: def?.name ?? result.info.title,
    source: "FRED",
    category: def?.category ?? "GROWTH",
    latestValue: latest.value,
    latestDate: latest.date,
    unit: result.info.units,
    priorValue: prior?.value ?? null,
    priorDate: prior?.date ?? null,
    periodDelta: delta,
    periodDeltaPct: deltaPct,
    yearLow: yearMin,
    yearHigh: yearMax,
    yearPercentile,
    signal,
    signalRationale: rationale,
    frequency: freqMap[result.info.frequency_short] ?? "MONTHLY",
    lastUpdated: result.info.last_updated,
    sourceUrl: `https://fred.stlouisfed.org/series/${result.seriesId}`,
  };
}

// ---------------------------------------------------------------------------
// SectorSnapshot transform
// ---------------------------------------------------------------------------

// Map from Alpha Vantage sector names to SPDR ticker symbols
const AV_NAME_TO_TICKER: Record<string, string> = {
  "Energy": "XLE",
  "Utilities": "XLU",
  "Financials": "XLF",
  "Technology": "XLK",
  "Health Care": "XLV",
  "Industrials": "XLI",
  "Consumer Discretionary": "XLY",
  "Materials": "XLB",
  "Consumer Staples": "XLP",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

function parsePct(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : parseFloat((n * 100).toFixed(4));
}

function sectorSignal(
  dayChangePct: number | null,
  monthChangePct: number | null,
  rsVsSPY: number | null
): { signal: SignalDirection; rationale: string } {
  if (dayChangePct === null) return { signal: "NEUTRAL", rationale: "No performance data." };

  const bullishCount =
    (dayChangePct > 0 ? 1 : 0) +
    ((monthChangePct ?? 0) > 0 ? 1 : 0) +
    ((rsVsSPY ?? 0) > 0 ? 1 : 0);

  if (bullishCount >= 3) {
    return { signal: "BULLISH", rationale: `Outperforming across 1-day, 1-month, and vs SPY.` };
  }
  if (bullishCount === 0) {
    return { signal: "BEARISH", rationale: `Underperforming across all measured timeframes.` };
  }
  return {
    signal: "NEUTRAL",
    rationale: `Mixed signals — ${bullishCount}/3 timeframes positive.`,
  };
}

export function transformSectorData(
  avData: AlphaVantageSectorResponse,
  indicators: MacroIndicator[]
): SectorSnapshot[] {
  const date = avData["Meta Data"]["Last Refreshed"];
  const regime = inferRegime(indicators);
  const spyYTD = parsePct(avData["Rank F: Year-to-Date (YTD) Performance"]["S&P 500"]);
  const snapshots: SectorSnapshot[] = [];

  for (const [avName, ticker] of Object.entries(AV_NAME_TO_TICKER)) {
    const meta = SECTOR_MAP[ticker];
    if (!meta) continue;

    const dayPct = parsePct(avData["Rank B: 1 Day Performance"][avName]);
    const weekPct = parsePct(avData["Rank C: 5 Day Performance"][avName]);
    const monthPct = parsePct(avData["Rank D: 1 Month Performance"][avName]);
    const ytdPct = parsePct(avData["Rank F: Year-to-Date (YTD) Performance"][avName]);
    const rsVsSPY = ytdPct !== null && spyYTD !== null
      ? parseFloat((ytdPct - spyYTD).toFixed(4))
      : null;

    const { signal, rationale } = sectorSignal(dayPct, monthPct, rsVsSPY);

    snapshots.push({
      snapshotId: `${ticker}_${date}`,
      sectorTicker: ticker,
      sectorName: meta.name,
      date,
      dayChangePct: dayPct,
      weekChangePct: weekPct,
      monthChangePct: monthPct,
      ytdChangePct: ytdPct,
      relativeStrengthVsSPY: rsVsSPY,
      macroRegime: regime,
      primaryMacroDrivers: meta.primaryMacroDrivers,
      sectorSignal: signal,
      signalRationale: rationale,
      ingestedAt: NOW(),
    });
  }

  return snapshots;
}
