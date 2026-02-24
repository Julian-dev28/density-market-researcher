import type { CryptoMetricCategory } from "../types/index.js";

// ============================================================
// Crypto Metric Registry
//
// Defines the on-chain and market metrics to track.
// Analogous to fredRegistry.ts for macro indicators.
//
// Sources:
//   CMC_GLOBAL  — CoinMarketCap global-metrics endpoint (free)
//   DEFILLAMA   — DeFiLlama TVL API (free, no key)
//   FEARGREED   — Alternative.me Fear & Greed Index (free, no key)
// ============================================================

export interface CryptoMetricDefinition {
  metricId: string;
  name: string;
  category: CryptoMetricCategory;
  unit: string;
  source: "CMC_GLOBAL" | "DEFILLAMA" | "FEARGREED";
  /** If true, higher value is bearish for risk assets */
  inverseSentiment: boolean;
  /** Which category slugs are most driven by this metric */
  affectedCategories: string[];
  description: string;
}

export const CRYPTO_METRICS: CryptoMetricDefinition[] = [
  // --- Market Structure ---
  {
    metricId: "TOTAL_MARKET_CAP",
    name: "Total Crypto Market Cap",
    category: "MARKET_STRUCTURE",
    unit: "USD",
    source: "CMC_GLOBAL",
    inverseSentiment: false,
    affectedCategories: ["bitcoin", "ethereum", "defi", "altcoins"],
    description: "Total market capitalization of all cryptocurrencies.",
  },
  {
    metricId: "BTC_DOMINANCE",
    name: "Bitcoin Dominance",
    category: "MARKET_STRUCTURE",
    unit: "%",
    source: "CMC_GLOBAL",
    inverseSentiment: true, // high dominance = capital fleeing to BTC = risk-off for alts
    affectedCategories: ["altcoins", "defi"],
    description: "BTC share of total crypto market cap. >60% = risk-off, <45% = alt season.",
  },
  {
    metricId: "ETH_DOMINANCE",
    name: "Ethereum Dominance",
    category: "MARKET_STRUCTURE",
    unit: "%",
    source: "CMC_GLOBAL",
    inverseSentiment: false,
    affectedCategories: ["ethereum", "defi"],
    description: "ETH share of total crypto market cap. Rising = DeFi/L2 rotation underway.",
  },
  {
    metricId: "TOTAL_VOLUME_24H",
    name: "Total 24h Trading Volume",
    category: "LIQUIDITY",
    unit: "USD",
    source: "CMC_GLOBAL",
    inverseSentiment: false,
    affectedCategories: ["bitcoin", "ethereum", "altcoins"],
    description: "Total 24h trading volume across all cryptocurrencies — proxy for market activity.",
  },

  // --- Stablecoins ---
  {
    metricId: "STABLECOIN_MARKET_CAP",
    name: "Stablecoin Market Cap",
    category: "STABLECOINS",
    unit: "USD",
    source: "CMC_GLOBAL",
    inverseSentiment: false, // rising = more dry powder on sidelines = bullish potential
    affectedCategories: ["defi", "bitcoin"],
    description: "Total stablecoin market cap. Rising = capital building on sidelines (bullish dry powder).",
  },

  // --- DeFi ---
  {
    metricId: "DEFI_MARKET_CAP",
    name: "DeFi Token Market Cap",
    category: "DEFI",
    unit: "USD",
    source: "CMC_GLOBAL",
    inverseSentiment: false,
    affectedCategories: ["defi"],
    description: "Total market cap of DeFi tokens per CoinMarketCap.",
  },
  {
    metricId: "DEFI_TVL",
    name: "DeFi Total Value Locked",
    category: "DEFI",
    unit: "USD",
    source: "DEFILLAMA",
    inverseSentiment: false,
    affectedCategories: ["defi", "ethereum"],
    description: "Total value locked across all DeFi protocols. Rising = healthy DeFi ecosystem.",
  },

  // --- Sentiment ---
  {
    metricId: "FEAR_GREED",
    name: "Crypto Fear & Greed Index",
    category: "SENTIMENT",
    unit: "index (0-100)",
    source: "FEARGREED",
    inverseSentiment: true, // extreme greed (high) = contrarian bearish signal
    affectedCategories: ["bitcoin", "altcoins", "defi"],
    description: "0=Extreme Fear (contrarian buy), 100=Extreme Greed (contrarian sell).",
  },
];

export const METRICS_BY_ID = new Map(
  CRYPTO_METRICS.map((m) => [m.metricId, m])
);
