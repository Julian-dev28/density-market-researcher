import axios from "axios";
import type { CMCGlobalMetrics } from "../types/index.js";
import type { Config } from "../config.js";

// ============================================================
// CoinMarketCap Global Metrics Client
//
// Free tier endpoint: /v1/global-metrics/quotes/latest
// Returns: total market cap, BTC/ETH dominance, DeFi market cap,
//          stablecoin market cap, 24h volume, and daily change %.
//
// Free API key: https://coinmarketcap.com/api/
// ============================================================

const CMC_BASE = "https://pro-api.coinmarketcap.com";

export async function fetchCMCGlobalMetrics(cfg: Config): Promise<CMCGlobalMetrics> {
  if (!cfg.COINMARKETCAP_API_KEY) {
    throw new Error(
      "COINMARKETCAP_API_KEY is not set. Get a free key at https://coinmarketcap.com/api/"
    );
  }

  console.log("[CMC] Fetching global crypto metrics...");

  try {
    const response = await axios.get<CMCGlobalMetrics>(
      `${CMC_BASE}/v1/global-metrics/quotes/latest`,
      {
        headers: { "X-CMC_PRO_API_KEY": cfg.COINMARKETCAP_API_KEY },
        timeout: 10_000,
      }
    );

    if (response.data.status.error_code !== 0) {
      throw new Error(`[CMC] API error code ${response.data.status.error_code}`);
    }

    console.log("[CMC] ✓ Global metrics fetched");
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(`[CMC] Request failed: HTTP ${err.response?.status ?? "unknown"} — ${err.message}`);
    }
    throw err;
  }
}
