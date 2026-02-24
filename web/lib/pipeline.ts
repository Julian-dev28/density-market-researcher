// ============================================================
// Production pipeline — live data with fixture fallbacks.
//
// Data sources (all free or key-gated):
//   FRED         → macro indicators   (needs FRED_API_KEY, else fixture)
//   Yahoo Finance → sector ETFs       (free, no key)
//   CoinMarketCap → crypto metrics    (needs COINMARKETCAP_API_KEY, else fixture)
//   DeFiLlama    → TVL                (free, no key)
//   Alternative.me → Fear & Greed    (free, no key)
//
// Caching: Next.js ISR via fetch() next.revalidate.
// All fetches are parallel; errors fall back to fixture data.
// ============================================================

import type {
  MacroIndicator,
  SectorSnapshot,
  CryptoMetric,
  CategorySnapshot,
  SignalDirection,
  Regime,
  CryptoRegime,
  IndicatorCategory,
  CryptoMetricCategory,
  PipelineOutput,
} from "./types";

export type { PipelineOutput };

// ---------------------------------------------------------------------------
// Registries
// ---------------------------------------------------------------------------

const SERIES_BY_ID = new Map<
  string,
  { name: string; category: IndicatorCategory; inverseSentiment: boolean }
>([
  ["DFF",          { name: "Federal Funds Effective Rate",              category: "INTEREST_RATES", inverseSentiment: true  }],
  ["DGS10",        { name: "10-Year Treasury Constant Maturity Rate",   category: "INTEREST_RATES", inverseSentiment: true  }],
  ["T10Y2Y",       { name: "10-Year minus 2-Year Treasury Spread",      category: "INTEREST_RATES", inverseSentiment: false }],
  ["CPIAUCSL",     { name: "Consumer Price Index (All Urban)",          category: "INFLATION",      inverseSentiment: true  }],
  ["CPILFESL",     { name: "Core CPI (ex Food & Energy)",               category: "INFLATION",      inverseSentiment: true  }],
  ["PPIACO",       { name: "Producer Price Index (All Commodities)",    category: "INFLATION",      inverseSentiment: true  }],
  ["UNRATE",       { name: "Unemployment Rate",                         category: "EMPLOYMENT",     inverseSentiment: true  }],
  ["PAYEMS",       { name: "Total Nonfarm Payrolls",                    category: "EMPLOYMENT",     inverseSentiment: false }],
  ["GDP",          { name: "Gross Domestic Product",                    category: "GROWTH",         inverseSentiment: false }],
  ["INDPRO",       { name: "Industrial Production Index",               category: "GROWTH",         inverseSentiment: false }],
  ["BAMLH0A0HYM2", { name: "ICE BofA US High Yield OAS",               category: "CREDIT",         inverseSentiment: true  }],
  ["MORTGAGE30US", { name: "30-Year Fixed Mortgage Rate",               category: "HOUSING",        inverseSentiment: true  }],
  ["HOUST",        { name: "Housing Starts",                            category: "HOUSING",        inverseSentiment: false }],
  ["UMCSENT",      { name: "Univ. of Michigan Consumer Sentiment",      category: "SENTIMENT",      inverseSentiment: false }],
]);

// Metadata needed to construct FREDFetchResult without the /series info endpoint
const FRED_META: Record<string, { frequency_short: string; units: string }> = {
  "DFF":          { frequency_short: "D", units: "Percent" },
  "DGS10":        { frequency_short: "D", units: "Percent" },
  "T10Y2Y":       { frequency_short: "D", units: "Percent" },
  "CPIAUCSL":     { frequency_short: "M", units: "Index 1982-1984=100" },
  "CPILFESL":     { frequency_short: "M", units: "Index 1982-1984=100" },
  "PPIACO":       { frequency_short: "M", units: "Index 1982=100" },
  "UNRATE":       { frequency_short: "M", units: "Percent" },
  "PAYEMS":       { frequency_short: "M", units: "Thousands of Persons" },
  "GDP":          { frequency_short: "Q", units: "Billions of Dollars" },
  "INDPRO":       { frequency_short: "M", units: "Index 2017=100" },
  "BAMLH0A0HYM2": { frequency_short: "D", units: "Percent" },
  "MORTGAGE30US": { frequency_short: "W", units: "Percent" },
  "HOUST":        { frequency_short: "M", units: "Thousands of Units" },
  "UMCSENT":      { frequency_short: "M", units: "Index 1966:Q1=100" },
};

const FRED_SERIES_IDS = Object.keys(FRED_META);

