-- Add compound intelligence fields to agent_findings
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS conviction_score double precision;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'PENDING';
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS verified_at text;
ALTER TABLE agent_findings ADD COLUMN IF NOT EXISTS prior_call_accuracy double precision;

-- OpenHands task tracking: research agent → engineering agent
CREATE TABLE IF NOT EXISTS openhands_tasks (
  task_id                text PRIMARY KEY,
  requested_at           text NOT NULL,
  triggered_by_finding_id text,
  description            text NOT NULL,
  status                 text NOT NULL DEFAULT 'RUNNING',
  conversation_id        text,
  result                 text,
  completed_at           text
);

-- RLS
ALTER TABLE openhands_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read openhands_tasks"  ON openhands_tasks FOR SELECT TO anon        USING (true);
CREATE POLICY "auth read openhands_tasks"  ON openhands_tasks FOR SELECT TO authenticated USING (true);
