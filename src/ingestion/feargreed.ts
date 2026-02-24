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

export async function fetchFearGreed(): Promise<FearGreedResult> {
  console.log("[FearGreed] Fetching Fear & Greed Index...");

  try {
    const response = await axios.get<FearGreedResponse>(
      "https://api.alternative.me/fng/?limit=2",
      { timeout: 10_000 }
    );

    const data = response.data.data;
    if (!data || data.length === 0) {
      return getFixtureFearGreed();
    }

    const value = parseInt(data[0].value, 10);
    const priorValue = data[1] ? parseInt(data[1].value, 10) : null;

    console.log(`[FearGreed] ✓ Index: ${value} (${data[0].value_classification})`);
    return { value, classification: data[0].value_classification, priorValue };
  } catch {
    console.warn("[FearGreed] Fetch failed — using fixture data.");
    return getFixtureFearGreed();
  }
}

export function getFixtureFearGreed(): FearGreedResult {
  return { value: 44, classification: "Fear", priorValue: 38 };
}
