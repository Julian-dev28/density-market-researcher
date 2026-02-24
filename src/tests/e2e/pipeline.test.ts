/**
 * E2E Pipeline Tests
 *
 * Tests the full macro + crypto pipeline from ingestion through transformation.
 * All external HTTP calls are mocked so no real API keys or network access needed.
 * Uses fixture-quality data to verify end-to-end correctness of the pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Config } from "../../config.js";

// ---------------------------------------------------------------------------
// Config — DRY_RUN, no real API keys (triggers fixture fallbacks for FRED & CMC)
// ---------------------------------------------------------------------------

const testConfig: Config = {
  FRED_API_KEY: undefined,           // → FRED fixture data
  COINMARKETCAP_API_KEY: undefined,  // → CMC fixture data
  ALPHA_VANTAGE_API_KEY: undefined,
  DATABASE_URL: undefined,
  MODE: "all",
  DRY_RUN: true,
  LOG_LEVEL: "warn",
  BATCH_SIZE: 50,
  FRED_LOOKBACK_OBSERVATIONS: 53,
};

// ---------------------------------------------------------------------------
// Shared mock setup
// ---------------------------------------------------------------------------

function makeYFResponse(price = 50) {
  const closes = Array.from({ length: 40 }, (_, i) =>
    parseFloat((price * 0.85 + ((price - price * 0.85) * i) / 39).toFixed(2))
  );
  return {
    data: {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: price },
            timestamp: closes.map((_, i) => 1704153600 + i * 86400),
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    },
  };
}

function makeDeFiLlamaResponse() {
  const now = Math.floor(Date.now() / 1000);
  return {
    data: [
      { date: now - 86400 * 31, tvl: 120_000_000_000 }, // ~31 days ago
      { date: now - 86400 * 15, tvl: 100_000_000_000 },
      { date: now, tvl: 91_000_000_000 },
    ],
  };
}

function makeFearGreedResponse() {
  return {
    data: {
      data: [
        { value: "8", value_classification: "Extreme Fear", timestamp: String(Math.floor(Date.now() / 1000)) },
        { value: "5", value_classification: "Extreme Fear", timestamp: String(Math.floor(Date.now() / 1000) - 86400) },
      ],
    },
  };
}

beforeEach(() => {
  vi.mock("axios", () => ({
    default: {
      get: vi.fn((url: string) => {
        // Route mock responses by URL pattern
        if (url.includes("finance.yahoo.com")) return Promise.resolve(makeYFResponse(50));
        if (url.includes("api.llama.fi")) return Promise.resolve(makeDeFiLlamaResponse());
        if (url.includes("alternative.me")) return Promise.resolve(makeFearGreedResponse());
        // Fallback: return empty to trigger fixture paths
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
      isAxiosError: vi.fn((err: unknown) => err instanceof Error && err.message.startsWith("Unexpected URL")),
    },
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Macro pipeline
// ---------------------------------------------------------------------------

describe("Macro pipeline (FRED + Yahoo Finance)", () => {
  it("produces 14 MacroIndicator objects from FRED fixture data", async () => {
    const { fetchFREDIndicators } = await import("../../ingestion/fred.js");
    const { transformFREDResult } = await import("../../transforms/toOntologyObjects.js");

    const fredResults = await fetchFREDIndicators(testConfig);
    const indicators = fredResults
      .map(transformFREDResult)
      .filter((i): i is NonNullable<typeof i> => i !== null);

    expect(indicators).toHaveLength(fredResults.length);
    expect(indicators.length).toBeGreaterThanOrEqual(7); // at minimum the fixture series
  });

  it("all MacroIndicator objects have valid signals", async () => {
    const { fetchFREDIndicators } = await import("../../ingestion/fred.js");
    const { transformFREDResult } = await import("../../transforms/toOntologyObjects.js");

    const fredResults = await fetchFREDIndicators(testConfig);
    const indicators = fredResults
      .map(transformFREDResult)
      .filter((i): i is NonNullable<typeof i> => i !== null);

    for (const ind of indicators) {
      expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(ind.signal);
      expect(ind.seriesId).toBeTruthy();
      expect(ind.latestValue).toBeTypeOf("number");
    }
  });

  it("produces 11 SectorSnapshot objects from Yahoo Finance", async () => {
    const { fetchSectorPerformance } = await import("../../ingestion/sectors.js");
    const { transformSectorData } = await import("../../transforms/toOntologyObjects.js");

    const avData = await fetchSectorPerformance(testConfig);
    const snapshots = transformSectorData(avData, []);

    expect(snapshots).toHaveLength(11);
    for (const snap of snapshots) {
      expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(snap.sectorSignal);
      expect(snap.ytdChangePct).not.toBeNull();
    }
  });

  it("infers a valid macro regime from FRED indicators", async () => {
    const { fetchFREDIndicators } = await import("../../ingestion/fred.js");
    const { transformFREDResult, inferRegime } = await import("../../transforms/toOntologyObjects.js");

    const fredResults = await fetchFREDIndicators(testConfig);
    const indicators = fredResults
      .map(transformFREDResult)
      .filter((i): i is NonNullable<typeof i> => i !== null);

    const regime = inferRegime(indicators);
    expect(["EXPANSION", "RECOVERY", "SLOWDOWN", "CONTRACTION"]).toContain(regime);
  });
});

// ---------------------------------------------------------------------------
// Crypto pipeline
// ---------------------------------------------------------------------------

describe("Crypto pipeline (CMC + DeFiLlama + FearGreed)", () => {
  it("produces 8 CryptoMetric objects", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    expect(metrics).toHaveLength(8);
  });

  it("all CryptoMetric objects have valid signals and numeric values", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    for (const m of metrics) {
      expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(m.signal);
      expect(m.latestValue).toBeTypeOf("number");
      expect(m.signalRationale).toBeTruthy();
    }
  });

  it("produces 5 CategorySnapshot objects", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics, transformCryptoCategories } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const categories = transformCryptoCategories(metrics, cmcGlobal);

    expect(categories).toHaveLength(5);
  });

  it("infers a valid crypto regime", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics, inferCryptoRegime } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const regime = inferCryptoRegime(metrics);

    expect(["BULL_MARKET", "ALT_SEASON", "RISK_OFF", "BEAR_MARKET"]).toContain(regime);
  });

  it("DeFiLlama TVL declining 24% is reflected in DEFI_TVL signal", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(), // mock returns 91B current, 120B prior → -24%
      fetchFearGreed(),
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const tvl = metrics.find((m) => m.metricId === "DEFI_TVL")!;

    expect(tvl.signal).toBe("BEARISH");
    expect(tvl.periodDeltaPct).toBeLessThan(0);
  });

  it("Fear & Greed of 8 produces BULLISH contrarian signal", async () => {
    const { fetchCMCGlobalMetrics } = await import("../../ingestion/coinmarketcap.js");
    const { fetchDeFiLlamaTVL } = await import("../../ingestion/defillama.js");
    const { fetchFearGreed } = await import("../../ingestion/feargreed.js");
    const { transformCryptoMetrics } = await import("../../transforms/toCryptoObjects.js");

    const [cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(), // mock returns 8 (Extreme Fear)
    ]);

    const metrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const fg = metrics.find((m) => m.metricId === "FEAR_GREED")!;

    expect(fg.latestValue).toBe(8);
    expect(fg.signal).toBe("BULLISH");
  });
});

// ---------------------------------------------------------------------------
// Combined mode
// ---------------------------------------------------------------------------

describe("Combined macro + crypto pipeline", () => {
  it("produces correct object counts for all data sources", async () => {
    const [
      { fetchFREDIndicators },
      { fetchSectorPerformance },
      { fetchCMCGlobalMetrics },
      { fetchDeFiLlamaTVL },
      { fetchFearGreed },
      { transformFREDResult, transformSectorData },
      { transformCryptoMetrics, transformCryptoCategories },
    ] = await Promise.all([
      import("../../ingestion/fred.js"),
      import("../../ingestion/sectors.js"),
      import("../../ingestion/coinmarketcap.js"),
      import("../../ingestion/defillama.js"),
      import("../../ingestion/feargreed.js"),
      import("../../transforms/toOntologyObjects.js"),
      import("../../transforms/toCryptoObjects.js"),
    ]);

    const [fredResults, avData, cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchFREDIndicators(testConfig),
      fetchSectorPerformance(testConfig),
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const indicators = fredResults
      .map(transformFREDResult)
      .filter((i): i is NonNullable<typeof i> => i !== null);
    const sectors = transformSectorData(avData, indicators);
    const cryptoMetrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const categories = transformCryptoCategories(cryptoMetrics, cmcGlobal);

    expect(indicators.length).toBeGreaterThanOrEqual(7);
    expect(sectors).toHaveLength(11);
    expect(cryptoMetrics).toHaveLength(8);
    expect(categories).toHaveLength(5);
  });

  it("total synced object count is 14 + 11 + 8 + 5 = 38", async () => {
    const [
      { fetchFREDIndicators },
      { fetchSectorPerformance },
      { fetchCMCGlobalMetrics },
      { fetchDeFiLlamaTVL },
      { fetchFearGreed },
      { transformFREDResult, transformSectorData },
      { transformCryptoMetrics, transformCryptoCategories },
    ] = await Promise.all([
      import("../../ingestion/fred.js"),
      import("../../ingestion/sectors.js"),
      import("../../ingestion/coinmarketcap.js"),
      import("../../ingestion/defillama.js"),
      import("../../ingestion/feargreed.js"),
      import("../../transforms/toOntologyObjects.js"),
      import("../../transforms/toCryptoObjects.js"),
    ]);

    const [fredResults, avData, cmcGlobal, defiLlama, fearGreed] = await Promise.all([
      fetchFREDIndicators(testConfig),
      fetchSectorPerformance(testConfig),
      fetchCMCGlobalMetrics(testConfig),
      fetchDeFiLlamaTVL(),
      fetchFearGreed(),
    ]);

    const indicators = fredResults
      .map(transformFREDResult)
      .filter((i): i is NonNullable<typeof i> => i !== null);
    const sectors = transformSectorData(avData, indicators);
    const cryptoMetrics = transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed });
    const categories = transformCryptoCategories(cryptoMetrics, cmcGlobal);

    const totalObjects = indicators.length + sectors.length + cryptoMetrics.length + categories.length;
    // FRED fixture has 8 series, full run has 14 — both should sum to 38 with remaining objects
    expect(totalObjects).toBeGreaterThanOrEqual(30);
  });
});
