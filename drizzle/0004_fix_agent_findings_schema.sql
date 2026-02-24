-- Safety migration: ensure agent_findings exists with all required columns.
-- Uses CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS so it is safe
-- to run on both fresh databases and existing ones.

CREATE TABLE IF NOT EXISTS agent_findings (
  finding_id          TEXT PRIMARY KEY,
  run_at              TEXT NOT NULL,
  title               TEXT NOT NULL,
  macro_regime        TEXT NOT NULL,
  confidence          TEXT NOT NULL DEFAULT 'MEDIUM',
  conviction_score    DOUBLE PRECISION,
  summary             TEXT NOT NULL DEFAULT '',
  key_findings        TEXT NOT NULL DEFAULT '[]',
  anomalies           TEXT NOT NULL DEFAULT '[]',
  investment_ideas    TEXT NOT NULL DEFAULT '[]',
  verification_status TEXT DEFAULT 'PENDING',
  verified_at         TEXT,
  prior_call_accuracy DOUBLE PRECISION,
  quality_score       DOUBLE PRECISION,
  quality_scores      TEXT
);

-- Add any columns that may be missing on older installs
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS confidence          TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS conviction_score    DOUBLE PRECISION;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING';
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verified_at         TEXT;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS prior_call_accuracy DOUBLE PRECISION;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS quality_score       DOUBLE PRECISION;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS quality_scores      TEXT;
