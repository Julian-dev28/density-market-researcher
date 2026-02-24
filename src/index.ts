#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { randomUUID } from "crypto";
import { config, assertDbConfig } from "./config.js";
import { fetchFREDIndicators } from "./ingestion/fred.js";
import { fetchSectorPerformance } from "./ingestion/sectors.js";
import { fetchCMCGlobalMetrics } from "./ingestion/coinmarketcap.js";
import { fetchDeFiLlamaTVL } from "./ingestion/defillama.js";
import { fetchFearGreed } from "./ingestion/feargreed.js";
import {
  transformFREDResult,
  transformSectorData,
} from "./transforms/toOntologyObjects.js";
import {
  transformCryptoMetrics,
  transformCryptoCategories,
} from "./transforms/toCryptoObjects.js";
import { syncToDb } from "./db/sync.js";
import { generateReport } from "./report/generate.js";
import { runAgent } from "./agent/loop.js";
import type { PipelineRun } from "./types/index.js";

program
  .name("foundry-macro-research")
  .description(
    "Macro + crypto research pipeline — syncs to Postgres, runs Claude research agent"
  )
  .version("1.0.0")
  .option("--dry-run", "Print transformed objects without writing to Foundry")
  .option("--output-json", "Write transformed objects to ./output.json")
  .option("--mode <mode>", "Pipeline mode: macro | crypto | all", "macro")
  .option("--report", "Generate a markdown research report via Claude")
  .option("--agent", "Run the autonomous Claude research agent (reads Foundry, investigates anomalies, writes research note)")
  .parse(process.argv);

const opts = program.opts<{ dryRun: boolean; outputJson: boolean; mode: string; report: boolean; agent: boolean }>();

