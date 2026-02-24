import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load parent .env into process.env so Next.js API routes can read vars
// that live in the monorepo root (e.g. ANTHROPIC_API_KEY).
try {
  const parentEnv = readFileSync(path.resolve(__dirname, "../.env"), "utf-8");
  for (const line of parentEnv.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) {
      const [, key, raw] = match;
      // Don't override vars already set in the environment or web/.env.local
      if (!process.env[key]) {
        process.env[key] = raw.replace(/^["']|["']$/g, "").trim();
      }
    }
  }
} catch {
  // No parent .env present — that's fine
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { defaultLoaders }) => {
    // 1. Path alias: @pipeline → ../src/
    config.resolve.alias = {
      ...config.resolve.alias,
      "@pipeline": path.resolve(__dirname, "../src"),
    };

    // 2. Resolve TypeScript .js extensions (ESM-style imports like "foo.js" → "foo.ts")
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

    // 3. Allow SWC to transpile TypeScript files from the sibling src/ directory
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [path.resolve(__dirname, "../src")],
      use: defaultLoaders.babel,
    });

    return config;
  },
};

export default nextConfig;
