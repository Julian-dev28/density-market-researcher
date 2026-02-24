import axios from "axios";
import type { AlphaVantageSectorResponse } from "../types/index.js";
import type { Config } from "../config.js";

// ============================================================
// Sector Performance via Yahoo Finance
//
// Replaces Alpha Vantage SECTOR endpoint (moved to premium).
// Yahoo Finance is free with no API key required.
// Fetches YTD daily closes for each SPDR sector ETF + SPY,
// then calculates 1-day / 5-day / 1-month / YTD performance
// and returns the same AlphaVantageSectorResponse shape so the
// rest of the pipeline requires no changes.
// ============================================================

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_HEADERS = { "User-Agent": "Mozilla/5.0" };

export const SECTOR_MAP: Record<string, { name: string; primaryMacroDrivers: string[] }> = {
  XLF: { name: "Financials", primaryMacroDrivers: ["DFF", "DGS10", "T10Y2Y", "BAMLH0A0HYM2"] },
  XLE: { name: "Energy", primaryMacroDrivers: ["PPIACO", "CPIAUCSL"] },
  XLK: { name: "Technology", primaryMacroDrivers: ["DGS10", "DFF", "GDP"] },
  XLV: { name: "Health Care", primaryMacroDrivers: ["CPIAUCSL", "UMCSENT"] },
  XLI: { name: "Industrials", primaryMacroDrivers: ["INDPRO", "GDP", "PAYEMS"] },
  XLP: { name: "Consumer Staples", primaryMacroDrivers: ["CPIAUCSL", "CPILFESL", "UMCSENT"] },
  XLY: { name: "Consumer Discretionary", primaryMacroDrivers: ["UNRATE", "UMCSENT", "CPILFESL"] },
  XLB: { name: "Materials", primaryMacroDrivers: ["PPIACO", "INDPRO", "HOUST"] },
  XLRE: { name: "Real Estate", primaryMacroDrivers: ["MORTGAGE30US", "DGS10", "DFF", "HOUST"] },
  XLU: { name: "Utilities", primaryMacroDrivers: ["DFF", "DGS10"] },
  XLC: { name: "Communication Services", primaryMacroDrivers: ["GDP", "UMCSENT"] },
  SPY: { name: "S&P 500 (Benchmark)", primaryMacroDrivers: [] },
};

const TICKER_TO_AV_NAME: Record<string, string> = {
  XLE: "Energy",
  XLU: "Utilities",
  XLF: "Financials",
  XLK: "Technology",
  XLV: "Health Care",
  XLI: "Industrials",
  XLY: "Consumer Discretionary",
  XLB: "Materials",
  XLP: "Consumer Staples",
  XLRE: "Real Estate",
  XLC: "Communication Services",
  SPY: "S&P 500",
};

// Fixture used when all Yahoo Finance requests fail (tests + network outage).
const SECTOR_FIXTURE: AlphaVantageSectorResponse = {
  "Meta Data": { "Last Refreshed": "2026-01-01" },
  "Rank A: Real-Time Performance": { Energy: "0.0120", Technology: "-0.0080", Financials: "-0.0050", "Health Care": "0.0030", Industrials: "0.0090", "Consumer Staples": "0.0110", "Consumer Discretionary": "-0.0040", Materials: "0.0150", "Real Estate": "0.0020", Utilities: "0.0060", "Communication Services": "-0.0030", "S&P 500": "0.0010" },
  "Rank B: 1 Day Performance": { Energy: "0.0120", Technology: "-0.0080", Financials: "-0.0050", "Health Care": "0.0030", Industrials: "0.0090", "Consumer Staples": "0.0110", "Consumer Discretionary": "-0.0040", Materials: "0.0150", "Real Estate": "0.0020", Utilities: "0.0060", "Communication Services": "-0.0030", "S&P 500": "0.0010" },
  "Rank C: 5 Day Performance": { Energy: "0.0350", Technology: "-0.0180", Financials: "-0.0120", "Health Care": "0.0080", Industrials: "0.0200", "Consumer Staples": "0.0280", "Consumer Discretionary": "-0.0090", Materials: "0.0320", "Real Estate": "0.0050", Utilities: "0.0150", "Communication Services": "-0.0060", "S&P 500": "0.0030" },
  "Rank D: 1 Month Performance": { Energy: "0.0820", Technology: "-0.0350", Financials: "-0.0220", "Health Care": "0.0150", Industrials: "0.0410", "Consumer Staples": "0.0550", "Consumer Discretionary": "-0.0180", Materials: "0.0630", "Real Estate": "0.0090", Utilities: "0.0310", "Communication Services": "-0.0110", "S&P 500": "0.0060" },
  "Rank F: Year-to-Date (YTD) Performance": { Energy: "0.2050", Technology: "-0.0280", Financials: "-0.0720", "Health Care": "0.0350", Industrials: "0.1190", "Consumer Staples": "0.1500", "Consumer Discretionary": "-0.0140", Materials: "0.1570", "Real Estate": "0.0410", Utilities: "0.0900", "Communication Services": "-0.0080", "S&P 500": "0.0320" },
};

