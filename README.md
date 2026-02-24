# Foundry Macro Research Pipeline

A live macro and crypto research system built on **Palantir Foundry** and **Claude Opus 4.6**.

Ingests real-time economic data from six sources, writes structured objects into a Foundry Ontology via the Actions API, then runs an autonomous Claude agent that reads from Foundry, investigates anomalies with historical FRED data, and produces structured investment research notes — all from a single command.

No mock data. No fixtures. Every source is live.

---

## What it does

```
FRED API (14 series)      ─┐
Yahoo Finance (11 ETFs)    ├──► Transform ──► Palantir Foundry Ontology
CoinMarketCap              ├──►              (Density + SectorSnapshot objects)
DeFiLlama                  ├──►                        │
Fear & Greed Index         ─┘                          ▼
                                            Claude Opus 4.6 Research Agent
                                            ├── reads Foundry objects
                                            ├── fetches FRED history on demand
                                            └── writes research note to disk
```

1. **Ingest** — fetches live data from FRED, Yahoo Finance, CoinMarketCap, DeFiLlama, and the Fear & Greed Index
2. **Transform** — derives BULLISH / BEARISH / NEUTRAL signals, 52-week percentile rankings, and macro regime classification
3. **Sync** — upserts objects into Palantir Foundry using the Ontology Actions API
4. **Agent** — Claude Opus 4.6 autonomously reads the live Foundry objects, spots anomalies, fetches additional time-series to validate hypotheses, and writes a structured research note
5. **Report** *(optional)* — generates a long-form markdown investment research report via Claude

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript |
| Palantir | Foundry REST API v2 — Ontology Actions |
| AI | Anthropic Claude Opus 4.6 (adaptive thinking + tool use) |
| Data | FRED, Yahoo Finance, CoinMarketCap, DeFiLlama, Alternative.me |
| Config | Zod |

---

## Palantir Foundry integration

Objects are written via the **Ontology Actions API** — the correct mechanism for programmatic writes in Foundry:

```
POST /api/v2/ontologies/{ontology}/actions/{action}/apply
```

**Object types:**

| Foundry type | Maps to | Upsert key |
|---|---|---|
| `Density` | MacroIndicator | `sourceUrl` (FRED series URL) |
| `SectorSnapshot` | Sector ETF snapshot | `sectorTicker + date` |

On every run the pipeline lists existing objects, matches by natural key, then calls `create-density` / `edit-density` / `create-sector-snapshot` / `edit-sector-snapshot` as appropriate. Full upsert — no duplicates.

The **Claude agent reads directly from the live Foundry Ontology** via `GET /api/v2/ontologies/{ontology}/objects/{type}`, treating Foundry as the source of truth rather than the in-memory pipeline output.

---

## Tracked indicators

**Macro (→ Density objects in Foundry)**

| Series | Indicator | Signal direction |
|--------|-----------|-----------------|
| `DFF` | Fed Funds Rate | Rising = BEARISH |
| `DGS10` | 10-Year Treasury | High = BEARISH |
| `T10Y2Y` | 10Y–2Y Spread | Inverted = BEARISH |
| `CPIAUCSL` | CPI (headline) | Rising = BEARISH |
| `CPILFESL` | Core CPI | Rising = BEARISH |
| `PPIACO` | Producer Price Index | Rising = BEARISH |
| `UNRATE` | Unemployment Rate | Rising = BEARISH |
| `PAYEMS` | Nonfarm Payrolls | Rising = BULLISH |
| `GDP` | Gross Domestic Product | Rising = BULLISH |
| `INDPRO` | Industrial Production | Rising = BULLISH |
| `BAMLH0A0HYM2` | HY Credit Spread | Widening = BEARISH |
| `MORTGAGE30US` | 30-Year Mortgage Rate | Falling = BULLISH |
| `HOUST` | Housing Starts | Rising = BULLISH |
| `UMCSENT` | Consumer Sentiment | Falling = BEARISH |

**Sectors (→ SectorSnapshot objects in Foundry)**

XLK · XLF · XLE · XLP · XLI · XLB · XLRE · XLU · XLV · XLY · XLC · SPY

---

## Claude Research Agent

The agent (`--agent` flag) is a multi-turn agentic loop using Claude Opus 4.6 with adaptive thinking. It has three tools:

```typescript
read_foundry_objects(objectType: "Density" | "SectorSnapshot")
// Reads live objects directly from the Palantir Ontology

fetch_fred_series(seriesId: string, limit?: number)
// Fetches historical FRED observations to validate anomalies

write_research_note(title, macroRegime, summary, keyFindings, anomalies, investmentIdeas, confidence)
// Saves a structured research note as both JSON and Markdown
```

The agent autonomously decides what to read, what to investigate, and what conclusions to draw. A typical run looks like:

