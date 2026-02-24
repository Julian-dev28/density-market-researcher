# Macro Research Pipeline

A live macro + crypto research system powered by **Claude Opus 4.6** and **Postgres** (via Supabase), with **Sentient Chat** integration, **CryptoAnalystBench** quality scoring, and **x402** USDC micropayment gating.

Ingests real-time economic data from five sources, syncs structured objects to a Postgres database, then runs an autonomous AI research agent that reads its own prior conclusions, verifies whether they held up, identifies anomalies in live data, scores each note for analytical quality, and writes investment research notes — compounding intelligence over time. A Next.js dashboard surfaces everything live.

---

## What it does

```
FRED API (14 series)     ─┐
Yahoo Finance (11 ETFs)   ├──► Transform ──► Postgres (Drizzle ORM)
CoinMarketCap             ├──►                    │
DeFiLlama                 ├──►                    ▼
Fear & Greed Index        ─┘         Claude Opus 4.6 Research Agent
                                     ├── reads prior findings + verifies accuracy
                                     ├── queries pattern memory (similar regimes)
                                     ├── reads live macro + crypto + sector data
                                     ├── fetches FRED history to validate anomalies
                                     ├── tasks OpenHands to build missing data sources
                                     ├── writes structured research note → DB + disk
                                     └── scores note quality (Claude Haiku, 4 dimensions)
                                                    │
                                                    ▼
                                       Next.js Dashboard (live data,
                                       conviction history, research feed,
                                       quality scores, Sentient Chat)
```

1. **Ingest** — fetches live data from FRED, Yahoo Finance, CoinMarketCap, DeFiLlama, and the Fear & Greed Index
2. **Transform** — derives BULLISH / BEARISH / NEUTRAL signals, 52-week percentile rankings, and macro regime classification
3. **Sync** — upserts all objects to Postgres with Drizzle ORM (idempotent, safe to re-run)
4. **Agent** — Claude Opus 4.6 runs a compound intelligence loop: reads memory, verifies prior calls, analyzes live data, writes a new research note
5. **Score** — Claude Haiku scores each note on 4 dimensions (relevance, depth, temporal accuracy, data consistency) via CryptoAnalystBench-style evaluation
6. **Dashboard** — Next.js app shows live indicators, sector performance, crypto metrics, conviction chart, quality scores, and the full research feed

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript |
| Database | Postgres via Supabase + Drizzle ORM |
| AI (research) | Anthropic Claude Opus 4.6 (adaptive thinking + tool use) |
| AI (scoring) | Anthropic Claude Haiku (fast quality judge) |
| Web | Next.js 16 App Router + Tailwind v4 |
| Scheduling | Trigger.dev v4 (pipeline every 6h + event-driven agent) |
| Data | FRED, Yahoo Finance, CoinMarketCap, DeFiLlama, Alternative.me |
| Payments | x402 protocol — USDC micropayments on Base |
| Chat | Sentient Agent Framework (SSE streaming) |

---

## The compound intelligence loop

Each agent run is not a one-off analysis — it compounds. The agent has seven tools:

| Tool | What it does |
|------|-------------|
| `read_prior_findings` | Reads previous research notes from DB — establishes continuity |
| `verify_prior_calls` | Fetches unverified (PENDING) prior findings to assess whether calls held up |
| `query_similar_regimes` | Searches historical findings for matching macro configurations — pattern memory |
| `read_foundry_objects` | Reads live macro indicators, sector snapshots, crypto metrics from Postgres |
| `fetch_fred_series` | Fetches historical FRED observations to validate anomaly hypotheses |
| `expand_data_sources` | Tasks OpenHands (AI engineer) to build a missing ingestion module and open a PR |
| `write_research_note` | Saves research note to disk + Postgres; includes conviction score + quality scores |

**Self-verification**: Each run assesses prior regime calls — CONFIRMED / PARTIAL / WRONG — building a calibrated track record. Conviction scores (1-10) visualized over time in the dashboard.

**Pattern memory**: `query_similar_regimes` searches all prior findings by regime + keyword. When the agent spots a yield curve flattening, it can ask "have I seen this before?" and surface what happened next.

