-- Comprehensive repair migration.
-- Safe to run on any state — all statements are idempotent.

-- ── agent_findings ─────────────────────────────────────────────────────────
-- Ensure table exists with the minimum viable schema
CREATE TABLE IF NOT EXISTS agent_findings (
  finding_id          text PRIMARY KEY,
  run_at              text NOT NULL,
  title               text NOT NULL DEFAULT '',
  macro_regime        text NOT NULL DEFAULT 'SLOWDOWN',
  confidence          text NOT NULL DEFAULT 'MEDIUM',
  summary             text NOT NULL DEFAULT '',
  key_findings        text NOT NULL DEFAULT '[]',
  anomalies           text NOT NULL DEFAULT '[]',
  investment_ideas    text NOT NULL DEFAULT '[]'
);

-- Add every optional column that may be missing on older installs
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS conviction_score    double precision;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'PENDING';
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verified_at         text;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS prior_call_accuracy double precision;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS quality_score       double precision;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS quality_scores      text;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Enable RLS (safe if already enabled)
ALTER TABLE agent_findings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads so the dashboard (anon key) can display findings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_findings' AND policyname = 'anon read agent_findings'
  ) THEN
    EXECUTE 'CREATE POLICY "anon read agent_findings" ON agent_findings FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ── openhands_tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS openhands_tasks (
  task_id                  text PRIMARY KEY,
  requested_at             text NOT NULL,
  triggered_by_finding_id  text,
  description              text NOT NULL DEFAULT '',
  status                   text NOT NULL DEFAULT 'RUNNING',
  conversation_id          text,
  result                   text,
  completed_at             text
);

ALTER TABLE openhands_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'openhands_tasks' AND policyname = 'anon read openhands_tasks'
  ) THEN
    EXECUTE 'CREATE POLICY "anon read openhands_tasks" ON openhands_tasks FOR SELECT TO anon USING (true)';
  END IF;
END $$;