```
Turn 1 — reads Density + SectorSnapshot from Foundry in parallel
Turn 2 — spots two anomalies, fetches T10Y2Y and UMCSENT history from FRED
Turn 3 — fetches CPILFESL to validate Core CPI reacceleration thesis
Turn 4 — writes structured research note with anomalies + investment ideas
```

**Example output** (real run, 2026-02-24, `SLOWDOWN` regime, `HIGH` confidence):

> Hard/Soft Data Divergence Widens as Yield Curve Hits 52-Week Lows
>
> Backward-looking hard data (GDP, IP, payrolls all at 100th percentile) remains robust,
> but Consumer Sentiment has collapsed 29% over 22 months and the 10Y-2Y spread has
> flattened 14bp in 3 weeks to its 52-week low. Core CPI at +0.295% MoM (~3.6% annualized)
> constrains the Fed's room to ease.
>
> Anomaly flagged: XLF -7.65% YTD while HY spreads sit at 2.86% — credit markets
> are complacent relative to the equity signal in financials.
>
> Ideas: LONG XLP, LONG XLRE, SHORT XLF, SHORT HYG

---

## Setup

```bash
git clone https://github.com/julian-m-dev/foundry-macro-research
cd foundry-macro-research
npm install
```

Create a `.env` file:

```env
# Palantir Foundry
FOUNDRY_URL=https://your-instance.palantirfoundry.com
FOUNDRY_TOKEN=your-token

# Data sources (all free)
FRED_API_KEY=           # https://fred.stlouisfed.org/docs/api/api_key.html
COINMARKETCAP_API_KEY=  # https://coinmarketcap.com/api/

# AI
ANTHROPIC_API_KEY=      # https://console.anthropic.com

# Set to empty string to write to Foundry; true to print only
DRY_RUN=true
```

Yahoo Finance, DeFiLlama, and Fear & Greed require no key.

---

## Usage

```bash
# Sync live data to Foundry + run the Claude agent
DRY_RUN= npm run dev -- --mode all --agent

# Sync only
DRY_RUN= npm run dev -- --mode all

# Agent only (reads existing Foundry objects, no new sync)
DRY_RUN= npm run agent

# Sync + long-form Claude report
DRY_RUN= npm run dev -- --mode all --report

# Print pipeline output without writing to Foundry
npm run dry-run:all
```

| Flag | Effect |
|------|--------|
| `--mode macro` | FRED + Yahoo Finance only |
| `--mode crypto` | CoinMarketCap + DeFiLlama + Fear & Greed only |
| `--mode all` | All six sources |
| `--agent` | Run autonomous Claude research agent after sync |
| `--report` | Generate long-form markdown investment report via Claude |
| `--dry-run` | Print transformed objects, skip Foundry writes |
| `--output-json` | Write pipeline output to `./output.json` |

---

## Error handling

No fixture fallbacks exist in this codebase. If a data source fails, the error is logged and the pipeline continues with whatever sources succeeded. Foundry writes only include objects backed by live data.

```
[FRED] ✓ 14 series fetched
[Yahoo Finance] ✓ Sector performance fetched (12/12 tickers)
[CMC] ✓ Global metrics fetched
[DeFiLlama] ✓ TVL: $90.5B
[FearGreed] ✓ Index: 8 (Extreme Fear)
[Foundry] ✓ Indicators: 14 synced  |  Sectors: 11 synced
```

If a source is unavailable, you see:

```
[FRED] Error: FRED_API_KEY is not set.
  ✗ FRED: Error fetching indicators
```

The run continues. Missing sources are listed in the pipeline summary under `Errors`.

---

## Project structure

```
src/
├── agent/
│   ├── loop.ts          Agentic loop — multi-turn Claude Opus 4.6 with tool use
│   └── tools.ts         Tool definitions + execution functions
├── foundry/
│   └── client.ts        Foundry Actions API client (upsert via create/edit actions)
├── ingestion/
│   ├── fred.ts          FRED API client
│   ├── fredRegistry.ts  Series definitions and macro driver linkages
│   ├── sectors.ts       Yahoo Finance sector ETF client
│   ├── coinmarketcap.ts CoinMarketCap global metrics
│   ├── defillama.ts     DeFiLlama TVL
│   └── feargreed.ts     Alternative.me Fear & Greed Index
├── transforms/
│   ├── toOntologyObjects.ts  FRED + sectors → MacroIndicator + SectorSnapshot
│   └── toCryptoObjects.ts    CMC + DeFi + FG → CryptoMetric + CategorySnapshot
├── report/
│   └── generate.ts      Long-form Claude research report
├── types/
│   └── index.ts         Shared TypeScript domain types
├── config.ts            Zod-validated environment config
└── index.ts             CLI entry point
reports/                 Agent research notes + Claude reports (gitignored)
```

---

## License

MIT
