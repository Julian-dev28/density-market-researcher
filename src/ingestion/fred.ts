import axios from "axios";
import type { FREDSeriesResponse, FREDSeriesInfo } from "../types/index.js";
import type { Config } from "../config.js";
import { FRED_SERIES } from "./fredRegistry.js";

// ============================================================
// FRED (Federal Reserve Economic Data) API Client
//
// Free API from the St. Louis Federal Reserve.
// API key required (free): https://fred.stlouisfed.org/docs/api/api_key.html
// Rate limit: 120 requests/minute per key.
//
// Without a key, sample fixture data is used for dry-run mode.
// ============================================================

const FRED_BASE = "https://api.stlouisfed.org/fred";

export interface FREDFetchResult {
  seriesId: string;
  info: FREDSeriesInfo;
  observations: FREDSeriesResponse;
}

/** Fetches info + recent observations for a single FRED series */
async function fetchSeries(
  seriesId: string,
  apiKey: string,
  lookbackObs: number
): Promise<FREDFetchResult> {
  const [infoRes, obsRes] = await Promise.all([
    axios.get(`${FRED_BASE}/series`, {
      params: { series_id: seriesId, api_key: apiKey, file_type: "json" },
      timeout: 10_000,
    }),
    axios.get(`${FRED_BASE}/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: apiKey,
        file_type: "json",
        sort_order: "desc",
        limit: lookbackObs,
      },
      timeout: 10_000,
    }),
  ]);

  return {
    seriesId,
    info: infoRes.data.seriess[0] as FREDSeriesInfo,
    observations: obsRes.data as FREDSeriesResponse,
  };
}

/** Polite delay between FRED requests */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches all registered FRED series with rate-limit-friendly sequential requests.
 * Falls back to fixture data if no API key is configured.
 */
export async function fetchFREDIndicators(
  cfg: Config
): Promise<FREDFetchResult[]> {
  if (!cfg.FRED_API_KEY) {
    console.log("[FRED] No API key — using fixture data.");
    console.log("[FRED] Get a free key: https://fred.stlouisfed.org/docs/api/api_key.html");
    return getSampleFREDData();
  }

  console.log(`[FRED] Fetching ${FRED_SERIES.length} indicator series...`);
  const results: FREDFetchResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < FRED_SERIES.length; i++) {
    const series = FRED_SERIES[i];
    try {
      const result = await fetchSeries(
        series.seriesId,
        cfg.FRED_API_KEY,
        cfg.FRED_LOOKBACK_OBSERVATIONS
      );
      results.push(result);
      process.stdout.write(
        `\r[FRED] ${i + 1}/${FRED_SERIES.length} series fetched`
      );
      // Respect FRED rate limit: ~120 req/min
      if (i < FRED_SERIES.length - 1) await delay(600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${series.seriesId}: ${msg}`);
    }
  }

  console.log(`\n[FRED] ✓ ${results.length} series fetched${errors.length ? `, ${errors.length} failed` : ""}`);
  return results;
}

// ============================================================
// Sample fixture data — realistic values as of early 2024
// ============================================================
export function getSampleFREDData(): FREDFetchResult[] {
  const mkObs = (date: string, value: string) => ({
    date,
    value,
    realtime_start: date,
    realtime_end: date,
  });

  return [
    {
      seriesId: "DFF",
      info: { id: "DFF", title: "Federal Funds Effective Rate", frequency_short: "D", units: "Percent", last_updated: "2024-08-08" },
      observations: { units: "Percent", count: 3, observations: [mkObs("2024-08-08", "5.33"), mkObs("2024-08-07", "5.33"), mkObs("2023-08-08", "5.08")] },
    },
    {
      seriesId: "DGS10",
      info: { id: "DGS10", title: "10-Year Treasury Constant Maturity Rate", frequency_short: "D", units: "Percent", last_updated: "2024-08-08" },
      observations: { units: "Percent", count: 3, observations: [mkObs("2024-08-08", "3.99"), mkObs("2024-08-07", "4.02"), mkObs("2023-08-08", "4.07")] },
    },
    {
      seriesId: "T10Y2Y",
      info: { id: "T10Y2Y", title: "10-Year minus 2-Year Treasury Spread", frequency_short: "D", units: "Percent", last_updated: "2024-08-08" },
      observations: { units: "Percent", count: 3, observations: [mkObs("2024-08-08", "-0.33"), mkObs("2024-08-07", "-0.36"), mkObs("2023-08-08", "-0.81")] },
    },
    {
      seriesId: "CPIAUCSL",
      info: { id: "CPIAUCSL", title: "Consumer Price Index for All Urban Consumers", frequency_short: "M", units: "Index 1982-1984=100", last_updated: "2024-07-11" },
      observations: { units: "Index 1982-1984=100", count: 3, observations: [mkObs("2024-06-01", "314.175"), mkObs("2024-05-01", "313.225"), mkObs("2023-06-01", "305.109")] },
    },
    {
      seriesId: "CPILFESL",
      info: { id: "CPILFESL", title: "Consumer Price Index: All Items Less Food and Energy", frequency_short: "M", units: "Index 1982-1984=100", last_updated: "2024-07-11" },
      observations: { units: "Index 1982-1984=100", count: 3, observations: [mkObs("2024-06-01", "320.892"), mkObs("2024-05-01", "320.310"), mkObs("2023-06-01", "308.094")] },
    },
    {
      seriesId: "UNRATE",
      info: { id: "UNRATE", title: "Unemployment Rate", frequency_short: "M", units: "Percent", last_updated: "2024-08-02" },
      observations: { units: "Percent", count: 3, observations: [mkObs("2024-07-01", "4.3"), mkObs("2024-06-01", "4.1"), mkObs("2023-07-01", "3.5")] },
    },
    {
      seriesId: "UMCSENT",
      info: { id: "UMCSENT", title: "University of Michigan: Consumer Sentiment", frequency_short: "M", units: "Index 1966:Q1=100", last_updated: "2024-08-02" },
      observations: { units: "Index 1966:Q1=100", count: 3, observations: [mkObs("2024-07-01", "66.4"), mkObs("2024-06-01", "68.2"), mkObs("2023-07-01", "71.6")] },
    },
    {
      seriesId: "BAMLH0A0HYM2",
      info: { id: "BAMLH0A0HYM2", title: "ICE BofA US High Yield OAS", frequency_short: "D", units: "Percent", last_updated: "2024-08-08" },
      observations: { units: "Percent", count: 3, observations: [mkObs("2024-08-08", "3.84"), mkObs("2024-08-07", "3.61"), mkObs("2023-08-08", "3.91")] },
    },
  ];
}
