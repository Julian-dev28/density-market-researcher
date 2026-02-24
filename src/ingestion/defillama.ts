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

export async function fetchDeFiLlamaTVL(): Promise<DeFiLlamaResult> {
  console.log("[DeFiLlama] Fetching total TVL...");

  const response = await axios.get<DeFiLlamaTVLPoint[]>(
    `${LLAMA_BASE}/v2/historicalChainTvl`,
    { timeout: 15_000 }
  );

  const data = response.data;
  if (!data || data.length < 2) {
    throw new Error("[DeFiLlama] Insufficient data returned — fewer than 2 TVL data points.");
  }

  const sorted = [...data].sort((a, b) => b.date - a.date);
  const currentTvl = sorted[0].tvl;

  const thirtyDaysAgo = sorted[0].date - 30 * 86_400;
  const priorPoint = sorted.find((p) => p.date <= thirtyDaysAgo);

  console.log(`[DeFiLlama] ✓ TVL: $${(currentTvl / 1e9).toFixed(1)}B`);
  return { currentTvl, priorTvl: priorPoint?.tvl ?? null };
}
