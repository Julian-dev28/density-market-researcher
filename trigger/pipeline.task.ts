import { task, schedules } from "@trigger.dev/sdk";
import { randomUUID } from "crypto";

/**
 * Pipeline sync — runs every 6 hours.
 * Fetches FRED, AlphaVantage sectors, CoinMarketCap, DeFiLlama, FearGreed
 * and upserts all rows into Postgres via Drizzle.
 */
export const pipelineSync = schedules.task({
  id: "pipeline-sync",
  // Every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
  cron: "0 */6 * * *",
  run: async () => {
    const { config, assertDbConfig } = await import("../src/config.js");
    assertDbConfig(config);

    const [
      { fetchFREDIndicators },
      { fetchSectorPerformance },
      { fetchCMCGlobalMetrics },
      { fetchDeFiLlamaTVL },
      { fetchFearGreed },
    ] = await Promise.all([
      import("../src/ingestion/fred.js"),
      import("../src/ingestion/sectors.js"),
      import("../src/ingestion/coinmarketcap.js"),
      import("../src/ingestion/defillama.js"),
      import("../src/ingestion/feargreed.js"),
    ]);

    const { transformFREDResult, transformSectorData } = await import(
      "../src/transforms/toOntologyObjects.js"
    );
    const { transformCryptoMetrics, transformCryptoCategories } = await import(
      "../src/transforms/toCryptoObjects.js"
    );
    const { syncToDb } = await import("../src/db/sync.js");

    const [fredResults, sectorData, cmcResult, llamaResult, fgResult] =
      await Promise.allSettled([
        fetchFREDIndicators(config),
        fetchSectorPerformance(config),
        fetchCMCGlobalMetrics(config),
        fetchDeFiLlamaTVL(),
        fetchFearGreed(),
      ]);

    const fred = fredResults.status === "fulfilled" ? fredResults.value : [];
    const sectors = sectorData.status === "fulfilled" ? sectorData.value : null;
    const cmcGlobal = cmcResult.status === "fulfilled" ? cmcResult.value : null;
    const defiLlama = llamaResult.status === "fulfilled" ? llamaResult.value : null;
    const fearGreed = fgResult.status === "fulfilled" ? fgResult.value : null;

    const indicators = fred.map(transformFREDResult).filter((x): x is NonNullable<typeof x> => x !== null);
    const sectorSnapshots = sectors ? transformSectorData(sectors, indicators) : [];
    const cryptoMetrics =
      cmcGlobal && defiLlama && fearGreed
        ? transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed })
        : [];
    const categorySnapshots =
      cmcGlobal && cryptoMetrics.length > 0
        ? transformCryptoCategories(cryptoMetrics, cmcGlobal)
        : [];

    const counts = await syncToDb(
      indicators,
      sectorSnapshots,
      cryptoMetrics,
      categorySnapshots,
      config
    );

    // Trigger the agent to run after sync
    await agentAnalysis.trigger({ syncedAt: new Date().toISOString() });

    return {
      runId: randomUUID(),
      ...counts,
      errors: [
        fredResults.status === "rejected" ? `FRED: ${fredResults.reason}` : null,
        sectorData.status === "rejected" ? `Sectors: ${sectorData.reason}` : null,
        cmcResult.status === "rejected" ? `CMC: ${cmcResult.reason}` : null,
        llamaResult.status === "rejected" ? `DeFiLlama: ${llamaResult.reason}` : null,
        fgResult.status === "rejected" ? `FearGreed: ${fgResult.reason}` : null,
      ].filter(Boolean),
    };
  },
});

/**
 * Agent analysis — triggered after each pipeline sync.
 * Reads prior findings, fetches latest data, reasons about macro regime,
 * writes structured finding to Postgres.
 */
export const agentAnalysis = task({
  id: "agent-analysis",
  run: async (_payload: { syncedAt: string }) => {
    const { config, assertDbConfig } = await import("../src/config.js");
    assertDbConfig(config);

    const { runAgent } = await import("../src/agent/loop.js");
    const notePath = await runAgent(config);

    return { notePath };
  },
});
