import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchFearGreed } from "../../../ingestion/feargreed.js";

vi.mock("axios");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture fallback — when axios.get returns undefined or throws
// ---------------------------------------------------------------------------

describe("fetchFearGreed — fixture fallback", () => {
  it("returns fixture data when axios call fails", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network error"));
    const result = await fetchFearGreed();
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
    expect(result.classification).toBeTruthy();
  });

  it("returns fixture data when response data array is empty", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { data: [] } } as never);
    const result = await fetchFearGreed();
    expect(result.value).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Live API path
// ---------------------------------------------------------------------------

describe("fetchFearGreed — with data", () => {
  it("parses value and classification correctly", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [
          { value: "8", value_classification: "Extreme Fear", timestamp: "1740268800" },
        ],
      },
    } as never);
    const result = await fetchFearGreed();
    expect(result.value).toBe(8);
    expect(result.classification).toBe("Extreme Fear");
  });

  it("parses priorValue from second data point", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [
          { value: "8", value_classification: "Extreme Fear", timestamp: "1740268800" },
          { value: "5", value_classification: "Extreme Fear", timestamp: "1740182400" },
        ],
      },
    } as never);
    const result = await fetchFearGreed();
    expect(result.value).toBe(8);
    expect(result.priorValue).toBe(5);
  });

  it("priorValue is null when only one data point", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [{ value: "42", value_classification: "Fear", timestamp: "1740268800" }],
      },
    } as never);
    const result = await fetchFearGreed();
    expect(result.priorValue).toBeNull();
  });

  it("value is always a number (not a string)", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [{ value: "75", value_classification: "Greed", timestamp: "1740268800" }],
      },
    } as never);
    const result = await fetchFearGreed();
    expect(typeof result.value).toBe("number");
    expect(result.value).toBe(75);
  });

  it("large greed reading parses correctly", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        data: [{ value: "92", value_classification: "Extreme Greed", timestamp: "1740268800" }],
      },
    } as never);
    const result = await fetchFearGreed();
    expect(result.value).toBe(92);
    expect(result.classification).toBe("Extreme Greed");
  });
});
