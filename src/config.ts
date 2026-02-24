import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const ConfigSchema = z.object({
  /** Postgres connection string — required when DRY_RUN=false */
  DATABASE_URL: z.string().optional(),

  /** FRED API key — free at https://fred.stlouisfed.org/docs/api/api_key.html */
  FRED_API_KEY: z.string().optional(),
  /** Alpha Vantage API key — free at https://www.alphavantage.co/support/#api-key */
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  /** CoinMarketCap API key — free at https://coinmarketcap.com/api/ */
  COINMARKETCAP_API_KEY: z.string().optional(),
  /** OpenHands Cloud API key — https://app.all-hands.dev */
  OPENHANDS_API_KEY: z.string().optional(),
  /** GitHub repo for OpenHands to operate on (e.g. "org/repo") */
  GITHUB_REPO: z.string().optional(),
  /** Pipeline mode: macro (default), crypto, or all */
  MODE: z.enum(["macro", "crypto", "all"]).default("macro"),

  DRY_RUN: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  BATCH_SIZE: z.coerce.number().default(50),
  /** Number of historical observations to fetch per FRED series */
  FRED_LOOKBACK_OBSERVATIONS: z.coerce.number().default(53), // 52 weeks + current
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid configuration:", result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

export function assertDbConfig(cfg: Config): void {
  if (cfg.DRY_RUN) return;
  if (!cfg.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required in live mode (e.g. postgres://user:pass@localhost:5432/macro_research)."
    );
  }
}
