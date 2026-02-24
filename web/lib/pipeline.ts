import type {
  MacroIndicator,
  SectorSnapshot,
  CryptoMetric,
  CategorySnapshot,
} from "@pipeline/types/index.js";
import {
  transformFREDResult,
  transformSectorData,
} from "@pipeline/transforms/toOntologyObjects.js";
import {
  transformCryptoMetrics,
  transformCryptoCategories,
} from "@pipeline/transforms/toCryptoObjects.js";
import { getSampleFREDData } from "@pipeline/ingestion/fred.js";
import { getSampleSectorData } from "@pipeline/ingestion/sectors.js";
import { getSampleGlobalMetrics } from "@pipeline/ingestion/coinmarketcap.js";
import { getFixtureTVL } from "@pipeline/ingestion/defillama.js";
import { getFixtureFearGreed } from "@pipeline/ingestion/feargreed.js";

export interface PipelineOutput {
  indicators: MacroIndicator[];
  sectors: SectorSnapshot[];
  cryptoMetrics: CryptoMetric[];
  categories: CategorySnapshot[];
  generatedAt: string;
}

/**
 * Runs the full research pipeline using fixture data — no I/O, no API calls.
 * Returns ~38 Ontology objects in ~5ms.
 */
export function runPipeline(): PipelineOutput {
  // --- Macro indicators (FRED fixture: 8 series) ---
  const fredResults = getSampleFREDData();
  const indicators: MacroIndicator[] = fredResults
    .map(transformFREDResult)
    .filter((ind): ind is MacroIndicator => ind !== null);

  // --- Sector snapshots (Yahoo Finance fixture: 11 SPDR ETFs) ---
  const sectorData = getSampleSectorData();
  const sectors: SectorSnapshot[] = transformSectorData(sectorData, indicators);

  // --- Crypto metrics (CMC + DeFiLlama + Fear/Greed fixtures) ---
  const cmcGlobal = getSampleGlobalMetrics();
  const defiLlama = getFixtureTVL();
  const fearGreed = getFixtureFearGreed();
  const cryptoMetrics: CryptoMetric[] = transformCryptoMetrics({
    cmcGlobal,
    defiLlama,
    fearGreed,
  });

  // --- Category snapshots (Bitcoin, Ethereum, DeFi, Stablecoins, Altcoins) ---
  const categories: CategorySnapshot[] = transformCryptoCategories(
    cryptoMetrics,
    cmcGlobal
  );

  return {
    indicators,
    sectors,
    cryptoMetrics,
    categories,
    generatedAt: new Date().toISOString(),
  };
}
