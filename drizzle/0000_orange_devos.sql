CREATE TABLE "agent_findings" (
	"finding_id" text PRIMARY KEY NOT NULL,
	"run_at" text NOT NULL,
	"title" text NOT NULL,
	"macro_regime" text NOT NULL,
	"confidence" text NOT NULL,
	"summary" text NOT NULL,
	"key_findings" text NOT NULL,
	"anomalies" text NOT NULL,
	"investment_ideas" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"category_name" text NOT NULL,
	"category_slug" text NOT NULL,
	"total_market_cap_usd" double precision,
	"day_change_pct" double precision,
	"dominance_pct" double precision,
	"crypto_regime" text,
	"primary_metric_drivers" text NOT NULL,
	"category_signal" text NOT NULL,
	"signal_rationale" text NOT NULL,
	"ingested_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_metrics" (
	"metric_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"unit" text NOT NULL,
	"latest_value" double precision NOT NULL,
	"latest_date" text NOT NULL,
	"prior_value" double precision,
	"period_delta" double precision,
	"period_delta_pct" double precision,
	"signal" text NOT NULL,
	"signal_rationale" text NOT NULL,
	"last_updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_indicators" (
	"series_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"latest_value" double precision NOT NULL,
	"latest_date" text NOT NULL,
	"unit" text NOT NULL,
	"prior_value" double precision,
	"prior_date" text,
	"period_delta" double precision,
	"period_delta_pct" double precision,
	"year_low" double precision,
	"year_high" double precision,
	"year_percentile" double precision,
	"signal" text NOT NULL,
	"signal_rationale" text NOT NULL,
	"frequency" text NOT NULL,
	"last_updated" text NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sector_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"sector_ticker" text NOT NULL,
	"sector_name" text NOT NULL,
	"date" text NOT NULL,
	"day_change_pct" double precision,
	"week_change_pct" double precision,
	"month_change_pct" double precision,
	"ytd_change_pct" double precision,
	"relative_strength_vs_spy" double precision,
	"macro_regime" text,
	"primary_macro_drivers" text NOT NULL,
	"sector_signal" text NOT NULL,
	"signal_rationale" text NOT NULL,
	"ingested_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_companies" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector_ticker" text NOT NULL,
	"sub_industry" text,
	"market_cap_bn" double precision,
	"rate_sensitivity" double precision,
	"inflation_sensitivity" double precision,
	"usd_sensitivity" double precision,
	"analyst_notes" text,
	"added_at" text NOT NULL,
	"last_reviewed_at" text
);
