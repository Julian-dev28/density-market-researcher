import { createClient } from "@/lib/supabase/server";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400 bg-green-400/10",
  BEARISH: "text-red-400 bg-red-400/10",
  NEUTRAL: "text-yellow-400 bg-yellow-400/10",
};

const REGIME_COLORS: Record<string, string> = {
  EXPANSION: "text-green-400 bg-green-400/10 border-green-400/30",
  RECOVERY: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  SLOWDOWN: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  CONTRACTION: "text-red-400 bg-red-400/10 border-red-400/30",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "text-green-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-muted-foreground",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [indicatorsRes, findingsRes] = await Promise.all([
    supabase
      .from("macro_indicators")
      .select("*")
      .order("category")
      .order("series_id"),
    supabase
      .from("agent_findings")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(1),
  ]);

  const indicators = indicatorsRes.data ?? [];
  const latestFinding = findingsRes.data?.[0] ?? null;

  const regime = latestFinding?.macro_regime ?? "—";
  const confidence = latestFinding?.confidence ?? null;

  // Group indicators by category
  const byCategory: Record<string, typeof indicators> = {};
  for (const ind of indicators) {
    const cat = ind.category as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(ind);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live macro indicators and AI regime assessment
          </p>
        </div>
        {latestFinding && (
          <div className="text-right">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium ${REGIME_COLORS[regime] ?? "text-foreground bg-muted border-border"}`}
            >
              {regime}
            </div>
            {confidence && (
              <p className={`mt-1 text-xs ${CONFIDENCE_COLORS[confidence] ?? "text-muted-foreground"}`}>
                {confidence} confidence
              </p>
            )}
          </div>
        )}
      </div>

      {/* Latest finding summary */}
      {latestFinding && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{latestFinding.title}</h2>
            <span className="text-xs text-muted-foreground">
              {new Date(latestFinding.run_at as string).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{latestFinding.summary}</p>
        </div>
      )}

      {/* Indicators table by category */}
      {Object.entries(byCategory).map(([category, rows]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {category}
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Indicator
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Latest
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Δ Period
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">
                    52w %ile
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Signal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((ind) => {
                  const deltaColor =
                    (ind.period_delta_pct as number) > 0
                      ? "text-green-400"
                      : (ind.period_delta_pct as number) < 0
                        ? "text-red-400"
                        : "text-muted-foreground";
                  return (
                    <tr key={ind.series_id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground">
                        <div>{ind.name as string}</div>
                        <div className="text-xs text-muted-foreground">{ind.latest_date as string}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-mono">
                        {formatValue(ind.latest_value as number, ind.unit as string)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${deltaColor}`}>
                        {ind.period_delta_pct != null
                          ? `${(ind.period_delta_pct as number) > 0 ? "+" : ""}${(ind.period_delta_pct as number).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {ind.year_percentile != null
                          ? `${Math.round(ind.year_percentile as number)}th`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SIGNAL_COLORS[(ind.signal as string)?.toUpperCase()] ?? "text-muted-foreground bg-muted"}`}
                        >
                          {ind.signal as string}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {indicators.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No indicators yet. Run the pipeline to sync data.
        </div>
      )}
    </div>
  );
}

function formatValue(value: number, unit: string): string {
  if (unit === "%" || unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "index") return value.toFixed(1);
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}
