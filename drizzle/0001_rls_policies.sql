-- Enable RLS on all tables
ALTER TABLE macro_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_companies ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all rows
CREATE POLICY "auth read macro_indicators" ON macro_indicators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read sector_snapshots" ON sector_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read crypto_metrics" ON crypto_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read category_snapshots" ON category_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read agent_findings" ON agent_findings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read watchlist_companies" ON watchlist_companies
  FOR SELECT TO authenticated USING (true);

-- Service role bypasses RLS entirely (used by the pipeline backend).
-- No additional policies needed — Supabase service_role has BYPASSRLS privilege.
