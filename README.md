# Foundry Macro Research Pipeline

[![Tests](https://img.shields.io/badge/tests-104%20passing-brightgreen?style=flat-square)](./src/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Palantir Foundry](https://img.shields.io/badge/Palantir-Foundry%20%2F%20OSDK-1F3A5F?style=flat-square)](https://www.palantir.com/platforms/foundry/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

> **Production-grade macro + crypto research pipeline.** Ingests data from five authoritative sources, derives trading signals, writes linked Ontology objects to Palantir Foundry, and generates AI-powered investment research reports — end to end.

Built as a reference implementation of how to operationalize quantitative research inside Palantir Foundry's Ontology. The graph — `MacroIndicator → SectorSnapshot → WatchlistCompany` — lets analysts traverse from a Fed rate move to affected sectors to specific names in a single Foundry Object Explorer query.

---

## Contents

- [What it does](#what-it-does)
- [Live demo](#live-demo)
- [Architecture](#architecture)
- [Foundry Ontology schema](#foundry-ontology-schema)
- [Data sources](#data-sources)
- [Signal logic](#signal-logic)
- [Tests](#tests)
- [Quick start](#quick-start)
- [Sample AI research report](#sample-ai-research-report)
- [Real-world use case](#real-world-use-case)
- [Connecting to Foundry](#connecting-to-foundry)
- [Extending the pipeline](#extending-the-pipeline)

---

## What it does

```
┌─────────────────── INGESTION ───────────────────────┐
│                                                       │
│  FRED API          (14 economic series)               │
│  Yahoo Finance     (11 SPDR sector ETFs)              │
│  CoinMarketCap     (global crypto metrics)            │
│  DeFiLlama         (DeFi TVL)                        │
│  Fear & Greed      (market sentiment 0–100)           │
│                                                       │
└──────────────────── ↓ ──────────────────────────────┘
                       │
              Transform Layer
          (pure functions, fully tested)
                       │
┌──────────────────── ↓ ──────────────────────────────┐
│                                                       │
│  MacroIndicator     ── BULLISH / BEARISH / NEUTRAL    │
│  SectorSnapshot     ── linked to macro drivers        │
│  CryptoMetric       ── contrarian + structural logic  │
│  CategorySnapshot   ── BTC / ETH / DeFi / Stables    │
│                                                       │
│  Inferred Regime: EXPANSION | SLOWDOWN |              │
│                   CONTRACTION | RECOVERY              │
│  Crypto Regime:   BULL_MARKET | ALT_SEASON |          │
│                   RISK_OFF | BEAR_MARKET              │
│                                                       │
└──────────────────── ↓ ──────────────────────────────┘
                       │
         Palantir Foundry Ontology (OSDK)
         + Claude Opus 4.6 Research Report
```

**In a single command:**
1. Fetches 14 FRED economic series + live sector performance across 11 SPDR ETFs
2. Fetches global crypto market metrics from CMC, DeFiLlama TVL, and Fear & Greed Index
3. Derives `BULLISH / BEARISH / NEUTRAL` signals with one-line rationales using category-aware logic
4. Infers macro regime (`EXPANSION / SLOWDOWN / CONTRACTION / RECOVERY`) and crypto regime
5. Writes 38 linked Ontology objects to Foundry (or prints a full dry-run table)
6. Optionally streams an AI-generated investment research report via Claude Opus 4.6

---

## Live demo

```
$ npm run dry-run:all

📈  Foundry Macro Research Pipeline
Run ID: a3f2b1c4-9e1d-4f2a-b3c7-8d9e0f1a2b3c
Mode:   DRY RUN | Pipeline: ALL

[FRED] No API key — using fixture data.
[Yahoo Finance] Fetching sector performance...
[Yahoo Finance] ✓ Sector performance fetched (12/12 tickers)
[CMC] No API key — using fixture data.
[DeFiLlama] ✓ TVL: $91.0B
[FearGreed] ✓ Index: 8 (Extreme Fear)

  ✓ FRED: 14 series → 14 MacroIndicator objects
  ✓ Sectors: 11 SectorSnapshot objects
  ✓ Crypto: 8 CryptoMetric objects
  ✓ Categories: 5 CategorySnapshot objects

📡  Syncing to Foundry Ontology...

[DRY RUN] Would write 14 MacroIndicator + 11 SectorSnapshot objects to Foundry

  MACRO INDICATORS
  Series ID         Value              Delta (period)      Signal     52w Range
  ──────────────────────────────────────────────────────────────────────────────
  DFF               3.64%              -0.250 (-6.42%)     BULLISH    58th pctile
  DGS10             4.08%              +0.090 (+2.26%)     BEARISH    15th pctile
  T10Y2Y            +0.60              +0.050 (+9.09%)     BEARISH    0th pctile
  CPIAUCSL          326.6              +0.560 (+0.17%)     BEARISH    100th pctile
  CPILFESL          332.8              +0.960 (+0.29%)     BEARISH    100th pctile
  UNRATE            4.3%               -0.100 (-2.27%)     NEUTRAL    69th pctile
  PAYEMS            159,534K           +130 (+0.08%)       BULLISH    75th pctile
  UMCSENT           56.4               +3.500 (+6.62%)     BEARISH    22nd pctile
  BAMLH0A0HYM2      2.86%              -0.020 (-0.69%)     NEUTRAL    63rd pctile
  MORTGAGE30US      6.01%              -0.020 (-0.33%)     BULLISH    0th pctile
  HOUST             1,404K             +82 (+6.20%)        BULLISH    25th pctile

  Inferred Macro Regime: SLOWDOWN

  SECTOR SNAPSHOTS
  Ticker    Sector                    Signal     YTD Perf    vs SPY
  ──────────────────────────────────────────────────────────────────
  XLU       Utilities                 BULLISH    +15.32%     +7.92%
  XLC       Communication Services    BULLISH    +14.11%     +6.71%
  XLK       Technology                BEARISH    +18.41%     +11.01%
  XLF       Financials                NEUTRAL    +12.01%     +4.61%
  XLE       Energy                    NEUTRAL    +10.21%     +2.81%
  XLV       Health Care               BEARISH    +6.11%      -1.29%

  CRYPTO METRICS
  Metric ID               Value                  Delta            Signal
  ──────────────────────────────────────────────────────────────────────
  TOTAL_MARKET_CAP        $2,192.22B             -1.75%           BEARISH
  BTC_DOMINANCE           57.70%                 n/a              NEUTRAL
  FEAR_GREED              8.00                   n/a              BULLISH
  STABLECOIN_MARKET_CAP   $285.00B               +53.72%          BULLISH
  DEFI_TVL                $91.00B                -24.17%          BEARISH

  CATEGORY SNAPSHOTS
  Category                  Market Cap       Dom %      Signal
  ──────────────────────────────────────────────────────────
  Bitcoin                   $1,265B          57.7%      BULLISH
  Ethereum Ecosystem        $221B            10.1%      BEARISH
  DeFi                      $53B             2.4%       BEARISH
  Stablecoins               $285B            13.0%      BULLISH
  Altcoins                  $926B            42.3%      BEARISH

  Inferred Crypto Regime: BEAR_MARKET

📊  Pipeline Summary
────────────────────────────────────────
  Indicators:   14
  Sectors:      11
  Synced:       38
  Duration:     1,847ms

  ⚡ Dry-run complete. Set DRY_RUN=false and add Foundry credentials to sync live.
```

---

## Architecture

```
src/
├── index.ts                         CLI entry point & pipeline orchestration
├── config.ts                        Zod-validated environment config
├── types/index.ts                   Canonical domain types (MacroIndicator, SectorSnapshot, etc.)
│
├── ingestion/
│   ├── fredRegistry.ts              14 FRED series definitions + sector linkage map
│   ├── fred.ts                      FRED API client (+ fixture fallback)
│   ├── sectors.ts                   Yahoo Finance sector ETF performance
│   ├── coinmarketcap.ts             CoinMarketCap global metrics (+ fixture)
│   ├── defillama.ts                 DeFiLlama TVL client (+ fixture)
│   └── feargreed.ts                 Fear & Greed Index client (+ fixture)
│
├── transforms/
│   ├── toOntologyObjects.ts         FRED + sectors → MacroIndicator + SectorSnapshot
│   └── toCryptoObjects.ts           CMC + DeFiLlama + FearGreed → CryptoMetric + CategorySnapshot
│
├── foundry/
│   ├── objectTypes.ts               Foundry Ontology schema registry
│   └── client.ts                    OSDK client stub + dry-run formatter
│
└── report/
    └── generate.ts                  Claude Opus 4.6 streaming report generation
```

**Design principles:**

| Principle | Implementation |
|-----------|---------------|
| **Ontology-first** | All data normalizes to linked Object Types before any write. No raw API shapes reach Foundry. |
| **Pure transforms** | Signal/regime derivation has zero I/O — every function is independently unit-testable. |
| **Idempotent writes** | Primary keys are `{seriesId}` and `{ticker}_{date}` — re-running produces upserts, not duplicates. |
| **Registry-driven** | One line in `fredRegistry.ts` adds a new indicator. No ingestion or transform changes needed. |
| **Graceful fallbacks** | Every API has built-in fixture data. Pipeline runs successfully with zero credentials in dry-run. |

---

## Foundry Ontology schema

### Object Type: `macro_indicator`

| Property | Type | Description |
|----------|------|-------------|
| `seriesId` | `string` | **Primary key** — FRED series ID (e.g. `DFF`, `CPIAUCSL`) |
| `name` | `string` | Human-readable indicator name |
| `category` | `string` | `INTEREST_RATES` \| `INFLATION` \| `EMPLOYMENT` \| `GROWTH` \| `CREDIT` \| `HOUSING` \| `SENTIMENT` |
| `latestValue` | `double` | Most recent observation |
| `latestDate` | `date` | Date of latest observation |
| `priorValue` | `double` | Previous observation |
| `periodDelta` | `double` | Absolute change from prior |
| `periodDeltaPct` | `double` | % change from prior |
| `yearLow` / `yearHigh` | `double` | 52-week range |
| `yearPercentile` | `double` | Position in 52-week range (0 = low, 1 = high) |
| `signal` | `string` | `BULLISH` \| `BEARISH` \| `NEUTRAL` |
| `signalRationale` | `string` | One-line explanation |
| `frequency` | `string` | `DAILY` \| `WEEKLY` \| `MONTHLY` \| `QUARTERLY` |

### Object Type: `sector_snapshot`

| Property | Type | Description |
|----------|------|-------------|
| `snapshotId` | `string` | **Primary key** — `{ticker}_{date}` |
| `sectorTicker` | `string` | SPDR ETF ticker (XLF, XLE, XLK, …) |
| `sectorName` | `string` | Human-readable sector name |
| `dayChangePct` | `double` | 1-day performance vs prior close |
| `weekChangePct` | `double` | 5-day performance |
| `monthChangePct` | `double` | 1-month (22 trading days) performance |
| `ytdChangePct` | `double` | Year-to-date performance |
| `relativeStrengthVsSPY` | `double` | YTD outperformance vs SPY |
| `macroRegime` | `string` | Inferred regime: `EXPANSION` \| `SLOWDOWN` \| `CONTRACTION` \| `RECOVERY` |
| `primaryMacroDrivers` | `string[]` | FRED series IDs that drive this sector |
| `sectorSignal` | `string` | `BULLISH` \| `BEARISH` \| `NEUTRAL` |

### Object Type: `crypto_metric`

| Property | Type | Description |
|----------|------|-------------|
| `metricId` | `string` | **Primary key** — `TOTAL_MARKET_CAP`, `BTC_DOMINANCE`, `FEAR_GREED`, etc. |
| `latestValue` | `double` | Current value |
| `periodDeltaPct` | `double` | % change from prior period |
| `signal` | `string` | `BULLISH` \| `BEARISH` \| `NEUTRAL` |
| `signalRationale` | `string` | One-line explanation |
| `cryptoRegime` | `string` | `BULL_MARKET` \| `ALT_SEASON` \| `RISK_OFF` \| `BEAR_MARKET` |

### Object Type: `watchlist_company`

| Property | Type | Description |
|----------|------|-------------|
| `ticker` | `string` | **Primary key** |
| `sectorTicker` | `string` | Links to `sector_snapshot` |
| `rateSensitivity` | `double` | 0–1 sensitivity to rate changes |
| `inflationSensitivity` | `double` | 0–1 sensitivity to inflation |
| `usdSensitivity` | `double` | 0–1 sensitivity to USD strength |
| `analystNotes` | `string` | Freeform research notes |

### Link Types

| Link Type | From → To | Description |
|-----------|-----------|-------------|
| `sector_macro_driver` | `sector_snapshot → macro_indicator` | Which FRED series drive this sector |
| `company_in_sector` | `watchlist_company → sector_snapshot` | Company's sector membership |

---

## Data sources

| Source | Coverage | Auth | Cost | Latency |
|--------|----------|------|------|---------|
| [FRED (St. Louis Fed)](https://fred.stlouisfed.org/) | 14 economic series | Free API key | Free | 1–24 hr |
| [Yahoo Finance](https://finance.yahoo.com/) | 11 SPDR sector ETFs + SPY | None | Free | Real-time |
| [CoinMarketCap](https://coinmarketcap.com/api/) | Global crypto market metrics | Free API key | Free | Real-time |
| [DeFiLlama](https://defillama.com/docs/api) | Total DeFi TVL | None | Free | Real-time |
| [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) | Crypto Fear & Greed Index | None | Free | Daily |

**Zero-cost operation.** All five API keys are free. Without them, built-in fixture data is used — the full pipeline runs with `npm run dry-run:all` and zero configuration.

---

## Tracked FRED indicators

| Series ID | Indicator | Category | Signal Logic |
|-----------|-----------|----------|-------------|
| `DFF` | Federal Funds Effective Rate | INTEREST_RATES | Rising = BEARISH (tighter credit) |
| `DGS10` | 10-Year Treasury Rate | INTEREST_RATES | High percentile = BEARISH |
| `T10Y2Y` | 10Y–2Y Yield Spread | INTEREST_RATES | Inverted = BEARISH |
| `CPIAUCSL` | Headline CPI | INFLATION | Rising = BEARISH (erodes purchasing power) |
| `CPILFESL` | Core CPI (ex Food & Energy) | INFLATION | Sticky = BEARISH |
| `PPIACO` | Producer Price Index | INFLATION | Rising = BEARISH (margin pressure) |
| `UNRATE` | Unemployment Rate | EMPLOYMENT | Rising = BEARISH (labor weakness) |
| `PAYEMS` | Nonfarm Payrolls | EMPLOYMENT | Rising = BULLISH |
| `GDP` | Gross Domestic Product | GROWTH | Rising = BULLISH |
| `INDPRO` | Industrial Production Index | GROWTH | Rising = BULLISH |
| `BAMLH0A0HYM2` | HY Credit Spread (OAS) | CREDIT | Widening = BEARISH (stress signal) |
| `MORTGAGE30US` | 30-Year Mortgage Rate | HOUSING | Falling = BULLISH |
| `HOUST` | Housing Starts | HOUSING | Rising = BULLISH |
| `UMCSENT` | UMich Consumer Sentiment | SENTIMENT | Falling = BEARISH |

To add more: one line in `src/ingestion/fredRegistry.ts`. No other changes needed.

---

## Signal logic

### Macro signals (`toOntologyObjects.ts`)

Signal derivation is **category-aware** and uses two inputs: the period delta direction and the 52-week percentile.

```
INTEREST_RATES / INFLATION / CREDIT — inverse sentiment
  Rising & high percentile  → BEARISH   (tighter conditions)
  Falling & low percentile  → BULLISH   (easing conditions)
  Mixed                     → NEUTRAL

EMPLOYMENT / GROWTH / HOUSING — positive sentiment
  Rising & high percentile  → BULLISH
  Falling & low percentile  → BEARISH
  Mixed                     → NEUTRAL

SENTIMENT
  Low percentile (< 30th)   → BEARISH   (consumer pessimism)
  High percentile (> 70th)  → BULLISH
```

### Macro regime inference

```
Scoring across UNRATE, DFF, T10Y2Y, UMCSENT:

  Unemployment not rising   → +1
  Rates being cut           → +1
  Yield curve not inverted  → +1
  Sentiment strong          → +1

  Score ≥ 3  → EXPANSION
  Score ≥ 1  → RECOVERY
  Score ≤ -3 → CONTRACTION
  Default    → SLOWDOWN
```

### Crypto signals (`toCryptoObjects.ts`)

```
BTC_DOMINANCE
  > 60%        → BEARISH (risk-off flight to BTC)
  < 45%        → BULLISH (alt season rotation)
  45–60%       → NEUTRAL

FEAR_GREED (contrarian)
  ≤ 25         → BULLISH (extreme fear = buy signal)
  ≥ 75         → BEARISH (extreme greed = caution)
  40–65        → NEUTRAL

STABLECOIN_MARKET_CAP
  Rising       → BULLISH (dry powder accumulating)
  Declining    → NEUTRAL

DEFI_TVL
  Rising       → BULLISH (capital deploying to DeFi)
  Declining    → BEARISH
```

---

## Tests

**104 tests across 8 test files. Runs in ~400ms. Zero network calls.**

```
$ npm test

 ✓  unit/transforms/toCryptoObjects.test.ts     (31 tests)   19ms
 ✓  unit/transforms/toOntologyObjects.test.ts   (32 tests)    7ms
 ✓  unit/ingestion/fred.test.ts                  (3 tests)  142ms
 ✓  unit/ingestion/defillama.test.ts             (8 tests)    5ms
 ✓  unit/ingestion/feargreed.test.ts             (7 tests)    6ms
 ✓  unit/ingestion/sectors.test.ts               (6 tests)   11ms
 ✓  unit/ingestion/coinmarketcap.test.ts         (5 tests)    6ms
 ✓  e2e/pipeline.test.ts                        (12 tests)  159ms

 Test Files   8 passed (8)
 Tests       104 passed (104)
 Duration    410ms
```

**Coverage:** Signal derivation, regime inference, object construction, fixture fallbacks, API mock paths, and full end-to-end pipeline validation.

---

## Quick start

Zero credentials required. The pipeline runs with built-in fixture data.

```bash
git clone https://github.com/julian-m-dev/foundry-macro-research.git
cd foundry-macro-research
npm install
cp .env.example .env

# Dry run with no credentials (uses fixture data)
npm run dry-run:all

# Add your free API keys to .env, then run with live data:
# FRED_API_KEY      → https://fred.stlouisfed.org/docs/api/api_key.html
# COINMARKETCAP_API_KEY → https://coinmarketcap.com/api/
npm run dry-run:all

# Generate an AI research report (requires ANTHROPIC_API_KEY)
npm run report
```

Available commands:

| Command | Description |
|---------|-------------|
| `npm run dry-run` | Macro pipeline, dry-run (fixture fallback if no keys) |
| `npm run dry-run:crypto` | Crypto pipeline only |
| `npm run dry-run:all` | Full macro + crypto pipeline |
| `npm run report` | Full pipeline + Claude Opus 4.6 research report |
| `npm test` | Run all 104 tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run typecheck` | TypeScript type check |

---

## Sample AI research report

> Running `npm run report` calls Claude Opus 4.6 with the full pipeline output to generate an investment research report. [View the full sample →](./docs/sample-report.md)

**Excerpt — Bottom Line Up Front:**

> *The US economy is in a confirmed **slowdown regime** with a dangerous stagflationary undercurrent: core CPI is re-accelerating at +0.29% MoM while GDP growth decelerates and consumer sentiment lingers near cycle lows at 56.4. The Fed has cut to 3.64% but is now boxed in — sticky inflation (CPI and Core CPI both at 100th percentile of 52-week range) removes the option for further easing. Crypto has entered a **bear market regime** with total market cap declining and the Fear & Greed Index at an extreme-fear reading of 8, yet stablecoin supply has surged +53.7% — creating a historic wall of sidelined capital that could fuel a violent reversal if macro conditions stabilize. **Position defensively, accumulate high-conviction assets into fear, and hedge against a stagflationary tail risk.***

**Excerpt — Investment Ideas:**

> **IDEA 1: Overweight Bitcoin (BTC) — Contrarian Accumulation**
> Fear & Greed at 8, stablecoin dry powder at $285B (+53.7%), and BTC dominance at 57.7% create a textbook contrarian setup. Bitcoin has historically returned 100%+ in the 12 months following extreme-fear readings below 10. **Target: $90,000–$100,000** (40–55% upside) on 12-month horizon as stablecoin capital deploys. *Key risk: Core CPI continues accelerating, forcing the Fed to hike.*

> **IDEA 2: Long Utilities (XLU) / Short Consumer Discretionary (XLY) — Defensive Pair Trade**
> XLU BULLISH with +15.3% YTD, benefits from falling mortgage rates (6.01%, 52-week low). XLY BEARISH with +4.2% YTD, exposed to the consumer sentiment collapse (56.4). **Target: 8–12% spread widening** over 3–6 months in a stagflationary slowdown.

> **IDEA 4: Long Housing-Exposed Equities (DHI, LEN, ITB) — Early Cycle Recovery**
> Mortgage rates at 6.01% (0th percentile — 52-week low) and housing starts +6.2% MoM. Real estate (XLRE) only +2.0% YTD — the market hasn't priced the recovery. **Target: 10–15% upside** over 6 months. *Alternative expression: ITB, XHB.*

---

## Real-world use case

### Macro overlay at a multi-asset fund

**The status quo at most funds:** two analysts, one PM, and 38 spreadsheets. Every morning one analyst pulls FRED into Excel and color-codes cells. Another queries Bloomberg Terminal for sector momentum. The PM reads a crypto newsletter and reconciles it manually with the equity view. By the time the morning meeting starts, everyone is arguing about whether the CPI print is bearish for XLF — with three different data vintages on three different laptops.

**What changes when this runs on Foundry:**

```
06:00 EST  Foundry Transform triggers the pipeline
           ├── FRED refresh          (14 macro indicators)
           ├── Yahoo Finance         (11 SPDR sector snapshots)
           └── CMC + DeFiLlama + F&G (8 crypto metrics + 5 category snapshots)

06:45 EST  38 Ontology objects written — idempotent upserts, versioned, timestamped
           └── Foundry notification: macro regime change detected
               RECOVERY → SLOWDOWN  (score dropped: UNRATE rising, UMCSENT < 70)

06:50 EST  Claude Opus 4.6 generates the morning research brief
           └── Saved to Foundry Dataset: macro_reports/2026-02-24.md
               BLUF + macro analysis + cross-market synthesis + 5 investment ideas

09:00 EST  Morning meeting
           Everyone is working from the same Ontology.
           No conflicting Excel versions. No "which Bloomberg function?"
           Regime is SLOWDOWN. Crypto is BEAR_MARKET. The brief is already written.
```

### The linked graph is the product

The data itself isn't the differentiator — Bloomberg already has the data. The value is the **traversable graph**. When the T10Y2Y spread moves and flips `XLF` to `BEARISH`, that update propagates through every linked `watchlist_company` in the Financials sector. Foundry apps downstream — risk dashboards, portfolio construction tools, AIP agents — see the change without an analyst touching anything.

An AIP Logic user can type natural language against the live Ontology:

> *"Which sectors have a BEARISH signal and contain companies where we have a long position greater than $10M?"*

Foundry joins `sector_snapshot` → `company_in_sector` → the portfolio book in real time. The answer isn't a static report — it's a live query against a graph that updates every morning.

> *"Given the current macro regime and the stablecoin accumulation signal, what's our crypto book's risk/reward?"*

The same Ontology that powers the morning brief powers the risk query. One data model, every downstream use.

### Extend it to any use case

This pipeline is built for a macro overlay desk, but the Ontology pattern generalizes immediately:

| Use case | What you add |
|----------|-------------|
| **Equity long/short** | Populate `watchlist_company` with holdings; link to `sector_snapshot`; AIP queries surface regime mismatches in the book |
| **Corporate treasury** | Swap sector ETFs for FX rates + commodity prices; link to operating entities by geography |
| **Credit desk** | Add `BAMLH0A0HYM2` stress scenarios; link HY issuers to `sector_snapshot` by industry; trigger alerts on spread widening |
| **Sovereign / central bank** | Replace Yahoo Finance with sovereign CDS, EM FX, and current account data; same regime inference architecture |
| **Risk committee dashboard** | Expose `macro_indicator` objects to a Foundry Slate dashboard; regime changes trigger automated board-level summaries |

The core architecture — **registry-driven ingestion → pure signal transforms → linked Ontology objects → AI-generated brief** — is the same in every case. The difference is which series you track.

---

## Connecting to Foundry

### 1. Create Object Types in Ontology Manager

Use `src/foundry/objectTypes.ts` as the schema reference. Create:
- `macro_indicator` with primary key `seriesId`
- `sector_snapshot` with primary key `snapshotId`
- `crypto_metric` with primary key `metricId`
- `watchlist_company` with primary key `ticker`

Set up the `sector_macro_driver` and `company_in_sector` link types.

### 2. Generate your OSDK package

Follow the [OSDK getting started guide](https://www.palantir.com/docs/foundry/ontology-sdk/get-started) to generate a TypeScript SDK for your Foundry environment.

### 3. Wire the client

In `src/foundry/client.ts`, replace the `createFoundryClient` stub:

```typescript
import { createClient } from "@your-foundry-env/sdk";
import { ConfidentialClientAuth } from "@osdk/oauth";

const auth = new ConfidentialClientAuth({
  clientId:     cfg.FOUNDRY_CLIENT_ID!,
  clientSecret: cfg.FOUNDRY_CLIENT_SECRET!,
  url:          cfg.FOUNDRY_URL!,
});

return createClient(cfg.FOUNDRY_URL!, "@your-foundry-env/sdk", auth);
```

### 4. Run live

```bash
# .env
FOUNDRY_URL=https://your-org.palantirfoundry.com
FOUNDRY_CLIENT_ID=your-client-id
FOUNDRY_CLIENT_SECRET=your-client-secret
DRY_RUN=false
FRED_API_KEY=your-free-fred-key
COINMARKETCAP_API_KEY=your-free-cmc-key

npm start
```

Objects are written in batches (configurable `BATCH_SIZE`). Keys are idempotent — re-running upserts without duplicates.

---

## Extending the pipeline

**Add a FRED indicator** — one line in `src/ingestion/fredRegistry.ts`:
```typescript
{ seriesId: "VIXCLS", category: "SENTIMENT", inverseSentiment: true, ... }
```
The ingestion, transform, and signal logic pick it up automatically.

**Add a crypto metric** — one entry in `src/ingestion/cryptoRegistry.ts`. Signal logic is defined per-metric in `toCryptoObjects.ts`.

**Add link types** — define in `src/foundry/objectTypes.ts`, implement writes in `client.ts`.

**Connect to AIP Logic** — once objects are in Foundry, expose them to AIP for natural-language queries:
> *"Which sectors are most exposed to the current rate environment?"*
> *"What does the stablecoin accumulation signal for BTC in the next quarter?"*

---

## Project structure

```
foundry-macro-research/
├── src/                    TypeScript source
│   ├── index.ts            Entry point
│   ├── config.ts           Zod-validated config
│   ├── types/              Domain types
│   ├── ingestion/          API clients (5 sources + fixtures)
│   ├── transforms/         Pure signal & regime logic
│   ├── foundry/            OSDK client + schema
│   ├── report/             Claude Opus 4.6 report generator
│   └── tests/              104 unit + e2e tests
├── reports/                Generated research reports (markdown)
├── docs/
│   └── sample-report.md    Example AI-generated research report
├── .env.example            Environment template
├── vitest.config.ts        Test configuration
└── tsconfig.json           TypeScript configuration
```

---

## License

MIT — built by Julian Martinez.
