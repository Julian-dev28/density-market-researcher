import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const ConfigSchema = z.object({
  FOUNDRY_URL: z.string().url().optional(),
  FOUNDRY_CLIENT_ID: z.string().optional(),
  FOUNDRY_CLIENT_SECRET: z.string().optional(),
  FOUNDRY_TOKEN: z.string().optional(),

  /** FRED API key — free at https://fred.stlouisfed.org/docs/api/api_key.html */
  FRED_API_KEY: z.string().optional(),
  /** Alpha Vantage API key — free at https://www.alphavantage.co/support/#api-key */
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  /** CoinMarketCap API key — free at https://coinmarketcap.com/api/ */
  COINMARKETCAP_API_KEY: z.string().optional(),
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

export function assertFoundryConfig(cfg: Config): void {
  if (cfg.DRY_RUN) return;
  const hasToken = !!cfg.FOUNDRY_TOKEN;
  const hasOAuth = !!cfg.FOUNDRY_CLIENT_ID && !!cfg.FOUNDRY_CLIENT_SECRET;
  if (!cfg.FOUNDRY_URL) throw new Error("FOUNDRY_URL is required in live mode.");
  if (!hasToken && !hasOAuth)
    throw new Error(
      "Set FOUNDRY_TOKEN or (FOUNDRY_CLIENT_ID + FOUNDRY_CLIENT_SECRET) in .env"
    );
}
