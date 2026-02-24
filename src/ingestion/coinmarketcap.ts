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
    console.log("[CMC] No API key — using fixture data.");
    return getSampleGlobalMetrics();
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
      console.warn("[CMC] API returned error — using fixture data.");
      return getSampleGlobalMetrics();
    }

    console.log("[CMC] ✓ Global metrics fetched");
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(`[CMC] API request failed: ${err.response?.status} ${err.message}`);
    }
    throw err;
  }
}

export function getSampleGlobalMetrics(): CMCGlobalMetrics {
  return {
    status: { timestamp: new Date().toISOString(), error_code: 0 },
    data: {
      active_cryptocurrencies: 10_482,
      btc_dominance: 58.3,
      eth_dominance: 10.2,
      quote: {
        USD: {
          total_market_cap: 2_840_000_000_000,
          total_volume_24h: 94_000_000_000,
          altcoin_market_cap: 1_185_000_000_000,
          defi_market_cap: 96_500_000_000,
          defi_volume_24h: 6_800_000_000,
          defi_24h_percentage_change: -2.3,
          stablecoin_market_cap: 228_000_000_000,
          stablecoin_volume_24h: 71_000_000_000,
          stablecoin_24h_percentage_change: 0.8,
          total_market_cap_yesterday_percentage_change: -1.4,
          last_updated: new Date().toISOString(),
        },
      },
    },
  };
}
