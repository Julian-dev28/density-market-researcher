import { createClient } from "@/lib/supabase/server";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/fade-in";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400",
  BEARISH: "text-red-400",
  NEUTRAL: "text-yellow-400",
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
    supabase.from("category_snapshots").select("*").order("ingested_at", { ascending: false }),
  ]);

  const metrics = metricsRes.data ?? [];

  const seen = new Set<string>();
  const categories = (catsRes.data ?? []).filter((c) => {
    if (seen.has(c.category_slug as string)) return false;
    seen.add(c.category_slug as string);
    return true;
  });

  const byCategory: Record<string, typeof metrics> = {};
  for (const m of metrics) {
    const cat = m.category as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  }

  return (
    <FadeIn className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Crypto</h1>
        <p className="mt-1.5 text-xl font-semibold text-foreground">On-Chain Metrics & Market Structure</p>
      </div>

      {Object.entries(byCategory).map(([category, rows], ci) => (
        <div key={category}>
          <h3 className="text-[9px] font-mono tracking-[0.25em] text-muted-foreground/60 uppercase mb-3">
            {category}
          </h3>
          <FadeInStagger className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" baseDelay={ci * 0.05}>
            {rows.map((m) => {
              const delta = m.period_delta_pct as number | null;
              const deltaColor = delta == null ? "text-muted-foreground" : delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
              return (
                <FadeInItem key={m.metric_id as string}>
                  <BracketCard className="border border-border bg-card h-full space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground leading-tight">{m.name as string}</p>
                      <span className={`shrink-0 text-[10px] font-mono tracking-wide ${SIGNAL_COLORS[(m.signal as string)?.toUpperCase()] ?? "text-muted-foreground"}`}>
                        {(m.signal as string)?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-2xl font-semibold text-foreground data-value">
                      {fmt(m.latest_value as number, m.unit as string)}
                    </p>
                    {delta != null && (
                      <p className={`text-[10px] font-mono ${deltaColor}`}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(2)}% vs prior
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground leading-tight line-clamp-2">
                      {m.signal_rationale as string}
                    </p>
                  </BracketCard>
                </FadeInItem>
              );
            })}
          </FadeInStagger>
        </div>
      ))}

      {categories.length > 0 && (
        <FadeIn delay={0.2}>
          <h3 className="text-[9px] font-mono tracking-[0.25em] text-muted-foreground/60 uppercase mb-3">
            Categories
          </h3>
          <div className="border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Category</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Market Cap</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Day Δ</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden md:table-cell">Dominance</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => {
                  const day = c.day_change_pct as number | null;
                  const dayColor = day == null ? "text-muted-foreground" : day > 0 ? "text-green-400" : day < 0 ? "text-red-400" : "text-muted-foreground";
                  return (
                    <tr key={c.snapshot_id as string} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5 text-foreground text-sm">{c.category_name as string}</td>
                      <td className="px-4 py-2.5 text-right data-value text-foreground">
                        {c.total_market_cap_usd ? fmt(c.total_market_cap_usd as number, "usd") : "—"}
                      </td>
                      <td className={`px-4 py-2.5 text-right data-value ${dayColor}`}>
                        {day == null ? "—" : `${day > 0 ? "+" : ""}${day.toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-2.5 text-right data-value text-muted-foreground hidden md:table-cell">
                        {c.dominance_pct ? `${(c.dominance_pct as number).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-[10px] font-mono tracking-wide ${SIGNAL_COLORS[(c.category_signal as string)?.toUpperCase()] ?? "text-muted-foreground"}`}>
                          {(c.category_signal as string)?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      {metrics.length === 0 && categories.length === 0 && (
        <BracketCard className="border border-border bg-card p-12 text-center">
          <p className="text-sm font-mono text-muted-foreground">No crypto data yet — run the pipeline.</p>
        </BracketCard>
      )}
    </FadeIn>
  );
}
