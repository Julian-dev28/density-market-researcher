import { describe, it, expect } from "vitest";
import {
  transformFREDResult,
  transformSectorData,
  inferRegime,
} from "../../../transforms/toOntologyObjects.js";
import type { FREDFetchResult } from "../../../ingestion/fred.js";
import type { AlphaVantageSectorResponse, MacroIndicator } from "../../../types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkObs = (date: string, value: string) => ({
  date,
  value,
  realtime_start: date,
  realtime_end: date,
});

function makeFREDResult(
  seriesId: string,
  values: Array<[string, string]>,
  overrides: Partial<FREDFetchResult["info"]> = {}
): FREDFetchResult {
  return {
    seriesId,
    info: {
      id: seriesId,
      title: "Test Series",
      frequency_short: "M",
      units: "Percent",
      last_updated: "2026-02-01",
      ...overrides,
    },
    observations: {
      units: "Percent",
      count: values.length,
      observations: values.map(([date, val]) => mkObs(date, val)),
    },
  };
}

function makeIndicator(
  seriesId: string,
  latestValue: number,
  delta: number = 0
): MacroIndicator {
  return {
    seriesId,
    name: seriesId,
    source: "FRED",
    category: "INTEREST_RATES",
    latestValue,
    latestDate: "2026-02-01",
    unit: "Percent",
    priorValue: latestValue - delta,
    priorDate: "2026-01-01",
    periodDelta: delta,
    periodDeltaPct: delta !== 0 ? (delta / (latestValue - delta)) * 100 : 0,
    yearLow: latestValue - 2,
    yearHigh: latestValue + 2,
    yearPercentile: 0.5,
    signal: "NEUTRAL",
    signalRationale: "",
    frequency: "MONTHLY",
    lastUpdated: "2026-02-01",
    sourceUrl: "",
  };
}

function makeAVData(
  sectors: Record<string, string>,
  spy = "0.0500"
): AlphaVantageSectorResponse {
  return {
    "Meta Data": { "Last Refreshed": "2026-02-23" },
    "Rank A: Real-Time Performance": sectors,
    "Rank B: 1 Day Performance": sectors,
    "Rank C: 5 Day Performance": Object.fromEntries(
      Object.entries(sectors).map(([k, v]) => [k, String(parseFloat(v) * 0.5)])
    ),
    "Rank D: 1 Month Performance": Object.fromEntries(
      Object.entries(sectors).map(([k, v]) => [k, String(parseFloat(v) * 2)])
    ),
    "Rank F: Year-to-Date (YTD) Performance": { ...sectors, "S&P 500": spy },
  };
}

// ---------------------------------------------------------------------------
// transformFREDResult
// ---------------------------------------------------------------------------

