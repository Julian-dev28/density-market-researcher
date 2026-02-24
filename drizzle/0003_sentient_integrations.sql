-- =============================================================================
-- 0003_sentient_integrations.sql
--
-- Adds quality scoring to agent_findings.
-- Scores are derived by a Claude judge after each research note is written,
-- evaluating on four axes from the CryptoAnalystBench evaluation framework:
--   relevance, depth, temporal accuracy, data consistency.
-- =============================================================================

ALTER TABLE agent_findings
  ADD COLUMN IF NOT EXISTS quality_score double precision,
  ADD COLUMN IF NOT EXISTS quality_scores text; -- JSON: {relevance, depth, temporalAccuracy, dataConsistency}

-- RLS: anon can read quality scores (same policy as rest of agent_findings)
-- No new policy needed — existing SELECT policy on agent_findings covers new columns.

COMMENT ON COLUMN agent_findings.quality_score IS
  'Overall quality score 1-10 (average of 4 dimensions). Scored by Claude Haiku as judge after each run.';

COMMENT ON COLUMN agent_findings.quality_scores IS
  'JSON: {relevance, depth, temporalAccuracy, dataConsistency} each 1-10. CryptoAnalystBench-inspired.';
