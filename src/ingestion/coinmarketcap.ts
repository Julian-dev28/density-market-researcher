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

// Fixture used when no API key is configured or the API returns an error.
const CMC_FIXTURE: CMCGlobalMetrics = {
  status: { timestamp: "2026-01-01T00:00:00Z", error_code: 0 },
  data: {
    active_cryptocurrencies: 10_482,
    btc_dominance: 57.7,
    eth_dominance: 10.2,
    quote: {
      USD: {
        total_market_cap: 2_200_000_000_000,
        total_volume_24h: 103_000_000_000,
        altcoin_market_cap: 926_000_000_000,
        defi_market_cap: 53_000_000_000,
        defi_volume_24h: 6_000_000_000,
        defi_24h_percentage_change: 2.1,
        stablecoin_market_cap: 285_000_000_000,
        stablecoin_volume_24h: 70_000_000_000,
        stablecoin_24h_percentage_change: 0.5,
        total_market_cap_yesterday_percentage_change: -2.1,
        last_updated: "2026-01-01T00:00:00Z",
      },
    },
  },
};

export async function fetchCMCGlobalMetrics(cfg: Config): Promise<CMCGlobalMetrics> {
  if (!cfg.COINMARKETCAP_API_KEY) {
    console.log("[CMC] No API key — using fixture data.");
    return CMC_FIXTURE;
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
      console.log(`[CMC] API error code ${response.data.status.error_code} — using fixture data.`);
      return CMC_FIXTURE;
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