describe("transformFREDResult", () => {
  it("returns null for empty observations", () => {
    const result = transformFREDResult(makeFREDResult("DFF", []));
    expect(result).toBeNull();
  });

  it("transforms a single observation — no delta", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [["2026-02-01", "5.33"]])
    );
    expect(result).not.toBeNull();
    expect(result!.seriesId).toBe("DFF");
    expect(result!.latestValue).toBe(5.33);
    expect(result!.periodDelta).toBeNull();
    expect(result!.priorValue).toBeNull();
  });

  it("calculates delta and deltaPct from two observations", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "5.33"],
        ["2026-01-01", "5.25"],
      ])
    );
    expect(result!.periodDelta).toBeCloseTo(0.08, 4);
    expect(result!.periodDeltaPct).toBeCloseTo(1.524, 2);
    expect(result!.priorValue).toBe(5.25);
  });

  it("filters out '.' (missing) observations", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "."],
        ["2026-01-01", "5.25"],
      ])
    );
    // Only one valid observation after filtering
    expect(result!.latestValue).toBe(5.25);
    expect(result!.periodDelta).toBeNull();
  });

  it("filters out empty-string observations", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", ""],
        ["2026-01-01", "5.25"],
      ])
    );
    expect(result!.latestValue).toBe(5.25);
  });

  it("calculates yearPercentile correctly", () => {
    // range [0, 10], latest = 10 → percentile = 1.0
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "10"],
        ["2026-01-01", "5"],
        ["2025-12-01", "0"],
      ])
    );
    expect(result!.yearPercentile).toBe(1);
    expect(result!.yearLow).toBe(0);
    expect(result!.yearHigh).toBe(10);
  });

  it("handles flat range (min === max) with percentile 0.5", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "5.0"],
        ["2026-01-01", "5.0"],
      ])
    );
    expect(result!.yearPercentile).toBe(0.5);
  });

  it("sets source to FRED and correct sourceUrl", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [["2026-02-01", "5.33"]])
    );
    expect(result!.source).toBe("FRED");
    expect(result!.sourceUrl).toBe("https://fred.stlouisfed.org/series/DFF");
  });

  it("maps frequency_short D → DAILY", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [["2026-02-01", "5.33"]], { frequency_short: "D" })
    );
    expect(result!.frequency).toBe("DAILY");
  });

  it("maps frequency_short W → WEEKLY", () => {
    const result = transformFREDResult(
      makeFREDResult("MORTGAGE30US", [["2026-02-01", "6.01"]], { frequency_short: "W" })
    );
    expect(result!.frequency).toBe("WEEKLY");
  });

  it("maps frequency_short Q → QUARTERLY", () => {
    const result = transformFREDResult(
      makeFREDResult("GDP", [["2026-01-01", "31000"]], { frequency_short: "Q" })
    );
    expect(result!.frequency).toBe("QUARTERLY");
  });

  it("derives BEARISH for rising inverseSentiment series (DFF rising)", () => {
    // DFF is inverseSentiment: rising → BEARISH
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "5.5"],
        ["2026-01-01", "5.25"],
      ])
    );
    expect(result!.signal).toBe("BEARISH");
  });

  it("derives BULLISH for falling inverseSentiment series (DFF falling)", () => {
    const result = transformFREDResult(
      makeFREDResult("DFF", [
        ["2026-02-01", "5.0"],
        ["2026-01-01", "5.5"],
      ])
    );
    expect(result!.signal).toBe("BULLISH");
  });

  it("derives BULLISH for rising positive-sentiment series (PAYEMS rising)", () => {
    // PAYEMS inverseSentiment: false → rising = BULLISH
    const result = transformFREDResult(
      makeFREDResult("PAYEMS", [
        ["2026-02-01", "158757"],
        ["2026-01-01", "158627"],
      ])
    );
    expect(result!.signal).toBe("BULLISH");
  });

  it("derives BEARISH for falling positive-sentiment series (UMCSENT falling)", () => {
    const result = transformFREDResult(
      makeFREDResult("UMCSENT", [
        ["2026-02-01", "55.0"],
        ["2026-01-01", "58.0"],
      ])
    );
    expect(result!.signal).toBe("BEARISH");
  });

  it("uses series info title as fallback name for unknown seriesId", () => {
    const result = transformFREDResult(
      makeFREDResult("CUSTOM_XYZ", [["2026-02-01", "1.5"]], {
        title: "My Custom Series",
      })
    );
    expect(result!.name).toBe("My Custom Series");
  });
});

// ---------------------------------------------------------------------------
// inferRegime
// ---------------------------------------------------------------------------

describe("inferRegime", () => {
  it("returns CONTRACTION with strongly negative signals", () => {
    const indicators = [
      makeIndicator("UNRATE", 5.5, +0.5),  // rising unemployment → -2
      makeIndicator("DFF", 5.5, +0.25),    // raising rates (not cutting) → -1
      makeIndicator("T10Y2Y", -0.5, 0),    // inverted curve → -1
      makeIndicator("UMCSENT", 52, 0),     // below 70 → -1
    ];
    expect(inferRegime(indicators)).toBe("CONTRACTION"); // score = -5
  });

  it("returns EXPANSION with strongly positive signals", () => {
    const indicators = [
      makeIndicator("UNRATE", 3.5, -0.2),  // not rising → +1
      makeIndicator("DFF", 4.0, -0.25),    // cutting rates → +1
      makeIndicator("T10Y2Y", 0.8, 0),     // positive → +1
      makeIndicator("UMCSENT", 82, +5),    // above 70 → +1
    ];
    expect(inferRegime(indicators)).toBe("EXPANSION"); // score = +4
  });

  it("returns RECOVERY with slight positive lean", () => {
    const indicators = [
      makeIndicator("UNRATE", 4.3, 0),     // not rising → +1
      makeIndicator("DFF", 3.64, -0.1),    // cutting → +1
      makeIndicator("T10Y2Y", 0.6, 0),     // positive → +1
      makeIndicator("UMCSENT", 56, 0),     // below 70 → -1
    ];
    expect(inferRegime(indicators)).toBe("RECOVERY"); // score = +2
  });

  it("returns SLOWDOWN with mixed signals", () => {
    const indicators = [
      makeIndicator("UNRATE", 4.5, +0.2),  // rising → -2
      makeIndicator("DFF", 3.64, -0.1),    // cutting → +1
      makeIndicator("T10Y2Y", 0.2, 0),     // positive → +1
      makeIndicator("UMCSENT", 56, 0),     // below 70 → -1
    ];
    expect(inferRegime(indicators)).toBe("SLOWDOWN"); // score = -1
  });

  it("handles missing indicators gracefully", () => {
    // No indicators at all → score = 0 → SLOWDOWN
    expect(inferRegime([])).toBe("SLOWDOWN");
  });

  it("handles partial indicator set", () => {
    const indicators = [
      makeIndicator("UNRATE", 4.3, 0), // not rising → +1
    ];
    // score = 1 → RECOVERY
    expect(inferRegime(indicators)).toBe("RECOVERY");
  });
});