**Autonomous expansion**: When the agent identifies a genuine data gap (e.g., needs Treasury auction data, options flow), it calls `expand_data_sources` — which fires an OpenHands API request. OpenHands writes the code, adds it to the pipeline, and opens a PR. The system grows itself.

**Quality scoring**: After each `write_research_note`, Claude Haiku evaluates the note on four dimensions (1-10 each):
- **Relevance** — does the analysis connect to current macro conditions?
- **Depth** — are claims backed by specific data points?
- **Temporal accuracy** — are time references precise and consistent?
- **Data consistency** — do figures agree internally?

Quality scores are stored in `agent_findings.quality_score` + `quality_scores` (JSON) and surfaced in the Research dashboard.

A typical agent run:

```
Turn 1 — read_prior_findings → understands what was seen last time
Turn 2 — verify_prior_calls → picks 3 pending calls to assess
Turn 3 — query_similar_regimes(SLOWDOWN, "yield curve") → finds 2 matching prior runs
Turn 4 — read_foundry_objects(Density) + read_foundry_objects(SectorSnapshot) in parallel
Turn 5 — fetch_fred_series(T10Y2Y) → validates yield curve flattening thesis
Turn 6 — fetch_fred_series(UMCSENT) → confirms consumer sentiment collapse
Turn 7 — write_research_note → conviction=7, verifications=[CONFIRMED, PARTIAL, WRONG]
       └─ Haiku scores: relevance=8 depth=7 temporal=9 consistency=8 overall=8.0
```

---

## Sentient integrations

### Sentient Chat endpoint

