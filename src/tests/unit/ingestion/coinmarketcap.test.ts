import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import type { Config } from "../../../config.js";
import { fetchCMCGlobalMetrics } from "../../../ingestion/coinmarketcap.js";

vi.mock("axios");

const baseConfig: Config = {
  FRED_API_KEY: undefined,
  ALPHA_VANTAGE_API_KEY: undefined,
  COINMARKETCAP_API_KEY: undefined,
  DATABASE_URL: undefined,
  MODE: "crypto",
  DRY_RUN: true,
  LOG_LEVEL: "info",
  BATCH_SIZE: 50,
  FRED_LOOKBACK_OBSERVATIONS: 53,
};

function makeCMCResponse(errorCode = 0) {
  return {
    data: {
      status: { timestamp: new Date().toISOString(), error_code: errorCode },
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
            last_updated: new Date().toISOString(),
          },
        },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.isAxiosError).mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// No API key — fixture data (axios never called)
// ---------------------------------------------------------------------------

describe("fetchCMCGlobalMetrics — fixture fallback", () => {
  it("returns fixture data when no API key is set", async () => {
    const result = await fetchCMCGlobalMetrics({ ...baseConfig });
    expect(result.status.error_code).toBe(0);
    expect(result.data.btc_dominance).toBeGreaterThan(0);
  });

  it("fixture data has all required USD quote fields", async () => {
    const result = await fetchCMCGlobalMetrics({ ...baseConfig });
    const usd = result.data.quote.USD;
    expect(usd.total_market_cap).toBeGreaterThan(0);
    expect(usd.stablecoin_market_cap).toBeGreaterThan(0);
    expect(usd.defi_market_cap).toBeGreaterThan(0);
    expect(typeof usd.total_market_cap_yesterday_percentage_change).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Live API path — mocked axios
// ---------------------------------------------------------------------------

describe("fetchCMCGlobalMetrics — with API key (mocked axios)", () => {
  it("returns parsed API response on success", async () => {
    vi.mocked(axios.get).mockResolvedValue(makeCMCResponse() as never);

    const result = await fetchCMCGlobalMetrics({
      ...baseConfig,
      COINMARKETCAP_API_KEY: "test-key",
    });

    expect(result.data.btc_dominance).toBe(57.7);
    expect(result.data.quote.USD.total_market_cap).toBe(2_200_000_000_000);
  });

  it("falls back to fixture on non-zero error_code", async () => {
    vi.mocked(axios.get).mockResolvedValue(makeCMCResponse(1001) as never);

    const result = await fetchCMCGlobalMetrics({
      ...baseConfig,
      COINMARKETCAP_API_KEY: "test-key",
    });

    // Should return fixture data (not the mocked 2.2T value)
    expect(result.status.error_code).toBe(0);
  });

  it("throws on axios network error", async () => {
    const err = Object.assign(new Error("Network Error"), {
      isAxiosError: true,
      response: { status: 503 },
    });
    vi.mocked(axios.get).mockRejectedValue(err);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    await expect(
      fetchCMCGlobalMetrics({ ...baseConfig, COINMARKETCAP_API_KEY: "test-key" })
    ).rejects.toThrow("CMC");
  });
});
