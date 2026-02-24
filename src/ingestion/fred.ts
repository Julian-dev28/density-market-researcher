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

// Minimal fixture used when no API key is configured (tests + dry-run without credentials).
const FRED_FIXTURE: FREDFetchResult[] = [
  { seriesId: "DFF",        info: { id: "DFF",        title: "Federal Funds Rate",         frequency_short: "D", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "5.33" }, { date: "2025-12-01", value: "5.33" }] } },
  { seriesId: "DGS10",      info: { id: "DGS10",      title: "10-Year Treasury",           frequency_short: "D", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "4.60" }, { date: "2025-12-01", value: "4.20" }] } },
  { seriesId: "T10Y2Y",     info: { id: "T10Y2Y",     title: "10Y-2Y Spread",              frequency_short: "D", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "0.60" }, { date: "2025-12-01", value: "0.74" }] } },
  { seriesId: "CPIAUCSL",   info: { id: "CPIAUCSL",   title: "CPI (Headline)",             frequency_short: "M", units: "Index",         last_updated: "2026-01-01" }, observations: { units: "Index",    count: 2, observations: [{ date: "2026-01-01", value: "315.8" }, { date: "2025-12-01", value: "314.1" }] } },
  { seriesId: "CPILFESL",   info: { id: "CPILFESL",   title: "Core CPI",                  frequency_short: "M", units: "Index",         last_updated: "2026-01-01" }, observations: { units: "Index",    count: 2, observations: [{ date: "2026-01-01", value: "327.2" }, { date: "2025-12-01", value: "326.2" }] } },
  { seriesId: "PPIACO",     info: { id: "PPIACO",     title: "Producer Price Index",       frequency_short: "M", units: "Index",         last_updated: "2026-01-01" }, observations: { units: "Index",    count: 2, observations: [{ date: "2026-01-01", value: "241.4" }, { date: "2025-12-01", value: "240.1" }] } },
  { seriesId: "UNRATE",     info: { id: "UNRATE",     title: "Unemployment Rate",          frequency_short: "M", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "4.3"   }, { date: "2025-12-01", value: "4.2"   }] } },
  { seriesId: "PAYEMS",     info: { id: "PAYEMS",     title: "Nonfarm Payrolls",           frequency_short: "M", units: "Thousands",     last_updated: "2026-01-01" }, observations: { units: "Thousands",count: 2, observations: [{ date: "2026-01-01", value: "159100"},  { date: "2025-12-01", value: "158970" }] } },
  { seriesId: "GDP",        info: { id: "GDP",        title: "Gross Domestic Product",     frequency_short: "Q", units: "Billions",      last_updated: "2026-01-01" }, observations: { units: "Billions", count: 2, observations: [{ date: "2025-10-01", value: "31490" }, { date: "2025-07-01", value: "31100" }] } },
  { seriesId: "INDPRO",     info: { id: "INDPRO",     title: "Industrial Production",      frequency_short: "M", units: "Index",         last_updated: "2026-01-01" }, observations: { units: "Index",    count: 2, observations: [{ date: "2026-01-01", value: "102.3" }, { date: "2025-12-01", value: "101.9" }] } },
  { seriesId: "BAMLH0A0HYM2",info:{id:"BAMLH0A0HYM2",title:"HY Credit Spread",            frequency_short: "D", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "2.95"  }, { date: "2025-12-01", value: "2.60"  }] } },
  { seriesId: "MORTGAGE30US",info:{id:"MORTGAGE30US", title:"30-Year Mortgage Rate",       frequency_short: "W", units: "Percent",       last_updated: "2026-01-01" }, observations: { units: "Percent",  count: 2, observations: [{ date: "2026-01-01", value: "6.87"  }, { date: "2025-12-01", value: "6.72"  }] } },
  { seriesId: "HOUST",      info: { id: "HOUST",      title: "Housing Starts",             frequency_short: "M", units: "Thousands",     last_updated: "2026-01-01" }, observations: { units: "Thousands",count: 2, observations: [{ date: "2026-01-01", value: "1380"  }, { date: "2025-12-01", value: "1410"  }] } },
  { seriesId: "UMCSENT",    info: { id: "UMCSENT",    title: "Consumer Sentiment",         frequency_short: "M", units: "Index",         last_updated: "2026-01-01" }, observations: { units: "Index",    count: 2, observations: [{ date: "2026-01-01", value: "56.4"  }, { date: "2025-12-01", value: "74.0"  }] } },
];

export async function fetchFREDIndicators(
  cfg: Config
): Promise<FREDFetchResult[]> {
  if (!cfg.FRED_API_KEY) {
    console.log("[FRED] No API key — using fixture data.");
    return FRED_FIXTURE;
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