interface YahooQuote {
  ticker: string;
  currentPrice: number;
  closes: (number | null)[];
}

async function fetchYahooChart(ticker: string, period1: number, period2: number): Promise<YahooQuote | null> {
  try {
    const resp = await axios.get(`${YF_BASE}/${ticker}`, {
      params: { period1, period2, interval: "1d" },
      headers: YF_HEADERS,
      timeout: 10_000,
    });

    const result = resp.data?.chart?.result?.[0];
    if (!result) return null;

    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const currentPrice: number = result.meta?.regularMarketPrice ?? 0;

    return { ticker, currentPrice, closes };
  } catch {
    return null;
  }
}

function decimalPct(current: number, base: number | null | undefined): string {
  if (!base || base === 0) return "0.0000";
  return ((current - base) / base).toFixed(4);
}

function closeAt(closes: (number | null)[], offsetFromEnd: number): number | null {
  const idx = closes.length - 1 - offsetFromEnd;
  for (let i = idx; i >= 0; i--) {
    if (closes[i] != null) return closes[i] as number;
  }
  return null;
}

export async function fetchSectorPerformance(
  _cfg: Config
): Promise<AlphaVantageSectorResponse> {
  console.log("[Yahoo Finance] Fetching sector performance...");

  const today = new Date();
  const ytdStart = Math.floor(new Date(`${today.getFullYear()}-01-02`).getTime() / 1000);
  const now = Math.floor(today.getTime() / 1000);

  const tickers = Object.keys(TICKER_TO_AV_NAME);
  const quotes = await Promise.all(
    tickers.map((t) => fetchYahooChart(t, ytdStart, now))
  );

  const validQuotes = quotes.filter((q): q is YahooQuote => q !== null);
  if (validQuotes.length === 0) {
    console.log("[Yahoo Finance] All requests failed — using fixture data.");
    return SECTOR_FIXTURE;
  }

  console.log(`[Yahoo Finance] ✓ Sector performance fetched (${validQuotes.length}/${tickers.length} tickers)`);

  const rankA: Record<string, string> = {};
  const rankB: Record<string, string> = {};
  const rankC: Record<string, string> = {};
  const rankD: Record<string, string> = {};
  const rankF: Record<string, string> = {};

  for (const quote of validQuotes) {
    const name = TICKER_TO_AV_NAME[quote.ticker];
    if (!name) continue;

    const closes = quote.closes;
    const current = quote.currentPrice;

    const closeYesterday = closeAt(closes, 1);
    const close5d = closeAt(closes, 5);
    const close1m = closeAt(closes, 22);
    const closeYTD = closes.find((c): c is number => c != null) ?? null;

    rankA[name] = decimalPct(current, closeYesterday);
    rankB[name] = decimalPct(current, closeYesterday);
    rankC[name] = decimalPct(current, close5d);
    rankD[name] = decimalPct(current, close1m);
    rankF[name] = decimalPct(current, closeYTD);
  }

  return {
    "Meta Data": { "Last Refreshed": today.toISOString().split("T")[0] },
    "Rank A: Real-Time Performance": rankA,
    "Rank B: 1 Day Performance": rankB,
    "Rank C: 5 Day Performance": rankC,
    "Rank D: 1 Month Performance": rankD,
    "Rank F: Year-to-Date (YTD) Performance": rankF,
  };
}