`POST /api/assist` implements the [Sentient Agent Framework](https://github.com/sentient-agi/Sentient-Agent-Framework) SSE protocol. The endpoint accepts a `{ query, session? }` body and streams the Claude response as:

```
event: TextChunkEvent
data: {"schema_version":"1.0","id":"...","source":"macro-research-agent","content_type":"TEXT_STREAM","stream_id":"...","is_complete":false,"content":"..."}

event: DoneEvent
data: {"schema_version":"1.0","id":"...","source":"macro-research-agent","content_type":"TEXT","content":"","is_complete":true}
```

The agent is automatically enriched with the 3 most recent research findings from the database — every chat response is grounded in live data.

### CryptoAnalystBench quality scoring

Inspired by Sentient's [CryptoAnalystBench](https://github.com/sentient-agi/CryptoAnalystBench) evaluation framework. After every `write_research_note` call, `src/agent/scorer.ts` calls Claude Haiku to score the note. The scorer never blocks the research note from being saved — on error or missing API key it returns `null` silently.

### x402 payment gating

`/api/feed` supports the [x402](https://github.com/sentient-agi/agent-payments-skill) payment protocol. Set `PAYMENT_ENABLED=true` to enforce 402 Payment Required on the research feed. Clients pay a USDC micropayment (configurable, default $0.10) on Base or Base Sepolia.

```
GET /api/feed  →  402 Payment Required
                  { x402Version: 1, error: "...", accepts: [{ scheme: "exact", network: "base-sepolia", ... }] }

GET /api/feed  +  X-PAYMENT: <base64 EIP-3009>
               →  200 OK  +  X-PAYMENT-RESPONSE: { x402Version: 1, status: "settled", txHash: "..." }
```

Payment gating is **disabled by default** (`PAYMENT_ENABLED=false`). The feed works normally without any x402 configuration.

---

## Tracked indicators

**Macro (14 FRED series)**

| Series | Indicator | Signal |
|--------|-----------|--------|
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

**Sectors (11 SPDR ETFs + SPY)**

XLK · XLF · XLE · XLP · XLI · XLB · XLRE · XLU · XLV · XLY · XLC · SPY

**Crypto (8 metrics, 5 category snapshots)**

Total market cap, BTC dominance, ETH dominance, Fear & Greed Index, DeFi TVL, stablecoin supply, altcoin market cap, 24h volume.

---

## Setup

```bash
git clone https://github.com/julian-m-dev/foundry-macro-research
cd foundry-macro-research
npm install
```

Create a `.env` file (copy from `.env.example`):

```env
# Postgres (required for live sync — skip with --dry-run)
DATABASE_URL=postgres://user:pass@localhost:5432/macro_research

# FRED API — free at https://fred.stlouisfed.org/docs/api/api_key.html
# Without a key, fixture data is used automatically.
FRED_API_KEY=

# CoinMarketCap — free at https://coinmarketcap.com/api/
# Without a key, fixture data is used automatically.
COINMARKETCAP_API_KEY=

# Anthropic — required for the research agent, quality scoring, and reports
ANTHROPIC_API_KEY=

# OpenHands — optional, enables autonomous platform expansion
# Get a key: https://app.all-hands.dev
OPENHANDS_API_KEY=
GITHUB_REPO=owner/repo

# x402 payment gating — optional, monetizes /api/feed with USDC micropayments
PAYMENT_ENABLED=false
X402_PAY_TO_ADDRESS=       # your wallet address receiving USDC
X402_PRICE_USDC_ATOMIC=100000  # 100000 = $0.10
X402_NETWORK=base-sepolia  # base | base-sepolia
```

Yahoo Finance, DeFiLlama, and Fear & Greed require no key.

**Zero-credential mode**: run with `--dry-run` and omit all API keys. FRED and CMC automatically serve fixture data; sectors fall back to fixture data if Yahoo Finance fails. The full pipeline runs and produces output with no credentials at all.

### Database setup

```bash
# Apply Drizzle migrations to your Postgres database
npx drizzle-kit migrate
```

---

## Usage

```bash
# Dry run — no DB writes, uses fixture data where keys are missing
npm run dry-run:all

# Sync live data to Postgres (macro + crypto)
npm run dev -- --mode all

# Run the Claude research agent (reads DB, writes + scores research note)
npm run agent

# Sync + agent in one command
npm run dev -- --mode all --agent

# Sync + long-form Claude report
npm run dev -- --mode all --report

# Run the Next.js dashboard locally
cd web && npm run dev
```

| Flag | Effect |
|------|--------|
| `--mode macro` | FRED + Yahoo Finance only |
| `--mode crypto` | CoinMarketCap + DeFiLlama + Fear & Greed only |
| `--mode all` | All five sources |
| `--agent` | Run autonomous Claude research agent after sync |
| `--report` | Generate long-form markdown investment report via Claude |
| `--dry-run` | Print transformed objects, skip DB writes |
| `--output-json` | Write pipeline output to `./output.json` |

---

## Error handling

All data sources fail gracefully. If FRED has no API key, fixture data is returned automatically. If Yahoo Finance is unreachable, sector fixture data is used. The pipeline always runs to completion.

```
[FRED] No API key — using fixture data.
[Yahoo Finance] ✓ Sector performance fetched (12/12 tickers)
[CMC] No API key — using fixture data.
[DeFiLlama] ✓ TVL: $90.5B
[FearGreed] ✓ Index: 8 (Extreme Fear)
```

---

## Project structure

```
src/
├── agent/
│   ├── loop.ts              Agentic loop — multi-turn Claude Opus 4.6 (18 max turns)
│   ├── scorer.ts            CryptoAnalystBench-style quality scorer (Claude Haiku)
│   └── tools.ts             7 tool definitions + execution functions
├── db/
│   ├── client.ts            Drizzle client factory
│   ├── schema.ts            Table definitions (6 tables)
│   └── sync.ts              Upsert orchestration
├── ingestion/
│   ├── fred.ts              FRED API client (fixture fallback when no key)
│   ├── fredRegistry.ts      Series definitions + macro driver linkages
│   ├── sectors.ts           Yahoo Finance sector ETF client (fixture fallback)
│   ├── coinmarketcap.ts     CoinMarketCap global metrics (fixture fallback)
│   ├── defillama.ts         DeFiLlama TVL (fixture fallback)
│   └── feargreed.ts         Alternative.me Fear & Greed Index (fixture fallback)
├── transforms/
│   ├── toOntologyObjects.ts FRED + sectors → MacroIndicator + SectorSnapshot
│   └── toCryptoObjects.ts   CMC + DeFi + FG → CryptoMetric + CategorySnapshot
├── report/
│   └── generate.ts          Long-form Claude research report generator
├── tests/
│   ├── e2e/                 Full pipeline integration tests (all sources mocked)
│   └── unit/                Unit tests per module (ingestion, transforms, agent, lib)
├── types/
│   └── index.ts             Shared TypeScript domain types
├── config.ts                Zod-validated environment config
└── index.ts                 CLI entry point

web/                         Next.js dashboard
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx       Sidebar nav (Overview, Sectors, Crypto, Research, Expansions, Sentient)
│   │   ├── page.tsx         Overview — macro regime + key indicators
│   │   ├── sectors/         Sector ETF performance heatmap
│   │   ├── crypto/          Crypto metrics + Fear & Greed
│   │   ├── research/        Research feed with conviction + quality badges
│   │   ├── expansions/      OpenHands autonomous engineering tasks
│   │   └── sentient/        Sentient Chat, quality score history, x402 status
│   └── api/
│       ├── run-pipeline/    POST — triggers pipeline sync
│       ├── run-agent/       POST — triggers research agent
│       ├── feed/            GET  — research feed (x402-gated when enabled)
│       └── assist/          POST — Sentient Chat SSE endpoint
├── components/              Shared UI components (charts, run buttons)
└── lib/
    ├── supabase.ts          Supabase client
    └── x402.ts             x402 protocol — payment requirements, 402 responses, header verification

drizzle/                     SQL migrations
trigger/                     Trigger.dev scheduled + event tasks
reports/                     Agent research notes (gitignored)
```

---

## Database schema

Six tables, all managed by Drizzle ORM:

| Table | Contents |
|-------|---------|
| `macro_indicators` | FRED series snapshots with signals + percentile rankings |
| `sector_snapshots` | Sector ETF performance snapshots |
| `crypto_metrics` | Crypto market metrics |
| `category_snapshots` | Crypto category breakdowns |
| `agent_findings` | Research notes with conviction scores, quality scores, and verification status |
| `openhands_tasks` | Autonomous engineering tasks dispatched to OpenHands |

The `agent_findings` table carries two quality columns added by migration `0003`:
- `quality_score` — overall 1-10 float (average of four dimensions)
- `quality_scores` — JSON text: `{ relevance, depth, temporalAccuracy, dataConsistency }`

---

## Tests

```bash
npm test          # run all tests (vitest)
npm run typecheck # TypeScript type checking
```

158 tests across 11 test files:
- **Ingestion**: fixture fallbacks, API response parsing, Yahoo Finance calculations
- **Transforms**: signal logic, regime inference, percentile rankings
- **Agent tools**: graceful fallbacks, tool schema correctness, disk writes
- **Scorer**: no-API-key fallback, QualityScores interface contract, input handling
- **x402**: isPaymentEnabled, payment requirements shape, 402 response format, header verification
- **E2E pipeline**: full macro + crypto pipeline with mocked HTTP

---

## Example agent output

Real run, 2026-02-24, `SLOWDOWN` regime, conviction `7/10`, quality `8.0/10`:

> **Hard/Soft Data Divergence Widens as Yield Curve Hits 52-Week Lows**
>
> Backward-looking hard data (GDP, IP, payrolls all at 100th percentile) remains robust,
> but Consumer Sentiment has collapsed 29% over 22 months and the 10Y-2Y spread has
> flattened 14bp in 3 weeks to its 52-week low. Core CPI at +0.295% MoM (~3.6% annualized)
> constrains the Fed's room to ease.
>
> Anomaly: XLF -7.65% YTD while HY spreads sit at 2.86% — credit markets complacent
> relative to the equity signal in financials.
>
> Ideas: LONG XLP, LONG XLRE, SHORT XLF, SHORT HYG
>
> Quality: relevance=8 · depth=7 · temporal=9 · consistency=8 · overall=8.0/10

---

## License

MIT
