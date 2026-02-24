import { describe, it, expect } from "vitest";
import type { Config } from "../../../config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig: Config = {
  FRED_API_KEY: undefined,
  ALPHA_VANTAGE_API_KEY: undefined,
  COINMARKETCAP_API_KEY: undefined,
  FOUNDRY_URL: undefined,
  FOUNDRY_CLIENT_ID: undefined,
  FOUNDRY_CLIENT_SECRET: undefined,
  FOUNDRY_TOKEN: undefined,
  MODE: "macro",
  DRY_RUN: true,
  LOG_LEVEL: "info",
  BATCH_SIZE: 50,
  FRED_LOOKBACK_OBSERVATIONS: 53,
};

// ---------------------------------------------------------------------------
// No-API-key path (fixture data) — no axios mock needed
// ---------------------------------------------------------------------------

describe("fetchFREDIndicators — fixture fallback", () => {
  it("returns an array of results when no API key is set", async () => {
    const { fetchFREDIndicators } = await import("../../../ingestion/fred.js");
    const results = await fetchFREDIndicators({ ...baseConfig, FRED_API_KEY: undefined });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("each fixture result has seriesId, info, and observations", async () => {
    const { fetchFREDIndicators } = await import("../../../ingestion/fred.js");
    const results = await fetchFREDIndicators({ ...baseConfig });
    for (const r of results) {
      expect(r.seriesId).toBeTruthy();
      expect(r.info).toBeDefined();
      expect(r.info.id).toBeTruthy();
      expect(r.info.frequency_short).toBeTruthy();
      expect(Array.isArray(r.observations.observations)).toBe(true);
    }
  });

  it("fixture data includes DFF and CPIAUCSL series", async () => {
    const { fetchFREDIndicators } = await import("../../../ingestion/fred.js");
    const results = await fetchFREDIndicators({ ...baseConfig });
    const ids = results.map((r) => r.seriesId);
    expect(ids).toContain("DFF");
    expect(ids).toContain("CPIAUCSL");
  });
});

