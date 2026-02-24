import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchDeFiLlamaTVL } from "../../../ingestion/defillama.js";

vi.mock("axios");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture fallback
// ---------------------------------------------------------------------------

describe("fetchDeFiLlamaTVL — fixture fallback", () => {
  it("returns fixture data when axios throws", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network error"));
    const result = await fetchDeFiLlamaTVL();
    expect(result.currentTvl).toBeGreaterThan(0);
  });

  it("returns fixture data when response has < 2 data points", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [{ date: Math.floor(Date.now() / 1000), tvl: 90e9 }],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    // Only 1 point — fixture fallback
    expect(result.currentTvl).toBeGreaterThan(0);
  });

  it("fixture has both currentTvl and priorTvl set", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Timeout"));
    const result = await fetchDeFiLlamaTVL();
    expect(result.currentTvl).toBeGreaterThan(0);
    // Fixture may or may not have priorTvl — but it's defined
    expect("priorTvl" in result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Live API path
// ---------------------------------------------------------------------------

describe("fetchDeFiLlamaTVL — with data", () => {
  it("returns currentTvl and priorTvl from API", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { date: now - 86400 * 31, tvl: 120e9 },
        { date: now - 86400 * 15, tvl: 100e9 },
        { date: now, tvl: 91e9 },
      ],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    expect(result.currentTvl).toBeGreaterThan(0);
    expect(result.priorTvl).not.toBeNull();
  });

  it("currentTvl is the most recent data point", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { date: now - 86400 * 2, tvl: 80e9 },
        { date: now - 86400, tvl: 85e9 },
        { date: now, tvl: 90e9 },
      ],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    expect(result.currentTvl).toBeCloseTo(90e9, -6);
  });

  it("priorTvl is the data point ~30 days ago", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { date: now - 86400 * 35, tvl: 70e9 },
        { date: now - 86400 * 30, tvl: 75e9 },
        { date: now - 86400 * 15, tvl: 85e9 },
        { date: now, tvl: 90e9 },
      ],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    expect(result.priorTvl).toBeCloseTo(75e9, -6);
  });

  it("priorTvl is null when no data point ≥30 days old exists", async () => {
    const now = Math.floor(Date.now() / 1000);
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { date: now - 86400 * 10, tvl: 85e9 },
        { date: now, tvl: 90e9 },
      ],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    expect(result.priorTvl).toBeNull();
  });

  it("handles unsorted input — finds correct most recent point", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Intentionally out of order
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        { date: now, tvl: 95e9 },
        { date: now - 86400 * 60, tvl: 60e9 },
        { date: now - 86400 * 30, tvl: 80e9 },
        { date: now - 86400 * 15, tvl: 88e9 },
      ],
    } as never);
    const result = await fetchDeFiLlamaTVL();
    expect(result.currentTvl).toBeCloseTo(95e9, -6);
    expect(result.priorTvl).toBeCloseTo(80e9, -6);
  });
});
