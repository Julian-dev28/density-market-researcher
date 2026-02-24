// ============================================================
// Domain types — map directly to Foundry Object Types
//
// Three linked Object Types form the core research ontology:
//
//   MacroIndicator ──► SectorSnapshot ──► WatchlistCompany
//
// This graph structure is what makes Foundry powerful for
// research: analysts can traverse from a Fed rate decision
// all the way to affected companies in a single query.
// ============================================================

export type IndicatorCategory =
  | "INTEREST_RATES"
  | "INFLATION"
  | "EMPLOYMENT"
  | "GROWTH"
  | "CREDIT"
  | "HOUSING"
  | "TRADE"
  | "SENTIMENT";

export type SignalDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Regime = "EXPANSION" | "SLOWDOWN" | "CONTRACTION" | "RECOVERY";

// ---------------------------------------------------------------------------
// Object Type: macro_indicator
// A single economic time-series with derived signal output.
// Primary key: seriesId (FRED series ID)
// ---------------------------------------------------------------------------
export interface MacroIndicator {
  seriesId: string;
  name: string;
  source: "FRED" | "MANUAL";
  category: IndicatorCategory;

  latestValue: number;
  latestDate: string;
  unit: string;
  priorValue: number | null;
  priorDate: string | null;

  periodDelta: number | null;
  periodDeltaPct: number | null;
  yearLow: number | null;
  yearHigh: number | null;
  /** Position in 52-week range: 0 = at low, 1 = at high */
  yearPercentile: number | null;

  signal: SignalDirection;
  signalRationale: string;

  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  lastUpdated: string;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Object Type: sector_snapshot
// Point-in-time performance for a GICS sector.
// Primary key: snapshotId (sectorTicker + date)
// Linked to MacroIndicator via: sector_macro_driver Link Type
// ---------------------------------------------------------------------------
export interface SectorSnapshot {
  snapshotId: string;
  sectorTicker: string;
  sectorName: string;
  date: string;

  dayChangePct: number | null;
  weekChangePct: number | null;
  monthChangePct: number | null;
  ytdChangePct: number | null;
  relativeStrengthVsSPY: number | null;

  macroRegime: Regime | null;
  /** FRED series IDs of the primary macro drivers for this sector */
  primaryMacroDrivers: string[];

  sectorSignal: SignalDirection;
  signalRationale: string;
  ingestedAt: string;
}

// ---------------------------------------------------------------------------
// Object Type: watchlist_company
// A tracked company with macro sensitivity scores.
// Primary key: ticker
// Linked to SectorSnapshot via: company_in_sector Link Type
// ---------------------------------------------------------------------------
export interface WatchlistCompany {
  ticker: string;
  name: string;
  sectorTicker: string;
  subIndustry: string | null;
  marketCapBn: number | null;
  /** 0–1 sensitivity scores: higher = more exposed to that factor */
  rateSensitivity: number | null;
  inflationSensitivity: number | null;
  usdSensitivity: number | null;
  analystNotes: string | null;
  addedAt: string;
  lastReviewedAt: string | null;
}

// ---------------------------------------------------------------------------
// Raw FRED API types
// ---------------------------------------------------------------------------
export interface FREDObservation {
  date: string;
  value: string; // "." means missing data point
}

export interface FREDSeriesResponse {
  units: string;
  count: number;
  observations: FREDObservation[];
}

export interface FREDSeriesInfo {
  id: string;
  title: string;
  frequency_short: string;
  units: string;
  last_updated: string;
}

// ---------------------------------------------------------------------------
// Crypto domain types
// ---------------------------------------------------------------------------

export type CryptoMetricCategory =
  | "MARKET_STRUCTURE"
  | "SENTIMENT"
  | "DEFI"
  | "STABLECOINS"
  | "LIQUIDITY";

export type CryptoRegime = "BULL_MARKET" | "ALT_SEASON" | "RISK_OFF" | "BEAR_MARKET";

export interface CryptoMetric {
  metricId: string;
  name: string;
  category: CryptoMetricCategory;
  source: string;
  unit: string;
  latestValue: number;
  latestDate: string;
  priorValue: number | null;
  periodDelta: number | null;
  periodDeltaPct: number | null;
  signal: SignalDirection;
  signalRationale: string;
  lastUpdated: string;
}

export interface CategorySnapshot {
  snapshotId: string;
  categoryName: string;
  categorySlug: string;
  totalMarketCapUsd: number | null;
  dayChangePct: number | null;
  dominancePct: number | null;
  cryptoRegime: CryptoRegime | null;
  primaryMetricDrivers: string[];
  categorySignal: SignalDirection;
  signalRationale: string;
  ingestedAt: string;
}

// ---------------------------------------------------------------------------
// Raw crypto API types
// ---------------------------------------------------------------------------

export interface CMCGlobalMetrics {
  status: { timestamp: string; error_code: number };
  data: {
    active_cryptocurrencies: number;
    btc_dominance: number;
    eth_dominance: number;
    quote: {
      USD: {
        total_market_cap: number;
        total_volume_24h: number;
        altcoin_market_cap: number;
        defi_market_cap: number;
        defi_volume_24h: number;
        defi_24h_percentage_change: number;
        stablecoin_market_cap: number;
        stablecoin_volume_24h: number;
        stablecoin_24h_percentage_change: number;
        total_market_cap_yesterday_percentage_change: number;
        last_updated: string;
      };
    };
  };
}

export interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

export interface DeFiLlamaTVLPoint {
  date: number;
  tvl: number;
}

// ---------------------------------------------------------------------------
// Raw Alpha Vantage sector API types
// ---------------------------------------------------------------------------
export interface AlphaVantageSectorResponse {
  "Meta Data": { "Last Refreshed": string };
  "Rank A: Real-Time Performance": Record<string, string>;
  "Rank B: 1 Day Performance": Record<string, string>;
  "Rank C: 5 Day Performance": Record<string, string>;
  "Rank D: 1 Month Performance": Record<string, string>;
  "Rank F: Year-to-Date (YTD) Performance": Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pipeline metadata
// ---------------------------------------------------------------------------
export interface PipelineRun {
  runId: string;
  startedAt: string;
  completedAt?: string;
  indicatorsProcessed: number;
  sectorsProcessed: number;
  totalSynced: number;
  totalFailed: number;
  errors: Array<{ source: string; message: string }>;
}
