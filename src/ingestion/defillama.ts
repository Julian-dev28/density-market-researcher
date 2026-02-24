import axios from "axios";
import type { DeFiLlamaTVLPoint } from "../types/index.js";

// ============================================================
// DeFiLlama TVL Client
//
// Free, no API key required.
// Returns total TVL across all DeFi protocols globally.
//
// Docs: https://defillama.com/docs/api
// ============================================================

const LLAMA_BASE = "https://api.llama.fi";

export interface DeFiLlamaResult {
  currentTvl: number;
  priorTvl: number | null; // ~30 days ago
}

// Fixture used when the DeFiLlama API is unreachable or returns insufficient data.
const DEFILLAMA_FIXTURE: DeFiLlamaResult = {
  currentTvl: 90_500_000_000, // $90.5B
  priorTvl:   118_000_000_000, // $118B ~30 days prior
};

export async function fetchDeFiLlamaTVL(): Promise<DeFiLlamaResult> {
  console.log("[DeFiLlama] Fetching total TVL...");

  let data: DeFiLlamaTVLPoint[];
  try {
    const response = await axios.get<DeFiLlamaTVLPoint[]>(
      `${LLAMA_BASE}/v2/historicalChainTvl`,
      { timeout: 15_000 }
    );
    data = response.data;
  } catch {
    console.log("[DeFiLlama] Request failed — using fixture data.");
    return DEFILLAMA_FIXTURE;
  }

  if (!data || data.length < 2) {
    console.log("[DeFiLlama] Insufficient data — using fixture data.");
    return DEFILLAMA_FIXTURE;
  }

  const sorted = [...data].sort((a, b) => b.date - a.date);
  const currentTvl = sorted[0].tvl;

  const thirtyDaysAgo = sorted[0].date - 30 * 86_400;
  const priorPoint = sorted.find((p) => p.date <= thirtyDaysAgo);

  console.log(`[DeFiLlama] ✓ TVL: $${(currentTvl / 1e9).toFixed(1)}B`);
  return { currentTvl, priorTvl: priorPoint?.tvl ?? null };
}
