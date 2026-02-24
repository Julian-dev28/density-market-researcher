import { describe, it, expect } from "vitest";
import {
  transformCryptoMetrics,
  transformCryptoCategories,
  inferCryptoRegime,
  type CryptoFetchBundle,
} from "../../../transforms/toCryptoObjects.js";
import type { CMCGlobalMetrics } from "../../../types/index.js";
import type { DeFiLlamaResult } from "../../../ingestion/defillama.js";
import type { FearGreedResult } from "../../../ingestion/feargreed.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCMC(
  overrides: Partial<CMCGlobalMetrics["data"]["quote"]["USD"]> & {
    btc_dominance?: number;
    eth_dominance?: number;
  } = {}
): CMCGlobalMetrics {
  const { btc_dominance = 57.7, eth_dominance = 10.0, ...usdOverrides } = overrides;
  return {
    status: { timestamp: new Date().toISOString(), error_code: 0 },
    data: {
      active_cryptocurrencies: 10_000,
      btc_dominance,
      eth_dominance,
      quote: {
        USD: {
          total_market_cap: 2_000_000_000_000,
          total_volume_24h: 100_000_000_000,
          altcoin_market_cap: 800_000_000_000,
          defi_market_cap: 50_000_000_000,
          defi_volume_24h: 5_000_000_000,
          defi_24h_percentage_change: -2.0,
          stablecoin_market_cap: 200_000_000_000,
          stablecoin_volume_24h: 50_000_000_000,
          stablecoin_24h_percentage_change: 1.0,
          total_market_cap_yesterday_percentage_change: -2.0,
          last_updated: new Date().toISOString(),
          ...usdOverrides,
        },
      },
    },
  };
}

function makeBundle(opts: {
  cmc?: Parameters<typeof makeCMC>[0];
  defiLlama?: Partial<DeFiLlamaResult>;
  fearGreed?: Partial<FearGreedResult>;
} = {}): CryptoFetchBundle {
  return {
    cmcGlobal: makeCMC(opts.cmc ?? {}),
    defiLlama: {
      currentTvl: 90_000_000_000,
      priorTvl: 120_000_000_000,
      ...opts.defiLlama,
    },
    fearGreed: {
      value: 8,
      classification: "Extreme Fear",
      priorValue: 5,
      ...opts.fearGreed,
    },
  };
}

// ---------------------------------------------------------------------------
// transformCryptoMetrics
// ---------------------------------------------------------------------------

