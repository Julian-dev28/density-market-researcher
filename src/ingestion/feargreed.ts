import axios from "axios";
import type { FearGreedResponse } from "../types/index.js";

// ============================================================
// Alternative.me Fear & Greed Index Client
//
// Free, no API key required.
// Scale: 0 = Extreme Fear (contrarian buy), 100 = Extreme Greed (contrarian sell)
//
// API: https://alternative.me/crypto/fear-and-greed-index/
// ============================================================

export interface FearGreedResult {
  value: number;
  classification: string;
  priorValue: number | null;
}

// Fixture used when the Fear & Greed API is unreachable or returns empty data.
const FEARGREED_FIXTURE: FearGreedResult = {
  value: 45,
  classification: "Fear",
  priorValue: 42,
};

export async function fetchFearGreed(): Promise<FearGreedResult> {
  console.log("[FearGreed] Fetching Fear & Greed Index...");

  let data: FearGreedResponse["data"];
  try {
    const response = await axios.get<FearGreedResponse>(
      "https://api.alternative.me/fng/?limit=2",
      { timeout: 10_000 }
    );
    data = response.data.data;
  } catch {
    console.log("[FearGreed] Request failed — using fixture data.");
    return FEARGREED_FIXTURE;
  }

  if (!data || data.length === 0) {
    console.log("[FearGreed] Empty response — using fixture data.");
    return FEARGREED_FIXTURE;
  }

  const value = parseInt(data[0].value, 10);
  const priorValue = data[1] ? parseInt(data[1].value, 10) : null;

  console.log(`[FearGreed] ✓ Index: ${value} (${data[0].value_classification})`);
  return { value, classification: data[0].value_classification, priorValue };
}
