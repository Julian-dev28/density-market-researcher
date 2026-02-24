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
// ============================================================

const FRED_BASE = "https://api.stlouisfed.org/fred";

export interface FREDFetchResult {
  seriesId: string;
  info: FREDSeriesInfo;
  observations: FREDSeriesResponse;
}

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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchFREDIndicators(
  cfg: Config
): Promise<FREDFetchResult[]> {
  if (!cfg.FRED_API_KEY) {
    throw new Error(
      "FRED_API_KEY is not set. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html"
    );
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
      process.stdout.write(`\r[FRED] ${i + 1}/${FRED_SERIES.length} series fetched`);
      if (i < FRED_SERIES.length - 1) await delay(600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${series.seriesId}: ${msg}`);
    }
  }

  console.log(
    `\n[FRED] ✓ ${results.length} series fetched${errors.length ? `, ${errors.length} failed: ${errors.join(", ")}` : ""}`
  );

  if (results.length === 0) {
    throw new Error(`[FRED] All ${FRED_SERIES.length} series failed. Check your API key and network.`);
  }

  return results;
}
