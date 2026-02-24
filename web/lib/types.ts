// ============================================================
// Shared domain types — copied from src/types/index.ts
// Kept here so web/ is self-contained for Vercel deployment.
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
  yearPercentile: number | null;
  signal: SignalDirection;
  signalRationale: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  lastUpdated: string;
  sourceUrl: string;
}

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
  primaryMacroDrivers: string[];
  sectorSignal: SignalDirection;
  signalRationale: string;
  ingestedAt: string;
}

export type CryptoMetricCategory =
  | "MARKET_STRUCTURE"
  | "SENTIMENT"
  | "DEFI"
  | "STABLECOINS"
  | "LIQUIDITY";

export type CryptoRegime =
  | "BULL_MARKET"
  | "ALT_SEASON"
  | "RISK_OFF"
  | "BEAR_MARKET";

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

export interface PipelineOutput {
  indicators: MacroIndicator[];
  sectors: SectorSnapshot[];
  cryptoMetrics: CryptoMetric[];
  categories: CategorySnapshot[];
  generatedAt: string;
}