// ---------------------------------------------------------------------------
// transformSectorData
// ---------------------------------------------------------------------------

describe("transformSectorData", () => {
  it("always produces 11 snapshots (one per sector), even with partial data", () => {
    const avData = makeAVData({ Energy: "0.1021" });
    const snapshots = transformSectorData(avData, []);
    expect(snapshots).toHaveLength(11);
    const energy = snapshots.find((s) => s.sectorTicker === "XLE")!;
    expect(energy.sectorTicker).toBe("XLE");
    expect(energy.sectorName).toBe("Energy");
  });

  it("produces 11 snapshots when all sectors present", () => {
    const avData = makeAVData({
      Energy: "0.1021",
      Utilities: "0.1532",
      Financials: "0.1201",
      Technology: "0.1841",
      "Health Care": "0.0611",
      Industrials: "0.1012",
      "Consumer Discretionary": "0.0421",
      Materials: "0.0711",
      "Consumer Staples": "0.0612",
      "Real Estate": "0.0201",
      "Communication Services": "0.1411",
    });
    const snapshots = transformSectorData(avData, []);
    expect(snapshots).toHaveLength(11);
  });

  it("converts decimal YTD to percentage", () => {
    const avData = makeAVData({ Energy: "0.1021" });
    const snapshots = transformSectorData(avData, []);
    // 0.1021 * 100 = 10.21%
    expect(snapshots[0].ytdChangePct).toBeCloseTo(10.21, 1);
  });

  it("calculates relative strength vs SPY correctly", () => {
    // XLE YTD 10.21%, SPY 5.00% → RS = +5.21%
    const avData = makeAVData({ Energy: "0.1021" }, "0.0500");
    const snapshots = transformSectorData(avData, []);
    expect(snapshots[0].relativeStrengthVsSPY).toBeCloseTo(5.21, 1);
  });

  it("negative RS when sector underperforms SPY", () => {
    // XLE YTD 2%, SPY 10% → RS = -8%
    const avData = makeAVData({ Energy: "0.0200" }, "0.1000");
    const snapshots = transformSectorData(avData, []);
    expect(snapshots[0].relativeStrengthVsSPY).toBeCloseTo(-8.0, 1);
  });

  it("formats snapshotId as ticker_date", () => {
    const avData = makeAVData({ Energy: "0.1021" });
    const snapshots = transformSectorData(avData, []);
    expect(snapshots[0].snapshotId).toBe("XLE_2026-02-23");
  });

  it("derives BULLISH signal when day, month, and RS are all positive", () => {
    const avData = makeAVData({ Utilities: "0.0300" }, "0.0100");
    const snapshots = transformSectorData(avData, []);
    // day +3%, month +6%, RS +2% → 3/3 bullish → BULLISH
    const utilities = snapshots.find((s) => s.sectorTicker === "XLU")!;
    expect(utilities.sectorSignal).toBe("BULLISH");
  });

  it("derives BEARISH signal when day, month, and RS are all negative", () => {
    // YTD -10%, SPY +5% → RS = -15%. day/month also negative from helper
    const avData = makeAVData({ Technology: "-0.1000" }, "0.0500");
    const snapshots = transformSectorData(avData, []);
    // day -10%, month -20%, RS -15% → 0/3 bullish → BEARISH
    const technology = snapshots.find((s) => s.sectorTicker === "XLK")!;
    expect(technology.sectorSignal).toBe("BEARISH");
  });

  it("inherits macroRegime from inferRegime on indicators", () => {
    const avData = makeAVData({ Energy: "0.1021" });
    const indicators = [
      makeIndicator("UNRATE", 3.5, -0.2),
      makeIndicator("DFF", 4.0, -0.25),
      makeIndicator("T10Y2Y", 0.8, 0),
      makeIndicator("UMCSENT", 82, 5),
    ];
    const snapshots = transformSectorData(avData, indicators);
    expect(snapshots[0].macroRegime).toBe("EXPANSION");
  });

  it("attaches primaryMacroDrivers from SECTOR_MAP", () => {
    const avData = makeAVData({ Financials: "0.1201" });
    const snapshots = transformSectorData(avData, []);
    const financials = snapshots.find((s) => s.sectorTicker === "XLF")!;
    expect(financials.primaryMacroDrivers).toContain("DFF");
    expect(financials.primaryMacroDrivers).toContain("DGS10");
  });
});