describe("transformCryptoMetrics", () => {
  it("returns exactly 8 metrics", () => {
    expect(transformCryptoMetrics(makeBundle())).toHaveLength(8);
  });

  it("includes all required metricIds", () => {
    const ids = transformCryptoMetrics(makeBundle()).map((m) => m.metricId);
    for (const id of [
      "TOTAL_MARKET_CAP",
      "BTC_DOMINANCE",
      "ETH_DOMINANCE",
      "TOTAL_VOLUME_24H",
      "STABLECOIN_MARKET_CAP",
      "DEFI_MARKET_CAP",
      "DEFI_TVL",
      "FEAR_GREED",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("all metrics have required fields", () => {
    for (const m of transformCryptoMetrics(makeBundle())) {
      expect(m.metricId).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.source).toBeTruthy();
      expect(m.latestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(m.signal);
    }
  });

  describe("FEAR_GREED signal", () => {
    it("BULLISH for extreme fear (≤25)", () => {
      const fg = transformCryptoMetrics(makeBundle({ fearGreed: { value: 8 } }))
        .find((m) => m.metricId === "FEAR_GREED")!;
      expect(fg.signal).toBe("BULLISH");
      expect(fg.signalRationale).toContain("Extreme Fear");
    });

    it("BULLISH for fear zone (26-40)", () => {
      const fg = transformCryptoMetrics(makeBundle({ fearGreed: { value: 35 } }))
        .find((m) => m.metricId === "FEAR_GREED")!;
      expect(fg.signal).toBe("BULLISH");
    });

    it("NEUTRAL for neutral zone (41-64)", () => {
      const fg = transformCryptoMetrics(makeBundle({ fearGreed: { value: 55 } }))
        .find((m) => m.metricId === "FEAR_GREED")!;
      expect(fg.signal).toBe("NEUTRAL");
    });

    it("BEARISH for greed zone (65-74)", () => {
      const fg = transformCryptoMetrics(makeBundle({ fearGreed: { value: 70 } }))
        .find((m) => m.metricId === "FEAR_GREED")!;
      expect(fg.signal).toBe("BEARISH");
    });

    it("BEARISH for extreme greed (≥75)", () => {
      const fg = transformCryptoMetrics(makeBundle({ fearGreed: { value: 90 } }))
        .find((m) => m.metricId === "FEAR_GREED")!;
      expect(fg.signal).toBe("BEARISH");
      expect(fg.signalRationale).toContain("Extreme Greed");
    });
  });

  describe("BTC_DOMINANCE signal", () => {
    it("BEARISH when BTC dominance >60%", () => {
      const m = transformCryptoMetrics(makeBundle({ cmc: { btc_dominance: 65 } }))
        .find((m) => m.metricId === "BTC_DOMINANCE")!;
      expect(m.signal).toBe("BEARISH");
    });

    it("BULLISH when BTC dominance <45%", () => {
      const m = transformCryptoMetrics(makeBundle({ cmc: { btc_dominance: 42 } }))
        .find((m) => m.metricId === "BTC_DOMINANCE")!;
      expect(m.signal).toBe("BULLISH");
    });

    it("NEUTRAL when BTC dominance in 45-60% range", () => {
      const m = transformCryptoMetrics(makeBundle({ cmc: { btc_dominance: 52 } }))
        .find((m) => m.metricId === "BTC_DOMINANCE")!;
      expect(m.signal).toBe("NEUTRAL");
    });
  });

  describe("DEFI_TVL signal", () => {
    it("BEARISH when TVL is declining", () => {
      const m = transformCryptoMetrics(
        makeBundle({ defiLlama: { currentTvl: 80e9, priorTvl: 120e9 } })
      ).find((m) => m.metricId === "DEFI_TVL")!;
      expect(m.signal).toBe("BEARISH");
      expect(m.periodDeltaPct).toBeLessThan(0);
    });

    it("BULLISH when TVL is rising", () => {
      const m = transformCryptoMetrics(
        makeBundle({ defiLlama: { currentTvl: 130e9, priorTvl: 100e9 } })
      ).find((m) => m.metricId === "DEFI_TVL")!;
      expect(m.signal).toBe("BULLISH");
    });

    it("NEUTRAL when prior TVL is null", () => {
      const m = transformCryptoMetrics(
        makeBundle({ defiLlama: { currentTvl: 90e9, priorTvl: null } })
      ).find((m) => m.metricId === "DEFI_TVL")!;
      expect(m.signal).toBe("NEUTRAL");
      expect(m.periodDelta).toBeNull();
    });
  });

  describe("STABLECOIN_MARKET_CAP signal", () => {
    it("BULLISH when stablecoin supply is growing", () => {
      const m = transformCryptoMetrics(
        makeBundle({ cmc: { stablecoin_24h_percentage_change: 1.5 } })
      ).find((m) => m.metricId === "STABLECOIN_MARKET_CAP")!;
      expect(m.signal).toBe("BULLISH");
    });

    it("NEUTRAL when stablecoin supply is flat/declining", () => {
      const m = transformCryptoMetrics(
        makeBundle({ cmc: { stablecoin_24h_percentage_change: -0.5 } })
      ).find((m) => m.metricId === "STABLECOIN_MARKET_CAP")!;
      expect(m.signal).toBe("NEUTRAL");
    });
  });

  it("calculates DEFI_TVL periodDeltaPct correctly", () => {
    const m = transformCryptoMetrics(
      makeBundle({ defiLlama: { currentTvl: 90e9, priorTvl: 120e9 } })
    ).find((m) => m.metricId === "DEFI_TVL")!;
    // (90 - 120) / 120 * 100 = -25%
    expect(m.periodDeltaPct).toBeCloseTo(-25, 0);
  });

  it("calculates TOTAL_MARKET_CAP prior from yesterday % change", () => {
    // total_market_cap = 2T, yesterday_change = -2%
    // prior = 2T / (1 - 0.02) ≈ 2.0408T
    const m = transformCryptoMetrics(makeBundle()).find(
      (m) => m.metricId === "TOTAL_MARKET_CAP"
    )!;
    expect(m.priorValue).not.toBeNull();
    expect(m.periodDeltaPct).toBeCloseTo(-2.0, 0);
  });

  it("sets FEAR_GREED periodDelta to prior value delta", () => {
    const m = transformCryptoMetrics(
      makeBundle({ fearGreed: { value: 8, priorValue: 5 } })
    ).find((m) => m.metricId === "FEAR_GREED")!;
    expect(m.periodDelta).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// inferCryptoRegime
// ---------------------------------------------------------------------------

describe("inferCryptoRegime", () => {
  it("returns BEAR_MARKET with extreme fear + high BTC dom + declining market", () => {
    const metrics = transformCryptoMetrics(
      makeBundle({
        fearGreed: { value: 8 },
        cmc: {
          btc_dominance: 65,
          total_market_cap_yesterday_percentage_change: -8,
        },
        defiLlama: { currentTvl: 60e9, priorTvl: 120e9 },
      })
    );
    expect(inferCryptoRegime(metrics)).toBe("BEAR_MARKET");
  });

  it("returns BULL_MARKET with extreme greed + low BTC dom + surging market", () => {
    const metrics = transformCryptoMetrics(
      makeBundle({
        fearGreed: { value: 88 },
        cmc: {
          btc_dominance: 40,
          total_market_cap_yesterday_percentage_change: 8,
        },
        defiLlama: { currentTvl: 150e9, priorTvl: 100e9 },
      })
    );
    expect(inferCryptoRegime(metrics)).toBe("BULL_MARKET");
  });

  it("returns ALT_SEASON with moderate greed + mid BTC dom + slightly growing market", () => {
    // fearGreed=67(+2), btcDom=55(0), mcChange=3(+1), tvlChange=5%(0) → score=3 → ALT_SEASON
    const metrics = transformCryptoMetrics(
      makeBundle({
        fearGreed: { value: 67 },
        cmc: {
          btc_dominance: 55,
          total_market_cap_yesterday_percentage_change: 3,
        },
        defiLlama: { currentTvl: 105e9, priorTvl: 100e9 },
      })
    );
    expect(inferCryptoRegime(metrics)).toBe("ALT_SEASON");
  });

  it("returns RISK_OFF with fear + mid BTC dom + flat market", () => {
    const metrics = transformCryptoMetrics(
      makeBundle({
        fearGreed: { value: 30 },
        cmc: {
          btc_dominance: 55,
          total_market_cap_yesterday_percentage_change: -1,
        },
        defiLlama: { currentTvl: 90e9, priorTvl: 95e9 },
      })
    );
    const regime = inferCryptoRegime(metrics);
    // score: fear(30)→-1, dom(55)→0, mc(-1%)→-1, tvl(-5%)→0 = -2 → RISK_OFF
    expect(regime).toBe("RISK_OFF");
  });
});

// ---------------------------------------------------------------------------
// transformCryptoCategories
// ---------------------------------------------------------------------------

describe("transformCryptoCategories", () => {
  it("returns exactly 5 categories", () => {
    const bundle = makeBundle();
    const metrics = transformCryptoMetrics(bundle);
    expect(transformCryptoCategories(metrics, bundle.cmcGlobal)).toHaveLength(5);
  });

  it("includes all expected category slugs", () => {
    const bundle = makeBundle();
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    const slugs = cats.map((c) => c.categorySlug);
    expect(slugs).toContain("bitcoin");
    expect(slugs).toContain("ethereum");
    expect(slugs).toContain("defi");
    expect(slugs).toContain("stablecoins");
    expect(slugs).toContain("altcoins");
  });

  it("computes Bitcoin market cap from BTC dominance", () => {
    const bundle = makeBundle({ cmc: { btc_dominance: 57.7 } });
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    const btc = cats.find((c) => c.categorySlug === "bitcoin")!;
    const expected = 2_000_000_000_000 * 0.577;
    expect(btc.totalMarketCapUsd).toBeCloseTo(expected, -9);
  });

  it("all categories have cryptoRegime set", () => {
    const bundle = makeBundle();
    const metrics = transformCryptoMetrics(bundle);
    for (const cat of transformCryptoCategories(metrics, bundle.cmcGlobal)) {
      expect(cat.cryptoRegime).not.toBeNull();
    }
  });

  it("formats snapshotId as slug_YYYY-MM-DD", () => {
    const bundle = makeBundle();
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    for (const cat of cats) {
      expect(cat.snapshotId).toMatch(
        new RegExp(`^${cat.categorySlug}_\\d{4}-\\d{2}-\\d{2}$`)
      );
    }
  });

  it("stablecoins category is BULLISH when supply is growing", () => {
    const bundle = makeBundle({ cmc: { stablecoin_24h_percentage_change: 2.0 } });
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    const stables = cats.find((c) => c.categorySlug === "stablecoins")!;
    expect(stables.categorySignal).toBe("BULLISH");
  });

  it("bitcoin is BULLISH in bear market with high BTC dominance", () => {
    const bundle = makeBundle({
      fearGreed: { value: 8 },
      cmc: { btc_dominance: 62, total_market_cap_yesterday_percentage_change: -5 },
      defiLlama: { currentTvl: 60e9, priorTvl: 120e9 },
    });
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    const btc = cats.find((c) => c.categorySlug === "bitcoin")!;
    expect(btc.categorySignal).toBe("BULLISH");
  });

  it("altcoins are BEARISH in bear market with high BTC dominance", () => {
    const bundle = makeBundle({
      fearGreed: { value: 8 },
      cmc: { btc_dominance: 65, total_market_cap_yesterday_percentage_change: -8 },
      defiLlama: { currentTvl: 60e9, priorTvl: 120e9 },
    });
    const metrics = transformCryptoMetrics(bundle);
    const cats = transformCryptoCategories(metrics, bundle.cmcGlobal);
    const alts = cats.find((c) => c.categorySlug === "altcoins")!;
    expect(alts.categorySignal).toBe("BEARISH");
  });
});