if (opts.dryRun) {
  (config as Record<string, unknown>).DRY_RUN = true;
}
if (opts.mode) {
  (config as Record<string, unknown>).MODE = opts.mode;
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  const run: PipelineRun = {
    runId,
    startedAt,
    indicatorsProcessed: 0,
    sectorsProcessed: 0,
    totalSynced: 0,
    totalFailed: 0,
    errors: [],
  };

  console.log(chalk.bold("\n📈  Macro Research Pipeline"));
  console.log(chalk.dim(`Run ID: ${runId}`));
  console.log(chalk.dim(`Mode:   ${config.DRY_RUN ? "DRY RUN" : "LIVE"} | Pipeline: ${config.MODE.toUpperCase()}\n`));

  if (!config.DRY_RUN) {
    try {
      assertDbConfig(config);
    } catch (err) {
      console.error(chalk.red(`\n❌ Config error: ${err instanceof Error ? err.message : err}`));
      console.log(chalk.dim("\nTip: Run with --dry-run to test without credentials.\n"));
      process.exit(1);
    }
  }

  const runMacro = config.MODE === "macro" || config.MODE === "all";
  const runCrypto = config.MODE === "crypto" || config.MODE === "all";

  // --- Fetch ---
  const [fredResults, sectorData, cmcResult, llamaResult, fgResult] =
    await Promise.allSettled([
      runMacro ? fetchFREDIndicators(config) : Promise.resolve([]),
      runMacro ? fetchSectorPerformance(config) : Promise.resolve(null),
      runCrypto ? fetchCMCGlobalMetrics(config) : Promise.resolve(null),
      runCrypto ? fetchDeFiLlamaTVL() : Promise.resolve(null),
      runCrypto ? fetchFearGreed() : Promise.resolve(null),
    ]);

  const fred = fredResults.status === "fulfilled" ? fredResults.value : [];
  const sectors = sectorData.status === "fulfilled" ? sectorData.value : null;
  const cmcGlobal = cmcResult.status === "fulfilled" ? cmcResult.value : null;
  const defiLlama = llamaResult.status === "fulfilled" ? llamaResult.value : null;
  const fearGreed = fgResult.status === "fulfilled" ? fgResult.value : null;

  if (fredResults.status === "rejected") run.errors.push({ source: "FRED", message: String(fredResults.reason) });
  if (sectorData.status === "rejected") run.errors.push({ source: "AlphaVantage", message: String(sectorData.reason) });
  if (cmcResult.status === "rejected") run.errors.push({ source: "CoinMarketCap", message: String(cmcResult.reason) });
  if (llamaResult.status === "rejected") run.errors.push({ source: "DeFiLlama", message: String(llamaResult.reason) });
  if (fgResult.status === "rejected") run.errors.push({ source: "FearGreed", message: String(fgResult.reason) });

  // --- Transform: Macro ---
  const indicators = (fred as Awaited<ReturnType<typeof fetchFREDIndicators>>)
    .map(transformFREDResult)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sectorSnapshots = sectors
    ? transformSectorData(sectors, indicators)
    : [];

  if (runMacro) {
    run.indicatorsProcessed = indicators.length;
    run.sectorsProcessed = sectorSnapshots.length;
    console.log(chalk.green(`  ✓ FRED: ${(fred as []).length} series → ${indicators.length} MacroIndicator objects`));
    console.log(chalk.green(`  ✓ Sectors: ${sectorSnapshots.length} SectorSnapshot objects`));
  }

  // --- Transform: Crypto ---
  const cryptoMetrics =
    runCrypto && cmcGlobal && defiLlama && fearGreed
      ? transformCryptoMetrics({ cmcGlobal, defiLlama, fearGreed })
      : [];

  const categorySnapshots =
    runCrypto && cmcGlobal && cryptoMetrics.length > 0
      ? transformCryptoCategories(cryptoMetrics, cmcGlobal)
      : [];

  if (runCrypto) {
    console.log(chalk.green(`  ✓ Crypto: ${cryptoMetrics.length} CryptoMetric objects`));
    console.log(chalk.green(`  ✓ Categories: ${categorySnapshots.length} CategorySnapshot objects`));
  }

  // --- Optional JSON output ---
  if (opts.outputJson) {
    const { writeFileSync } = await import("fs");
    const output = { indicators, sectors: sectorSnapshots, cryptoMetrics, categorySnapshots };
    writeFileSync("./output.json", JSON.stringify(output, null, 2));
    console.log(chalk.dim(`  → Wrote output.json`));
  }

  // --- Sync ---
  console.log(chalk.bold("\n📡  Syncing to Postgres...\n"));

  const { indicatorsSynced, sectorsSynced, cryptoSynced, categoriesSynced } = await syncToDb(
    indicators,
    sectorSnapshots,
    cryptoMetrics,
    categorySnapshots,
    config
  );

  run.totalSynced = indicatorsSynced + sectorsSynced + cryptoSynced + categoriesSynced;

  // --- Agent ---
  if (opts.agent) {
    try {
      const notePath = await runAgent(config);
      if (notePath) {
        console.log(chalk.green(`\n🤖  Agent research note → ${notePath}`));
      }
    } catch (err) {
      console.error(chalk.red(`\n❌ Agent failed: ${err instanceof Error ? err.message : err}`));
    }
  }

  // --- Report ---
  if (opts.report) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red("\n❌ ANTHROPIC_API_KEY not set in .env — cannot generate report.\n"));
    } else {
      try {
        const outPath = await generateReport(
          { indicators, sectors: sectorSnapshots, cryptoMetrics, categories: categorySnapshots, mode: config.MODE },
          apiKey
        );
        console.log(chalk.green(`\n📄  Report saved to ${outPath}`));
      } catch (err) {
        console.error(chalk.red(`\n❌ Report generation failed: ${err instanceof Error ? err.message : err}`));
      }
    }
  }
  run.completedAt = new Date().toISOString();
  const durationMs =
    new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();

  console.log(chalk.bold("\n📊  Pipeline Summary"));
  console.log(chalk.dim("─".repeat(40)));
  console.log(`  Indicators:   ${chalk.white(run.indicatorsProcessed)}`);
  console.log(`  Sectors:      ${chalk.white(run.sectorsProcessed)}`);
  console.log(`  Synced:       ${chalk.green(run.totalSynced)}`);
  console.log(`  Duration:     ${chalk.dim(durationMs + "ms")}`);

  if (run.errors.length > 0) {
    console.log(chalk.yellow(`\n  Errors (${run.errors.length}):`));
    run.errors.forEach((e) =>
      console.log(chalk.dim(`    [${e.source}] ${e.message}`))
    );
  }

  if (config.DRY_RUN) {
    console.log(
      chalk.yellow(
        "\n  ⚡ Dry-run complete. Set DATABASE_URL in .env to sync live.\n"
      )
    );
  } else {
    console.log(chalk.green("\n  ✅ Pipeline complete.\n"));
  }
}

main().catch((err) => {
  console.error(chalk.red(`\n💥 ${err instanceof Error ? err.message : err}`));
  process.exit(1);
});
