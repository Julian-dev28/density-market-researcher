import { createClient } from "@/lib/supabase/server";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400 bg-green-400/10",
  BEARISH: "text-red-400 bg-red-400/10",
  NEUTRAL: "text-yellow-400 bg-yellow-400/10",
};

function fmt(v: number, unit: string): string {
  if (unit === "%" || unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "score" || unit === "index") return v.toFixed(0);
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `$${v.toLocaleString()}`;
  return v.toFixed(2);
}

export default async function CryptoPage() {
  const supabase = await createClient();

  const [metricsRes, catsRes] = await Promise.all([
    supabase.from("crypto_metrics").select("*").order("category").order("name"),
    supabase
      .from("category_snapshots")
      .select("*")
      .order("ingested_at", { ascending: false }),
  ]);

  const metrics = metricsRes.data ?? [];

  // Deduplicate category snapshots: latest per category
  const seen = new Set<string>();
  const categories = (catsRes.data ?? []).filter((c) => {
    if (seen.has(c.category_slug as string)) return false;
    seen.add(c.category_slug as string);
    return true;
  });

  // Group metrics by category
  const byCategory: Record<string, typeof metrics> = {};
  for (const m of metrics) {
    const cat = m.category as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Crypto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          On-chain metrics, market structure, and category performance
        </p>
      </div>

      {/* Metrics by category */}
      {Object.entries(byCategory).map(([category, rows]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {category}
          </h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => {
              const delta = m.period_delta_pct as number | null;
              const deltaColor =
                delta == null ? "text-muted-foreground" : delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
              return (
                <div
                  key={m.metric_id as string}
                  className="rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground leading-tight">{m.name as string}</p>
                    <span
                      className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${SIGNAL_COLORS[(m.signal as string)?.toUpperCase()] ?? "text-muted-foreground bg-muted"}`}
                    >
                      {m.signal as string}
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-foreground font-mono">
                    {fmt(m.latest_value as number, m.unit as string)}
                  </p>
                  {delta != null && (
                    <p className={`text-xs font-mono ${deltaColor}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(2)}% vs prior
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
                    {m.signal_rationale as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Category snapshots */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Categories
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Market Cap</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Day Δ</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Dominance</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => {
                  const day = c.day_change_pct as number | null;
                  const dayColor = day == null ? "text-muted-foreground" : day > 0 ? "text-green-400" : day < 0 ? "text-red-400" : "text-muted-foreground";
                  return (
                    <tr key={c.snapshot_id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-foreground">{c.category_name as string}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {c.total_market_cap_usd ? fmt(c.total_market_cap_usd as number, "usd") : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${dayColor}`}>
                        {day == null ? "—" : `${day > 0 ? "+" : ""}${day.toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {c.dominance_pct ? `${(c.dominance_pct as number).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SIGNAL_COLORS[(c.category_signal as string)?.toUpperCase()] ?? "text-muted-foreground bg-muted"}`}>
                          {c.category_signal as string}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metrics.length === 0 && categories.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No crypto data yet. Run the pipeline to sync data.
        </div>
      )}
    </div>
  );
}