const SECTOR_MAP: Record<string, { name: string; primaryMacroDrivers: string[] }> = {
  XLF:  { name: "Financials",             primaryMacroDrivers: ["DFF", "DGS10", "T10Y2Y", "BAMLH0A0HYM2"] },
  XLE:  { name: "Energy",                 primaryMacroDrivers: ["PPIACO", "CPIAUCSL"] },
  XLK:  { name: "Technology",             primaryMacroDrivers: ["DGS10", "DFF", "GDP"] },
  XLV:  { name: "Health Care",            primaryMacroDrivers: ["CPIAUCSL", "UMCSENT"] },
  XLI:  { name: "Industrials",            primaryMacroDrivers: ["INDPRO", "GDP", "PAYEMS"] },
  XLP:  { name: "Consumer Staples",       primaryMacroDrivers: ["CPIAUCSL", "CPILFESL", "UMCSENT"] },
  XLY:  { name: "Consumer Discretionary", primaryMacroDrivers: ["UNRATE", "UMCSENT", "CPILFESL"] },
  XLB:  { name: "Materials",              primaryMacroDrivers: ["PPIACO", "INDPRO", "HOUST"] },
  XLRE: { name: "Real Estate",            primaryMacroDrivers: ["MORTGAGE30US", "DGS10", "DFF", "HOUST"] },
  XLU:  { name: "Utilities",              primaryMacroDrivers: ["DFF", "DGS10"] },
  XLC:  { name: "Communication Services", primaryMacroDrivers: ["GDP", "UMCSENT"] },
};

