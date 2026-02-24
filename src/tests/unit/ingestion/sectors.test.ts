import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import type { Config } from "../../../config.js";
import { fetchSectorPerformance } from "../../../ingestion/sectors.js";

vi.mock("axios");

beforeEach(() => {
  vi.clearAllMocks();
});

const baseConfig: Config = {
  FRED_API_KEY: undefined,
  ALPHA_VANTAGE_API_KEY: undefined,
  COINMARKETCAP_API_KEY: undefined,
  DATABASE_URL: undefined,
  MODE: "macro",
  DRY_RUN: true,
  LOG_LEVEL: "info",
  BATCH_SIZE: 50,
  FRED_LOOKBACK_OBSERVATIONS: 53,
};

// Generate a realistic Yahoo Finance chart response
function makeYFResponse(currentPrice: number, numCloses = 40) {
  const startPrice = currentPrice * 0.85;
  const closes = Array.from({ length: numCloses }, (_, i) =>
    parseFloat((startPrice + ((currentPrice - startPrice) * i) / (numCloses - 1)).toFixed(2))
  );
  return {
    data: {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: currentPrice },
            timestamp: closes.map((_, i) => 1704153600 + i * 86400),
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    },
  };
}

describe("fetchSectorPerformance — mocked Yahoo Finance", () => {
  it("returns AlphaVantageSectorResponse shape with Meta Data", async () => {
    vi.mocked(axios.get).mockResolvedValue(makeYFResponse(50) as never);

    const result = await fetchSectorPerformance(baseConfig);

    expect(result["Meta Data"]).toBeDefined();
    expect(result["Meta Data"]["Last Refreshed"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns all 5 performance rank keys", async () => {
    vi.mocked(axios.get).mockResolvedValue(makeYFResponse(50) as never);

    const result = await fetchSectorPerformance(baseConfig);

    expect(result["Rank A: Real-Time Performance"]).toBeDefined();
    expect(result["Rank B: 1 Day Performance"]).toBeDefined();
    expect(result["Rank C: 5 Day Performance"]).toBeDefined();
    expect(result["Rank D: 1 Month Performance"]).toBeDefined();
    expect(result["Rank F: Year-to-Date (YTD) Performance"]).toBeDefined();
  });

  it("includes all 11 sectors plus S&P 500 in YTD rank", async () => {
    vi.mocked(axios.get).mockResolvedValue(makeYFResponse(50) as never);

    const result = await fetchSectorPerformance(baseConfig);
    const ytd = result["Rank F: Year-to-Date (YTD) Performance"];

    expect(Object.keys(ytd)).toContain("Energy");
    expect(Object.keys(ytd)).toContain("Technology");
    expect(Object.keys(ytd)).toContain("Financials");
    expect(Object.keys(ytd)).toContain("S&P 500");
  });

  it("YTD % reflects actual price movement (current vs first close)", async () => {
    // currentPrice = 100, first close = 85 → YTD = +17.65%
    vi.mocked(axios.get).mockResolvedValue(makeYFResponse(100) as never);

    const result = await fetchSectorPerformance(baseConfig);
    const energyYTD = parseFloat(result["Rank F: Year-to-Date (YTD) Performance"]["Energy"]);
    // (100 - 85) / 85 ≈ 0.1765
    expect(energyYTD).toBeCloseTo(0.1765, 2);
  });

  it("falls back to fixture data when all axios calls fail", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));

    const result = await fetchSectorPerformance(baseConfig);

    // Fixture data is still a valid response shape
    expect(result["Meta Data"]).toBeDefined();
    expect(result["Rank F: Year-to-Date (YTD) Performance"]).toBeDefined();
  });

  it("handles partial failures — uses data from successful tickers", async () => {
    let callCount = 0;
    vi.mocked(axios.get).mockImplementation(() => {
      callCount++;
      // Fail for the first 6 tickers, succeed for the rest
      if (callCount <= 6) return Promise.resolve({ data: { chart: { result: [null] } } } as never);
      return Promise.resolve(makeYFResponse(50) as never);
    });

    const result = await fetchSectorPerformance(baseConfig);

    // Should still return a valid response
    expect(result["Meta Data"]).toBeDefined();
  });
});
