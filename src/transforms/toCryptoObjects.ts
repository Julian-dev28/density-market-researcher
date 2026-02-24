import type {
  CryptoMetric,
  CategorySnapshot,
  SignalDirection,
  CryptoRegime,
  CMCGlobalMetrics,
} from "../types/index.js";
import type { DeFiLlamaResult } from "../ingestion/defillama.js";
import type { FearGreedResult } from "../ingestion/feargreed.js";
import { METRICS_BY_ID } from "../ingestion/cryptoRegistry.js";

// ============================================================
// Crypto Transform Layer
//
// Pure functions — no I/O. Accepts raw API responses and
// returns canonical CryptoMetric and CategorySnapshot objects.
// ============================================================

const NOW = () => new Date().toISOString();
const TODAY = () => new Date().toISOString().split("T")[0];

function pctChange(current: number, prior: number): number {
  if (prior === 0) return 0;
  return parseFloat((((current - prior) / Math.abs(prior)) * 100).toFixed(4));
}

function fmt(n: number): number {
  return parseFloat(n.toFixed(4));
}

// ---------------------------------------------------------------------------
// Signal derivation
// ---------------------------------------------------------------------------

function deriveCryptoSignal(
  metricId: string,
  value: number,
  priorValue: number | null
): { signal: SignalDirection; rationale: string } {
  const def = METRICS_BY_ID.get(metricId);
  if (!def) return { signal: "NEUTRAL", rationale: "Unknown metric." };

  const delta = priorValue !== null ? value - priorValue : null;
  const rising = delta !== null ? delta > 0 : null;

  // Special-case logic per metric
  switch (metricId) {
    case "BTC_DOMINANCE":
      if (value > 60) return { signal: "BEARISH", rationale: `BTC dominance at ${value.toFixed(1)}% — capital concentrated in BTC, risk-off for alts.` };
      if (value < 45) return { signal: "BULLISH", rationale: `BTC dominance at ${value.toFixed(1)}% — alt season conditions, capital rotating into alts.` };
      return { signal: "NEUTRAL", rationale: `BTC dominance at ${value.toFixed(1)}% — balanced market structure.` };

    case "FEAR_GREED":
      if (value <= 25) return { signal: "BULLISH", rationale: `Extreme Fear (${value}) — historically a contrarian buy signal.` };
      if (value >= 75) return { signal: "BEARISH", rationale: `Extreme Greed (${value}) — historically a contrarian sell signal.` };
      if (value <= 40) return { signal: "BULLISH", rationale: `Fear zone (${value}) — market oversold, recovery possible.` };
      if (value >= 65) return { signal: "BEARISH", rationale: `Greed zone (${value}) — caution, elevated positioning.` };
      return { signal: "NEUTRAL", rationale: `Neutral sentiment (${value}).` };

    case "TOTAL_VOLUME_24H": {
      const volB = value / 1e9;
      if (rising === null) {
        if (volB > 120) return { signal: "BULLISH", rationale: `High 24h volume ($${volB.toFixed(0)}B) — elevated market activity.` };
        if (volB < 60)  return { signal: "BEARISH", rationale: `Low 24h volume ($${volB.toFixed(0)}B) — weak market participation.` };
        return { signal: "NEUTRAL", rationale: `24h volume at $${volB.toFixed(0)}B — moderate activity.` };
      }
      const pct = pctChange(value, priorValue!);
      if (rising && pct > 20) return { signal: "BULLISH", rationale: `24h volume surged +${pct.toFixed(1)}% vs yesterday ($${volB.toFixed(0)}B) — strong participation.` };
      if (!rising && pct < -20) return { signal: "BEARISH", rationale: `24h volume collapsed ${pct.toFixed(1)}% vs yesterday ($${volB.toFixed(0)}B) — weak participation.` };
      if (rising) return { signal: "BULLISH", rationale: `24h volume up ${pct.toFixed(1)}% vs yesterday ($${volB.toFixed(0)}B).` };
      return { signal: "NEUTRAL", rationale: `24h volume down ${pct.toFixed(1)}% vs yesterday ($${volB.toFixed(0)}B).` };
    }

    case "STABLECOIN_MARKET_CAP":
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient data." };
      if (rising) return { signal: "BULLISH", rationale: `Stablecoin supply growing — dry powder accumulating, bullish for deployment.` };
      return { signal: "NEUTRAL", rationale: `Stablecoin supply stable/declining.` };

    case "DEFI_TVL":
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient TVL data." };
      if (rising) return { signal: "BULLISH", rationale: `DeFi TVL rising — capital flowing into protocols.` };
      return { signal: "BEARISH", rationale: `DeFi TVL declining — capital leaving DeFi ecosystem.` };

    default: {
      // Generic: use delta direction + inverseSentiment flag
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient data." };
      const bullishDirection = def.inverseSentiment ? !rising : rising;
      const signal: SignalDirection = bullishDirection ? "BULLISH" : "BEARISH";
      return {
        signal,
        rationale: `${def.name} ${rising ? "rising" : "declining"} ${delta !== null ? `(${delta > 0 ? "+" : ""}${pctChange(value, priorValue!).toFixed(2)}%)` : ""}.`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Regime inference
// ---------------------------------------------------------------------------

export function inferCryptoRegime(metrics: CryptoMetric[]): CryptoRegime {
  const byId = new Map(metrics.map((m) => [m.metricId, m]));

  const fearGreed = byId.get("FEAR_GREED");
  const btcDominance = byId.get("BTC_DOMINANCE");
  const totalMC = byId.get("TOTAL_MARKET_CAP");
  const tvl = byId.get("DEFI_TVL");

  let score = 0;

  if (fearGreed) {
    if (fearGreed.latestValue >= 65) score += 2;
    else if (fearGreed.latestValue >= 50) score += 1;
    else if (fearGreed.latestValue <= 25) score -= 2;
    else score -= 1;
  }

  if (btcDominance) {
    // Low dominance (<48%) = alt season = bullish overall
    if (btcDominance.latestValue < 45) score += 2;
    else if (btcDominance.latestValue < 52) score += 1;
    else if (btcDominance.latestValue > 62) score -= 1;
  }

  if (totalMC) {
    const mcChange = totalMC.periodDeltaPct ?? 0;
    if (mcChange > 5) score += 2;
    else if (mcChange > 0) score += 1;
    else if (mcChange < -10) score -= 2;
    else score -= 1;
  }

  if (tvl) {
    const tvlChange = tvl.periodDeltaPct ?? 0;
    if (tvlChange > 5) score += 1;
    else if (tvlChange < -10) score -= 1;
  }

  if (score >= 4) return "BULL_MARKET";
  if (score >= 1) return "ALT_SEASON";
  if (score <= -3) return "BEAR_MARKET";
  return "RISK_OFF";
}

// ---------------------------------------------------------------------------
// Category signal
// ---------------------------------------------------------------------------

function categorySignal(
  categorySlug: string,
  metrics: CryptoMetric[],
  regime: CryptoRegime
): { signal: SignalDirection; rationale: string } {
  const byId = new Map(metrics.map((m) => [m.metricId, m]));
  const fg = byId.get("FEAR_GREED");
  const btcDom = byId.get("BTC_DOMINANCE");
  const tvl = byId.get("DEFI_TVL");
  const stables = byId.get("STABLECOIN_MARKET_CAP");

  const regimeBullish = regime === "BULL_MARKET" || regime === "ALT_SEASON";
  const regimeBearish = regime === "BEAR_MARKET" || regime === "RISK_OFF";

  switch (categorySlug) {
    case "bitcoin": {
      // BTC benefits in risk-off, high dominance environments
      const highDom = (btcDom?.latestValue ?? 50) > 55;
      if (regimeBearish && highDom) return { signal: "BULLISH", rationale: "Risk-off rotation into BTC. Dominance rising." };
      if (regimeBullish) return { signal: "BULLISH", rationale: "Bull market — BTC leading." };
      return { signal: "NEUTRAL", rationale: "Mixed signals for BTC." };
    }

    case "ethereum": {
      const tvlBullish = (tvl?.signal ?? "NEUTRAL") === "BULLISH";
      if (regimeBullish && tvlBullish) return { signal: "BULLISH", rationale: "Bull market with growing DeFi TVL — ETH ecosystem strong." };
      if (regimeBearish) return { signal: "BEARISH", rationale: "Risk-off environment pressuring ETH." };
      return { signal: "NEUTRAL", rationale: "ETH ecosystem neutral." };
    }

    case "defi": {
      const tvlSignal = tvl?.signal ?? "NEUTRAL";
      if (tvlSignal === "BULLISH" && regimeBullish) return { signal: "BULLISH", rationale: "TVL growing and bull market regime — DeFi constructive." };
      if (tvlSignal === "BEARISH" || regimeBearish) return { signal: "BEARISH", rationale: "TVL declining or risk-off — DeFi under pressure." };
      return { signal: "NEUTRAL", rationale: "DeFi neutral." };
    }

    case "stablecoins": {
      const stableRising = (stables?.periodDeltaPct ?? 0) > 0;
      if (stableRising) return { signal: "BULLISH", rationale: "Stablecoin supply growing — dry powder building." };
      return { signal: "NEUTRAL", rationale: "Stablecoin supply stable." };
    }

    case "altcoins": {
      const fgVal = fg?.latestValue ?? 50;
      const lowDom = (btcDom?.latestValue ?? 55) < 48;
      if (regime === "ALT_SEASON" || (lowDom && fgVal > 55)) return { signal: "BULLISH", rationale: "Alt season conditions — BTC dominance falling, sentiment positive." };
      if (regimeBearish || fgVal < 30) return { signal: "BEARISH", rationale: "Risk-off — alts underperform in downturns." };
      return { signal: "NEUTRAL", rationale: "Altcoin conditions mixed." };
    }

    default:
      return { signal: "NEUTRAL", rationale: "Insufficient category data." };
  }
}

// ---------------------------------------------------------------------------
// Main transforms
// ---------------------------------------------------------------------------

export interface CryptoFetchBundle {
  cmcGlobal: CMCGlobalMetrics;
  defiLlama: DeFiLlamaResult;
  fearGreed: FearGreedResult;
}

export function transformCryptoMetrics(bundle: CryptoFetchBundle): CryptoMetric[] {
  const { cmcGlobal, defiLlama, fearGreed } = bundle;
  const usd = cmcGlobal.data.quote.USD;
  const today = TODAY();
  const now = NOW();

  const rawMetrics: Array<{ metricId: string; value: number; prior: number | null; date: string }> = [
    {
      metricId: "TOTAL_MARKET_CAP",
      value: usd.total_market_cap,
      prior: usd.total_market_cap / (1 + usd.total_market_cap_yesterday_percentage_change / 100),
      date: today,
    },
    {
      metricId: "BTC_DOMINANCE",
      value: cmcGlobal.data.btc_dominance,
      prior: null,
      date: today,
    },
    {
      metricId: "ETH_DOMINANCE",
      value: cmcGlobal.data.eth_dominance,
      prior: null,
      date: today,
    },
    {
      metricId: "TOTAL_VOLUME_24H",
      value: usd.total_volume_24h,
      prior: usd.total_volume_24h_yesterday_percentage_change != null
        ? usd.total_volume_24h / (1 + usd.total_volume_24h_yesterday_percentage_change / 100)
        : null,
      date: today,
    },
    {
      metricId: "STABLECOIN_MARKET_CAP",
      value: usd.stablecoin_market_cap,
      prior: usd.stablecoin_market_cap / (1 + usd.stablecoin_24h_percentage_change / 100),
      date: today,
    },
    {
      metricId: "DEFI_MARKET_CAP",
      value: usd.defi_market_cap,
      prior: usd.defi_market_cap / (1 + usd.defi_24h_percentage_change / 100),
      date: today,
    },
    {
      metricId: "DEFI_TVL",
      value: defiLlama.currentTvl,
      prior: defiLlama.priorTvl,
      date: today,
    },
    {
      metricId: "FEAR_GREED",
      value: fearGreed.value,
      prior: fearGreed.priorValue,
      date: today,
    },
  ];

  return rawMetrics.map(({ metricId, value, prior, date }) => {
    const def = METRICS_BY_ID.get(metricId)!;
    const delta = prior !== null ? fmt(value - prior) : null;
    const deltaPct = prior !== null ? fmt(pctChange(value, prior)) : null;
    const { signal, rationale } = deriveCryptoSignal(metricId, value, prior);

    return {
      metricId,
      name: def.name,
      category: def.category,
      source: def.source,
      unit: def.unit,
      latestValue: fmt(value),
      latestDate: date,
      priorValue: prior !== null ? fmt(prior) : null,
      periodDelta: delta,
      periodDeltaPct: deltaPct,
      signal,
      signalRationale: rationale,
      lastUpdated: now,
    };
  });
}

export function transformCryptoCategories(
  metrics: CryptoMetric[],
  cmcGlobal: CMCGlobalMetrics
): CategorySnapshot[] {
  const usd = cmcGlobal.data.quote.USD;
  const regime = inferCryptoRegime(metrics);
  const today = TODAY();
  const now = NOW();
  const dayChangePct = fmt(usd.total_market_cap_yesterday_percentage_change);

  const categories = [
    {
      slug: "bitcoin",
      name: "Bitcoin",
      marketCap: usd.total_market_cap * (cmcGlobal.data.btc_dominance / 100),
      dominance: cmcGlobal.data.btc_dominance,
      drivers: ["BTC_DOMINANCE", "FEAR_GREED"],
    },
    {
      slug: "ethereum",
      name: "Ethereum Ecosystem",
      marketCap: usd.total_market_cap * (cmcGlobal.data.eth_dominance / 100),
      dominance: cmcGlobal.data.eth_dominance,
      drivers: ["ETH_DOMINANCE", "DEFI_TVL"],
    },
    {
      slug: "defi",
      name: "Decentralized Finance",
      marketCap: usd.defi_market_cap,
      dominance: fmt((usd.defi_market_cap / usd.total_market_cap) * 100),
      drivers: ["DEFI_TVL", "DEFI_MARKET_CAP", "ETH_DOMINANCE"],
    },
    {
      slug: "stablecoins",
      name: "Stablecoins",
      marketCap: usd.stablecoin_market_cap,
      dominance: fmt((usd.stablecoin_market_cap / usd.total_market_cap) * 100),
      drivers: ["STABLECOIN_MARKET_CAP", "FEAR_GREED"],
    },
    {
      slug: "altcoins",
      name: "Altcoins",
      marketCap: usd.altcoin_market_cap,
      dominance: fmt((usd.altcoin_market_cap / usd.total_market_cap) * 100),
      drivers: ["BTC_DOMINANCE", "FEAR_GREED", "TOTAL_MARKET_CAP"],
    },
  ];

  return categories.map(({ slug, name, marketCap, dominance, drivers }) => {
    const { signal, rationale } = categorySignal(slug, metrics, regime);
    return {
      snapshotId: `${slug}_${today}`,
      categoryName: name,
      categorySlug: slug,
      totalMarketCapUsd: fmt(marketCap),
      dayChangePct,
      dominancePct: fmt(dominance),
      cryptoRegime: regime,
      primaryMetricDrivers: drivers,
      categorySignal: signal,
      signalRationale: rationale,
      ingestedAt: now,
    };
  });
}
