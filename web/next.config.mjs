import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load parent .env so ANTHROPIC_API_KEY is available to API routes
// when running locally (Vercel reads it via environment variables).
try {
  const parentEnv = readFileSync(path.resolve(__dirname, "../.env"), "utf-8");
  for (const line of parentEnv.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) {
      const [, key, raw] = match;
      if (!process.env[key]) {
        process.env[key] = raw.replace(/^["']|["']$/g, "").trim();
      }
    }
  }
} catch {
  // No parent .env — fine in Vercel (key comes from env var settings)
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
