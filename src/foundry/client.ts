import chalk from "chalk";
import type { MacroIndicator, SectorSnapshot } from "../types/index.js";
import type { Config } from "../config.js";
import { OBJECT_TYPES } from "./objectTypes.js";

// ============================================================
// Foundry OSDK Client
//
// Replace the createFoundryClient placeholder with your
// generated OSDK package import before going live.
// In dry-run mode, objects are printed to stdout.
//
// OSDK Docs: https://www.palantir.com/docs/foundry/ontology-sdk/
// ============================================================

async function createFoundryClient(_cfg: Config) {
  // Replace with your generated OSDK client:
  //
  // import { createClient } from "@your-foundry-env/sdk";
  // import { ConfidentialClientAuth } from "@osdk/oauth";
  //
  // const auth = new ConfidentialClientAuth({
  //   clientId: cfg.FOUNDRY_CLIENT_ID!,
  //   clientSecret: cfg.FOUNDRY_CLIENT_SECRET!,
  //   url: cfg.FOUNDRY_URL!,
  // });
  // return createClient(cfg.FOUNDRY_URL!, "@your-foundry-env/sdk", auth);

  throw new Error(
    "Replace with your generated OSDK client. " +
      "See: https://www.palantir.com/docs/foundry/ontology-sdk/get-started"
  );
}

// ============================================================
// Dry-run output
// ============================================================

function printIndicator(ind: MacroIndicator): void {
  const signalColor =
    ind.signal === "BULLISH" ? chalk.green :
    ind.signal === "BEARISH" ? chalk.red :
    chalk.yellow;

  const delta = ind.periodDelta !== null
    ? `${ind.periodDelta > 0 ? "+" : ""}${ind.periodDelta.toFixed(3)} (${ind.periodDeltaPct?.toFixed(2)}%)`
    : "n/a";

  const percentile = ind.yearPercentile !== null
    ? `${(ind.yearPercentile * 100).toFixed(0)}th pctile`
    : "";

  console.log(
    `    ${chalk.cyan(ind.seriesId.padEnd(14))}  ` +
    `${chalk.white(ind.latestValue.toString().padEnd(10))}  ` +
    `${chalk.dim(delta.padEnd(20))}  ` +
    `${signalColor(ind.signal.padEnd(8))}  ` +
    `${chalk.dim(percentile)}`
  );
}

function printSector(snap: SectorSnapshot): void {
  const signalColor =
    snap.sectorSignal === "BULLISH" ? chalk.green :
    snap.sectorSignal === "BEARISH" ? chalk.red :
    chalk.yellow;

  const ytd = snap.ytdChangePct !== null ? `YTD: ${snap.ytdChangePct > 0 ? "+" : ""}${snap.ytdChangePct.toFixed(2)}%` : "";
  const rs = snap.relativeStrengthVsSPY !== null ? ` RS: ${snap.relativeStrengthVsSPY > 0 ? "+" : ""}${snap.relativeStrengthVsSPY.toFixed(2)}%` : "";

  console.log(
    `    ${chalk.cyan(snap.sectorTicker.padEnd(6))}  ` +
    `${chalk.white(snap.sectorName.padEnd(26))}  ` +
    `${signalColor(snap.sectorSignal.padEnd(8))}  ` +
    `${chalk.dim(ytd + rs)}`
  );
}

export async function syncToFoundry(
  indicators: MacroIndicator[],
  sectors: SectorSnapshot[],
  cfg: Config
): Promise<{ indicatorsSynced: number; sectorsSynced: number }> {
  if (cfg.DRY_RUN) {
    console.log(chalk.yellow(
      `\n[DRY RUN] Would write ${indicators.length} MacroIndicator + ${sectors.length} SectorSnapshot objects to Foundry\n`
    ));

    console.log(chalk.bold("  MACRO INDICATORS"));
    console.log(chalk.dim(`  ${"Series ID".padEnd(14)}  ${"Value".padEnd(10)}  ${"Delta (period)".padEnd(20)}  Signal    52w Range`));
    console.log(chalk.dim(`  ${"-".repeat(70)}`));
    indicators.forEach(printIndicator);

    console.log(chalk.bold("\n  SECTOR SNAPSHOTS"));
    console.log(chalk.dim(`  ${"Ticker".padEnd(6)}  ${"Sector".padEnd(26)}  Signal    Performance`));
    console.log(chalk.dim(`  ${"-".repeat(65)}`));
    sectors.forEach(printSector);

    // Print inferred regime
    const regime = sectors[0]?.macroRegime;
    if (regime) {
      const regimeColor =
        regime === "EXPANSION" ? chalk.green :
        regime === "RECOVERY" ? chalk.cyan :
        regime === "SLOWDOWN" ? chalk.yellow :
        chalk.red;
      console.log(chalk.bold(`\n  Inferred Macro Regime: ${regimeColor(regime)}`));
    }

    return { indicatorsSynced: indicators.length, sectorsSynced: sectors.length };
  }

  // Live mode
  const client = await createFoundryClient(cfg);
  // Implement batch writes using your generated OSDK package.
  // Pattern follows: client.ontology.objects.MacroIndicator.batch.apply(...)
  return { indicatorsSynced: 0, sectorsSynced: 0 };
}