const AV_NAME_TO_TICKER: Record<string, string> = {
  "Energy": "XLE", "Utilities": "XLU", "Financials": "XLF",
  "Technology": "XLK", "Health Care": "XLV", "Industrials": "XLI",
  "Consumer Discretionary": "XLY", "Materials": "XLB",
  "Consumer Staples": "XLP", "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

const SECTOR_TICKERS = [...Object.keys(AV_NAME_TO_TICKER).map(n => {
  return Object.entries(AV_NAME_TO_TICKER).find(([, v]) => v === n)?.[0] ?? n;
}), "SPY"].filter(Boolean);

const ALL_SECTOR_TICKERS = ["XLF","XLE","XLK","XLV","XLI","XLP","XLY","XLB","XLRE","XLU","XLC","SPY"];

const TICKER_TO_AV: Record<string, string> = {
  XLE: "Energy", XLU: "Utilities", XLF: "Financials", XLK: "Technology",
  XLV: "Health Care", XLI: "Industrials", XLY: "Consumer Discretionary",
  XLB: "Materials", XLP: "Consumer Staples", XLRE: "Real Estate",
  XLC: "Communication Services", SPY: "S&P 500",
};

const METRICS_BY_ID = new Map<
  string,
  { name: string; category: CryptoMetricCategory; unit: string; source: string; inverseSentiment: boolean }
>([
  ["TOTAL_MARKET_CAP",      { name: "Total Crypto Market Cap",    category: "MARKET_STRUCTURE", unit: "USD",          source: "CMC_GLOBAL", inverseSentiment: false }],
  ["BTC_DOMINANCE",         { name: "Bitcoin Dominance",           category: "MARKET_STRUCTURE", unit: "%",            source: "CMC_GLOBAL", inverseSentiment: true  }],
  ["ETH_DOMINANCE",         { name: "Ethereum Dominance",          category: "MARKET_STRUCTURE", unit: "%",            source: "CMC_GLOBAL", inverseSentiment: false }],
  ["TOTAL_VOLUME_24H",      { name: "Total 24h Trading Volume",    category: "LIQUIDITY",        unit: "USD",          source: "CMC_GLOBAL", inverseSentiment: false }],
  ["STABLECOIN_MARKET_CAP", { name: "Stablecoin Market Cap",       category: "STABLECOINS",      unit: "USD",          source: "CMC_GLOBAL", inverseSentiment: false }],
  ["DEFI_MARKET_CAP",       { name: "DeFi Token Market Cap",       category: "DEFI",             unit: "USD",          source: "CMC_GLOBAL", inverseSentiment: false }],
  ["DEFI_TVL",              { name: "DeFi Total Value Locked",     category: "DEFI",             unit: "USD",          source: "DEFILLAMA",  inverseSentiment: false }],
  ["FEAR_GREED",            { name: "Crypto Fear & Greed Index",   category: "SENTIMENT",        unit: "index (0-100)",source: "FEARGREED",  inverseSentiment: true  }],
]);

// ---------------------------------------------------------------------------
// Raw types
// ---------------------------------------------------------------------------

interface FREDObs { date: string; value: string }
interface FREDFetchResult {
  seriesId: string;
  info: { id: string; title: string; frequency_short: string; units: string; last_updated: string };
  observations: { units: string; count: number; observations: FREDObs[] };
}

interface SectorResponse {
  "Meta Data": { "Last Refreshed": string };
  "Rank A: Real-Time Performance": Record<string, string>;
  "Rank B: 1 Day Performance": Record<string, string>;
  "Rank C: 5 Day Performance": Record<string, string>;
  "Rank D: 1 Month Performance": Record<string, string>;
  "Rank F: Year-to-Date (YTD) Performance": Record<string, string>;
}

interface CMCUSD {
  total_market_cap: number; total_volume_24h: number; altcoin_market_cap: number;
  defi_market_cap: number; defi_volume_24h: number; defi_24h_percentage_change: number;
  stablecoin_market_cap: number; stablecoin_volume_24h: number;
  stablecoin_24h_percentage_change: number;
  total_market_cap_yesterday_percentage_change: number; last_updated: string;
}
interface CMC {
  status: { timestamp: string; error_code: number };
  data: { btc_dominance: number; eth_dominance: number; quote: { USD: CMCUSD } };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

function mkObs(date: string, value: string) {
  return { date, value, realtime_start: date, realtime_end: date };
}

function fredFixture(): FREDFetchResult[] {
  return [
    { seriesId: "DFF",          info: { id: "DFF",          title: "Federal Funds Effective Rate",                      frequency_short: "D", units: "Percent",             last_updated: "2024-08-08" }, observations: { units: "Percent",             count: 3, observations: [mkObs("2024-08-08","5.33"), mkObs("2024-08-07","5.33"), mkObs("2023-08-08","5.08")] } },
    { seriesId: "DGS10",        info: { id: "DGS10",        title: "10-Year Treasury Constant Maturity Rate",            frequency_short: "D", units: "Percent",             last_updated: "2024-08-08" }, observations: { units: "Percent",             count: 3, observations: [mkObs("2024-08-08","3.99"), mkObs("2024-08-07","4.02"), mkObs("2023-08-08","4.07")] } },
    { seriesId: "T10Y2Y",       info: { id: "T10Y2Y",       title: "10-Year minus 2-Year Treasury Spread",               frequency_short: "D", units: "Percent",             last_updated: "2024-08-08" }, observations: { units: "Percent",             count: 3, observations: [mkObs("2024-08-08","-0.33"), mkObs("2024-08-07","-0.36"), mkObs("2023-08-08","-0.81")] } },
    { seriesId: "CPIAUCSL",     info: { id: "CPIAUCSL",     title: "Consumer Price Index for All Urban Consumers",       frequency_short: "M", units: "Index 1982-1984=100", last_updated: "2024-07-11" }, observations: { units: "Index 1982-1984=100", count: 3, observations: [mkObs("2024-06-01","314.175"), mkObs("2024-05-01","313.225"), mkObs("2023-06-01","305.109")] } },
    { seriesId: "CPILFESL",     info: { id: "CPILFESL",     title: "Consumer Price Index: All Items Less Food & Energy", frequency_short: "M", units: "Index 1982-1984=100", last_updated: "2024-07-11" }, observations: { units: "Index 1982-1984=100", count: 3, observations: [mkObs("2024-06-01","320.892"), mkObs("2024-05-01","320.310"), mkObs("2023-06-01","308.094")] } },
    { seriesId: "UNRATE",       info: { id: "UNRATE",       title: "Unemployment Rate",                                  frequency_short: "M", units: "Percent",             last_updated: "2024-08-02" }, observations: { units: "Percent",             count: 3, observations: [mkObs("2024-07-01","4.3"), mkObs("2024-06-01","4.1"), mkObs("2023-07-01","3.5")] } },
    { seriesId: "UMCSENT",      info: { id: "UMCSENT",      title: "University of Michigan: Consumer Sentiment",         frequency_short: "M", units: "Index 1966:Q1=100",   last_updated: "2024-08-02" }, observations: { units: "Index 1966:Q1=100",   count: 3, observations: [mkObs("2024-07-01","66.4"), mkObs("2024-06-01","68.2"), mkObs("2023-07-01","71.6")] } },
    { seriesId: "BAMLH0A0HYM2", info: { id: "BAMLH0A0HYM2", title: "ICE BofA US High Yield OAS",                        frequency_short: "D", units: "Percent",             last_updated: "2024-08-08" }, observations: { units: "Percent",             count: 3, observations: [mkObs("2024-08-08","3.84"), mkObs("2024-08-07","3.61"), mkObs("2023-08-08","3.91")] } },
  ];
}

function sectorFixture(): SectorResponse {
  return {
    "Meta Data": { "Last Refreshed": new Date().toISOString().split("T")[0] },
    "Rank A: Real-Time Performance":          { "Energy":"0.0091","Utilities":"0.0084","Financials":"-0.0011","Technology":"-0.0214","Health Care":"-0.0017","Industrials":"-0.0089","Consumer Discretionary":"-0.0301","Materials":"-0.0044","Consumer Staples":"0.0031","Real Estate":"0.0073","Communication Services":"-0.0125" },
    "Rank B: 1 Day Performance":              { "Energy":"0.0091","Utilities":"0.0084","Financials":"-0.0011","Technology":"-0.0214","Health Care":"-0.0017","Industrials":"-0.0089","Consumer Discretionary":"-0.0301","Materials":"-0.0044","Consumer Staples":"0.0031","Real Estate":"0.0073","Communication Services":"-0.0125" },
    "Rank C: 5 Day Performance":              { "Energy":"-0.0231","Utilities":"0.0315","Financials":"-0.0402","Technology":"-0.0531","Health Care":"0.0089","Industrials":"-0.0421","Consumer Discretionary":"-0.0487","Materials":"-0.0311","Consumer Staples":"0.0102","Real Estate":"0.0201","Communication Services":"-0.0398" },
    "Rank D: 1 Month Performance":            { "Energy":"0.0412","Utilities":"0.0589","Financials":"0.0201","Technology":"-0.0341","Health Care":"0.0211","Industrials":"-0.0101","Consumer Discretionary":"-0.0421","Materials":"-0.0211","Consumer Staples":"0.0341","Real Estate":"0.0612","Communication Services":"-0.0198" },
    "Rank F: Year-to-Date (YTD) Performance": { "Energy":"0.1021","Utilities":"0.1532","Financials":"0.1201","Technology":"0.1841","Health Care":"0.0611","Industrials":"0.1012","Consumer Discretionary":"0.0421","Materials":"0.0711","Consumer Staples":"0.0612","Real Estate":"0.0201","Communication Services":"0.1411" },
  };
}

function cmcFixture(): CMC {
  return {
    status: { timestamp: new Date().toISOString(), error_code: 0 },
    data: { btc_dominance: 58.3, eth_dominance: 10.2, quote: { USD: { total_market_cap: 2_840_000_000_000, total_volume_24h: 94_000_000_000, altcoin_market_cap: 1_185_000_000_000, defi_market_cap: 96_500_000_000, defi_volume_24h: 6_800_000_000, defi_24h_percentage_change: -2.3, stablecoin_market_cap: 228_000_000_000, stablecoin_volume_24h: 71_000_000_000, stablecoin_24h_percentage_change: 0.8, total_market_cap_yesterday_percentage_change: -1.4, last_updated: new Date().toISOString() } } },
  };
}

// ---------------------------------------------------------------------------
// Live fetch functions (use native fetch for Next.js caching)
// ---------------------------------------------------------------------------

async function fetchFREDSeries(seriesId: string, apiKey: string): Promise<FREDFetchResult | null> {
  try {
    const params = new URLSearchParams({
      series_id: seriesId, api_key: apiKey, file_type: "json",
      sort_order: "desc", limit: "53",
    });
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?${params}`,
      { next: { revalidate: 3600 } }  // cache 1 hour — FRED updates at most daily
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = FRED_META[seriesId] ?? { frequency_short: "M", units: "" };
    const def = SERIES_BY_ID.get(seriesId);
    return {
      seriesId,
      info: { id: seriesId, title: def?.name ?? seriesId, ...meta, last_updated: new Date().toISOString() },
      observations: { units: meta.units, count: data.observations?.length ?? 0, observations: data.observations ?? [] },
    };
  } catch {
    return null;
  }
}

async function fetchFREDLive(apiKey: string): Promise<FREDFetchResult[]> {
  // Fetch all series in parallel — 14 req, well under FRED's 120 req/min limit
  const results = await Promise.allSettled(
    FRED_SERIES_IDS.map(id => fetchFREDSeries(id, apiKey))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<FREDFetchResult> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value as FREDFetchResult);
}

async function fetchYahooChart(ticker: string, period1: number, period2: number) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 1800 },  // cache 30 min — market data
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    return {
      ticker,
      currentPrice: result.meta?.regularMarketPrice ?? 0,
      closes: (result.indicators?.quote?.[0]?.close ?? []) as (number | null)[],
    };
  } catch {
    return null;
  }
}

function closeAt(closes: (number | null)[], offset: number): number | null {
  for (let i = closes.length - 1 - offset; i >= 0; i--) {
    if (closes[i] != null) return closes[i] as number;
  }
  return null;
}

function decimalPct(current: number, base: number | null | undefined): string {
  if (!base || base === 0) return "0.0000";
  return ((current - base) / base).toFixed(4);
}

async function fetchSectorsLive(): Promise<SectorResponse> {
  const today = new Date();
  const ytdStart = Math.floor(new Date(`${today.getFullYear()}-01-02`).getTime() / 1000);
  const now = Math.floor(today.getTime() / 1000);

  const quotes = await Promise.allSettled(
    ALL_SECTOR_TICKERS.map(t => fetchYahooChart(t, ytdStart, now))
  );
  const valid = quotes
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchYahooChart>>>> =>
      r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  if (valid.length < 5) return sectorFixture();

  const rankA: Record<string, string> = {};
  const rankB: Record<string, string> = {};
  const rankC: Record<string, string> = {};
  const rankD: Record<string, string> = {};
  const rankF: Record<string, string> = {};

  for (const q of valid) {
    const name = TICKER_TO_AV[q.ticker];
    if (!name) continue;
    const c = q.currentPrice;
    const cl = q.closes;
    rankA[name] = rankB[name] = decimalPct(c, closeAt(cl, 1));
    rankC[name] = decimalPct(c, closeAt(cl, 5));
    rankD[name] = decimalPct(c, closeAt(cl, 22));
    rankF[name] = decimalPct(c, cl.find((x): x is number => x != null) ?? null);
  }

  return {
    "Meta Data": { "Last Refreshed": today.toISOString().split("T")[0] },
    "Rank A: Real-Time Performance": rankA, "Rank B: 1 Day Performance": rankB,
    "Rank C: 5 Day Performance": rankC, "Rank D: 1 Month Performance": rankD,
    "Rank F: Year-to-Date (YTD) Performance": rankF,
  };
}

async function fetchCMCLive(apiKey: string): Promise<CMC> {
  const res = await fetch(
    "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest",
    { headers: { "X-CMC_PRO_API_KEY": apiKey }, next: { revalidate: 300 } }  // 5 min
  );
  if (!res.ok) throw new Error(`CMC ${res.status}`);
  const data = await res.json();
  if (data.status?.error_code !== 0) throw new Error("CMC API error");
  return data as CMC;
}

async function fetchDeFiLlamaLive(): Promise<{ currentTvl: number; priorTvl: number | null }> {
  const res = await fetch("https://api.llama.fi/v2/historicalChainTvl", { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`);
  const data: Array<{ date: number; tvl: number }> = await res.json();
  if (!data?.length) throw new Error("Empty DeFiLlama response");
  const sorted = [...data].sort((a, b) => b.date - a.date);
  const thirtyDaysAgo = sorted[0].date - 30 * 86_400;
  return {
    currentTvl: sorted[0].tvl,
    priorTvl: sorted.find(p => p.date <= thirtyDaysAgo)?.tvl ?? null,
  };
}

async function fetchFearGreedLive(): Promise<{ value: number; priorValue: number | null }> {
  const res = await fetch("https://api.alternative.me/fng/?limit=2", { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FearGreed ${res.status}`);
  const data = await res.json();
  if (!data?.data?.[0]) throw new Error("Empty FearGreed response");
  return {
    value: parseInt(data.data[0].value, 10),
    priorValue: data.data[1] ? parseInt(data.data[1].value, 10) : null,
  };
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function pct(current: number, prior: number): number {
  if (prior === 0) return 0;
  return parseFloat((((current - prior) / Math.abs(prior)) * 100).toFixed(4));
}
function fmt(n: number): number { return parseFloat(n.toFixed(4)); }
function percentileInRange(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return parseFloat(((value - min) / (max - min)).toFixed(4));
}

// ---------------------------------------------------------------------------
// Macro transforms
// ---------------------------------------------------------------------------

function deriveMacroSignal(seriesId: string, delta: number | null, yearPercentile: number | null): { signal: SignalDirection; rationale: string } {
  const def = SERIES_BY_ID.get(seriesId);
  if (!def || delta === null) return { signal: "NEUTRAL", rationale: "Insufficient data." };
  const rising = delta > 0;
  const highRegime = yearPercentile !== null && yearPercentile > 0.7;
  const lowRegime = yearPercentile !== null && yearPercentile < 0.3;
  if (def.inverseSentiment) {
    if (rising && highRegime) return { signal: "BEARISH", rationale: `${def.name} rising at elevated levels (${(yearPercentile! * 100).toFixed(0)}th pctile).` };
    if (!rising && lowRegime) return { signal: "BULLISH", rationale: `${def.name} declining from low levels — easing pressure.` };
    return { signal: rising ? "BEARISH" : "BULLISH", rationale: `${def.name} trending ${rising ? "higher — headwind" : "lower — tailwind"} for risk assets.` };
  }
  if (rising && highRegime) return { signal: "BULLISH", rationale: `${def.name} rising near 52-week highs — supportive backdrop.` };
  if (!rising && lowRegime) return { signal: "BEARISH", rationale: `${def.name} declining near 52-week lows — deteriorating.` };
  return { signal: rising ? "BULLISH" : "BEARISH", rationale: `${def.name} trending ${rising ? "higher" : "lower"}.` };
}

function inferRegime(indicators: MacroIndicator[]): Regime {
  const byId = new Map(indicators.map(i => [i.seriesId, i]));
  let score = 0;
  const unrate = byId.get("UNRATE"); if (unrate) score += (unrate.periodDelta ?? 0) > 0 ? -2 : 1;
  const dff = byId.get("DFF");       if (dff)    score += (dff.periodDelta ?? 0) < 0 ? 1 : -1;
  const spread = byId.get("T10Y2Y"); if (spread) score += spread.latestValue < 0 ? -1 : 1;
  const sent = byId.get("UMCSENT");  if (sent)   score += sent.latestValue < 70 ? -1 : 1;
  if (score >= 3) return "EXPANSION";
  if (score >= 1) return "RECOVERY";
  if (score <= -3) return "CONTRACTION";
  return "SLOWDOWN";
}

function transformFREDResult(result: FREDFetchResult): MacroIndicator | null {
  const def = SERIES_BY_ID.get(result.seriesId);
  const obs = result.observations.observations
    .filter(o => o.value !== "." && o.value !== "")
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (obs.length === 0) return null;
  const latest = obs[0];
  const prior = obs.length > 1 ? obs[1] : null;
  const values = obs.map(o => o.value);
  const yearMin = Math.min(...values), yearMax = Math.max(...values);
  const delta = prior ? parseFloat((latest.value - prior.value).toFixed(6)) : null;
  const deltaPct = prior ? pct(latest.value, prior.value) : null;
  const yearPercentile = percentileInRange(latest.value, yearMin, yearMax);
  const { signal, rationale } = deriveMacroSignal(result.seriesId, delta, yearPercentile);
  const freqMap: Record<string, MacroIndicator["frequency"]> = { D:"DAILY", W:"WEEKLY", M:"MONTHLY", Q:"QUARTERLY" };
  return {
    seriesId: result.seriesId, name: def?.name ?? result.info.title, source: "FRED",
    category: def?.category ?? "GROWTH", latestValue: latest.value, latestDate: latest.date,
    unit: result.info.units, priorValue: prior?.value ?? null, priorDate: prior?.date ?? null,
    periodDelta: delta, periodDeltaPct: deltaPct, yearLow: yearMin, yearHigh: yearMax, yearPercentile,
    signal, signalRationale: rationale,
    frequency: freqMap[result.info.frequency_short] ?? "MONTHLY",
    lastUpdated: result.info.last_updated,
    sourceUrl: `https://fred.stlouisfed.org/series/${result.seriesId}`,
  };
}

function parsePct(val: string | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : parseFloat((n * 100).toFixed(4));
}

function sectorSignalFn(day: number | null, month: number | null, rs: number | null): { signal: SignalDirection; rationale: string } {
  if (day === null) return { signal: "NEUTRAL", rationale: "No performance data." };
  const bullishCount = (day > 0 ? 1 : 0) + ((month ?? 0) > 0 ? 1 : 0) + ((rs ?? 0) > 0 ? 1 : 0);
  if (bullishCount >= 3) return { signal: "BULLISH", rationale: "Outperforming across 1-day, 1-month, and vs SPY." };
  if (bullishCount === 0) return { signal: "BEARISH", rationale: "Underperforming across all measured timeframes." };
  return { signal: "NEUTRAL", rationale: `Mixed signals — ${bullishCount}/3 timeframes positive.` };
}

function transformSectorData(avData: SectorResponse, indicators: MacroIndicator[]): SectorSnapshot[] {
  const date = avData["Meta Data"]["Last Refreshed"];
  const regime = inferRegime(indicators);
  const spyYTD = parsePct(avData["Rank F: Year-to-Date (YTD) Performance"]["S&P 500"]);
  const now = new Date().toISOString();
  return Object.entries(AV_NAME_TO_TICKER).map(([avName, ticker]) => {
    const meta = SECTOR_MAP[ticker];
    if (!meta) return null;
    const dayPct = parsePct(avData["Rank B: 1 Day Performance"][avName]);
    const weekPct = parsePct(avData["Rank C: 5 Day Performance"][avName]);
    const monthPct = parsePct(avData["Rank D: 1 Month Performance"][avName]);
    const ytdPct = parsePct(avData["Rank F: Year-to-Date (YTD) Performance"][avName]);
    const rsVsSPY = ytdPct !== null && spyYTD !== null ? parseFloat((ytdPct - spyYTD).toFixed(4)) : null;
    const { signal, rationale } = sectorSignalFn(dayPct, monthPct, rsVsSPY);
    return {
      snapshotId: `${ticker}_${date}`, sectorTicker: ticker, sectorName: meta.name, date,
      dayChangePct: dayPct, weekChangePct: weekPct, monthChangePct: monthPct, ytdChangePct: ytdPct,
      relativeStrengthVsSPY: rsVsSPY, macroRegime: regime,
      primaryMacroDrivers: meta.primaryMacroDrivers, sectorSignal: signal,
      signalRationale: rationale, ingestedAt: now,
    };
  }).filter((s) => s !== null) as SectorSnapshot[];
}

// ---------------------------------------------------------------------------
// Crypto transforms
// ---------------------------------------------------------------------------

function deriveCryptoSignal(metricId: string, value: number, priorValue: number | null): { signal: SignalDirection; rationale: string } {
  const def = METRICS_BY_ID.get(metricId);
  if (!def) return { signal: "NEUTRAL", rationale: "Unknown metric." };
  const delta = priorValue !== null ? value - priorValue : null;
  const rising = delta !== null ? delta > 0 : null;
  switch (metricId) {
    case "BTC_DOMINANCE":
      if (value > 60) return { signal: "BEARISH", rationale: `BTC dominance at ${value.toFixed(1)}% — risk-off for alts.` };
      if (value < 45) return { signal: "BULLISH", rationale: `BTC dominance at ${value.toFixed(1)}% — alt season conditions.` };
      return { signal: "NEUTRAL", rationale: `BTC dominance at ${value.toFixed(1)}% — balanced market structure.` };
    case "FEAR_GREED":
      if (value <= 25) return { signal: "BULLISH", rationale: `Extreme Fear (${value}) — contrarian buy signal.` };
      if (value >= 75) return { signal: "BEARISH", rationale: `Extreme Greed (${value}) — contrarian sell signal.` };
      if (value <= 40) return { signal: "BULLISH", rationale: `Fear zone (${value}) — market oversold.` };
      if (value >= 65) return { signal: "BEARISH", rationale: `Greed zone (${value}) — elevated positioning.` };
      return { signal: "NEUTRAL", rationale: `Neutral sentiment (${value}).` };
    case "STABLECOIN_MARKET_CAP":
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient data." };
      return rising ? { signal: "BULLISH", rationale: "Stablecoin supply growing — dry powder accumulating." } : { signal: "NEUTRAL", rationale: "Stablecoin supply stable/declining." };
    case "DEFI_TVL":
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient TVL data." };
      return rising ? { signal: "BULLISH", rationale: "DeFi TVL rising — capital flowing into protocols." } : { signal: "BEARISH", rationale: "DeFi TVL declining — capital leaving DeFi." };
    default: {
      if (rising === null) return { signal: "NEUTRAL", rationale: "Insufficient data." };
      const bull = def.inverseSentiment ? !rising : rising;
      return { signal: bull ? "BULLISH" : "BEARISH", rationale: `${def.name} ${rising ? "rising" : "declining"}.` };
    }
  }
}

function inferCryptoRegime(metrics: CryptoMetric[]): CryptoRegime {
  const byId = new Map(metrics.map(m => [m.metricId, m]));
  let score = 0;
  const fg = byId.get("FEAR_GREED");      if (fg)      { if (fg.latestValue >= 65) score += 2; else if (fg.latestValue >= 50) score += 1; else if (fg.latestValue <= 25) score -= 2; else score -= 1; }
  const btc = byId.get("BTC_DOMINANCE");  if (btc)     { if (btc.latestValue < 45) score += 2; else if (btc.latestValue < 52) score += 1; else if (btc.latestValue > 62) score -= 1; }
  const mc = byId.get("TOTAL_MARKET_CAP"); if (mc)     { const d = mc.periodDeltaPct ?? 0; if (d > 5) score += 2; else if (d > 0) score += 1; else if (d < -10) score -= 2; else score -= 1; }
  const tvl = byId.get("DEFI_TVL");       if (tvl)     { const d = tvl.periodDeltaPct ?? 0; if (d > 5) score += 1; else if (d < -10) score -= 1; }
  if (score >= 4) return "BULL_MARKET";
  if (score >= 1) return "ALT_SEASON";
  if (score <= -3) return "BEAR_MARKET";
  return "RISK_OFF";
}

function categorySignalFn(slug: string, metrics: CryptoMetric[], regime: CryptoRegime): { signal: SignalDirection; rationale: string } {
  const byId = new Map(metrics.map(m => [m.metricId, m]));
  const fg = byId.get("FEAR_GREED"), btcDom = byId.get("BTC_DOMINANCE"), tvl = byId.get("DEFI_TVL"), stables = byId.get("STABLECOIN_MARKET_CAP");
  const bull = regime === "BULL_MARKET" || regime === "ALT_SEASON";
  const bear = regime === "BEAR_MARKET" || regime === "RISK_OFF";
  switch (slug) {
    case "bitcoin":    { const highDom = (btcDom?.latestValue ?? 50) > 55; if (bear && highDom) return { signal:"BULLISH", rationale:"Risk-off rotation into BTC. Dominance rising." }; if (bull) return { signal:"BULLISH", rationale:"Bull market — BTC leading." }; return { signal:"NEUTRAL", rationale:"Mixed signals for BTC." }; }
    case "ethereum":   { const tvlBull = (tvl?.signal ?? "NEUTRAL") === "BULLISH"; if (bull && tvlBull) return { signal:"BULLISH", rationale:"Bull market with growing TVL — ETH ecosystem strong." }; if (bear) return { signal:"BEARISH", rationale:"Risk-off pressuring ETH." }; return { signal:"NEUTRAL", rationale:"ETH ecosystem neutral." }; }
    case "defi":       { const ts = tvl?.signal ?? "NEUTRAL"; if (ts === "BULLISH" && bull) return { signal:"BULLISH", rationale:"TVL growing in bull market — DeFi constructive." }; if (ts === "BEARISH" || bear) return { signal:"BEARISH", rationale:"TVL declining or risk-off — DeFi under pressure." }; return { signal:"NEUTRAL", rationale:"DeFi neutral." }; }
    case "stablecoins": return (stables?.periodDeltaPct ?? 0) > 0 ? { signal:"BULLISH", rationale:"Stablecoin supply growing — dry powder building." } : { signal:"NEUTRAL", rationale:"Stablecoin supply stable." };
    case "altcoins":   { const fgVal = fg?.latestValue ?? 50; const lowDom = (btcDom?.latestValue ?? 55) < 48; if (regime === "ALT_SEASON" || (lowDom && fgVal > 55)) return { signal:"BULLISH", rationale:"Alt season — BTC dominance falling, sentiment positive." }; if (bear || fgVal < 30) return { signal:"BEARISH", rationale:"Risk-off — alts underperform in downturns." }; return { signal:"NEUTRAL", rationale:"Altcoin conditions mixed." }; }
    default: return { signal:"NEUTRAL", rationale:"Insufficient category data." };
  }
}

function transformCryptoMetrics(cmc: CMC, currentTvl: number, priorTvl: number | null, fgValue: number, fgPrior: number | null): CryptoMetric[] {
  const usd = cmc.data.quote.USD;
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  const raw = [
    { metricId: "TOTAL_MARKET_CAP",      value: usd.total_market_cap,      prior: usd.total_market_cap / (1 + usd.total_market_cap_yesterday_percentage_change / 100) },
    { metricId: "BTC_DOMINANCE",          value: cmc.data.btc_dominance,    prior: null as number | null },
    { metricId: "ETH_DOMINANCE",          value: cmc.data.eth_dominance,    prior: null as number | null },
    { metricId: "TOTAL_VOLUME_24H",       value: usd.total_volume_24h,      prior: null as number | null },
    { metricId: "STABLECOIN_MARKET_CAP",  value: usd.stablecoin_market_cap, prior: usd.stablecoin_market_cap / (1 + usd.stablecoin_24h_percentage_change / 100) },
    { metricId: "DEFI_MARKET_CAP",        value: usd.defi_market_cap,       prior: usd.defi_market_cap / (1 + usd.defi_24h_percentage_change / 100) },
    { metricId: "DEFI_TVL",               value: currentTvl,                prior: priorTvl },
    { metricId: "FEAR_GREED",             value: fgValue,                   prior: fgPrior },
  ];
  return raw.map(({ metricId, value, prior }) => {
    const def = METRICS_BY_ID.get(metricId)!;
    const delta = prior !== null ? fmt(value - prior) : null;
    const deltaPct = prior !== null ? fmt(pct(value, prior)) : null;
    const { signal, rationale } = deriveCryptoSignal(metricId, value, prior);
    return { metricId, name: def.name, category: def.category, source: def.source, unit: def.unit, latestValue: fmt(value), latestDate: today, priorValue: prior !== null ? fmt(prior) : null, periodDelta: delta, periodDeltaPct: deltaPct, signal, signalRationale: rationale, lastUpdated: now };
  });
}

function transformCryptoCategories(metrics: CryptoMetric[], cmc: CMC): CategorySnapshot[] {
  const usd = cmc.data.quote.USD;
  const regime = inferCryptoRegime(metrics);
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();
  return [
    { slug:"bitcoin",     name:"Bitcoin",               marketCap: usd.total_market_cap * (cmc.data.btc_dominance/100), dominance: cmc.data.btc_dominance,                                   drivers:["BTC_DOMINANCE","FEAR_GREED"] },
    { slug:"ethereum",    name:"Ethereum Ecosystem",    marketCap: usd.total_market_cap * (cmc.data.eth_dominance/100), dominance: cmc.data.eth_dominance,                                   drivers:["ETH_DOMINANCE","DEFI_TVL"] },
    { slug:"defi",        name:"Decentralized Finance", marketCap: usd.defi_market_cap,                                 dominance: fmt((usd.defi_market_cap/usd.total_market_cap)*100),      drivers:["DEFI_TVL","DEFI_MARKET_CAP","ETH_DOMINANCE"] },
    { slug:"stablecoins", name:"Stablecoins",           marketCap: usd.stablecoin_market_cap,                           dominance: fmt((usd.stablecoin_market_cap/usd.total_market_cap)*100),drivers:["STABLECOIN_MARKET_CAP","FEAR_GREED"] },
    { slug:"altcoins",    name:"Altcoins",              marketCap: usd.altcoin_market_cap,                              dominance: fmt((usd.altcoin_market_cap/usd.total_market_cap)*100),   drivers:["BTC_DOMINANCE","FEAR_GREED","TOTAL_MARKET_CAP"] },
  ].map(({ slug, name, marketCap, dominance, drivers }) => {
    const { signal, rationale } = categorySignalFn(slug, metrics, regime);
    return { snapshotId:`${slug}_${today}`, categoryName:name, categorySlug:slug, totalMarketCapUsd:fmt(marketCap), dayChangePct:fmt(usd.total_market_cap_yesterday_percentage_change), dominancePct:fmt(dominance), cryptoRegime:regime, primaryMetricDrivers:drivers, categorySignal:signal, signalRationale:rationale, ingestedAt:now };
  });
}

// ---------------------------------------------------------------------------
// Public API — async, fetches live data, falls back to fixtures on error
// ---------------------------------------------------------------------------

export async function runPipeline(): Promise<PipelineOutput> {
  const fredKey = process.env.FRED_API_KEY;
  const cmcKey = process.env.COINMARKETCAP_API_KEY;

  const [fredResults, sectorData, cmcData, tvlData, fgData] = await Promise.all([
    fredKey
      ? fetchFREDLive(fredKey).then(r => r.length >= 4 ? r : fredFixture())
      : Promise.resolve(fredFixture()),
    fetchSectorsLive().catch(() => sectorFixture()),
    cmcKey
      ? fetchCMCLive(cmcKey).catch(() => cmcFixture())
      : Promise.resolve(cmcFixture()),
    fetchDeFiLlamaLive().catch((): { currentTvl: number; priorTvl: number | null } =>
      ({ currentTvl: 88_500_000_000, priorTvl: 95_200_000_000 })
    ),
    fetchFearGreedLive().catch((): { value: number; priorValue: number | null } =>
      ({ value: 44, priorValue: 38 })
    ),
  ]);

  const indicators = fredResults.map(transformFREDResult).filter((i): i is MacroIndicator => i !== null);
  const sectors = transformSectorData(sectorData, indicators);
  const cryptoMetrics = transformCryptoMetrics(cmcData, tvlData.currentTvl, tvlData.priorTvl, fgData.value, fgData.priorValue);
  const categories = transformCryptoCategories(cryptoMetrics, cmcData);

  return { indicators, sectors, cryptoMetrics, categories, generatedAt: new Date().toISOString() };
}
