import { createClient } from "@/lib/supabase/server";
import { ConvictionChart } from "@/components/charts/conviction-chart";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn } from "@/components/fade-in";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400",
  BEARISH: "text-red-400",
  NEUTRAL: "text-yellow-400",
};

const REGIME_COLORS: Record<string, string> = {
  EXPANSION:   "text-green-400 border-green-400/20",
  RECOVERY:    "text-blue-400 border-blue-400/20",
  SLOWDOWN:    "text-yellow-400 border-yellow-400/20",
  CONTRACTION: "text-red-400 border-red-400/20",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   "text-green-400",
  MEDIUM: "text-yellow-400",
  LOW:    "text-muted-foreground",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [indicatorsRes, findingsRes, allFindingsRes] = await Promise.all([
    supabase.from("macro_indicators").select("*").order("category").order("series_id"),
    supabase.from("agent_findings").select("*").order("run_at", { ascending: false }).limit(1),
    supabase.from("agent_findings")
      .select("finding_id,run_at,title,macro_regime,conviction_score,verification_status")
      .order("run_at", { ascending: true }).limit(30),
  ]);

  const indicators = indicatorsRes.data ?? [];
  const latestFinding = findingsRes.data?.[0] ?? null;
  const rawHistory = allFindingsRes.data ?? [];
  // Detect if all entries share the same calendar date — if so, show HH:MM instead
  const uniqueDays = new Set(rawHistory.map((f) => new Date(f.run_at as string).toDateString()));
  const sameDay = uniqueDays.size <= 1 && rawHistory.length > 0;
  const convictionHistory = rawHistory.map((f) => ({
    date: sameDay
      ? new Date(f.run_at as string).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : new Date(f.run_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    conviction: (f.conviction_score as number) ?? 0,
    regime: f.macro_regime as string,
    title: f.title as string,
    verification: f.verification_status as string | null,
  }));

  const regime = latestFinding?.macro_regime ?? "—";
  const confidence = latestFinding?.confidence ?? null;

  const byCategory: Record<string, typeof indicators> = {};
  for (const ind of indicators) {
    const cat = ind.category as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(ind);
  }

  return (
    <FadeIn className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Overview</h1>
          <p className="mt-1.5 text-xl font-semibold text-foreground">Macro Intelligence Dashboard</p>
        </div>
        {latestFinding && (
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-3 py-1 border text-xs font-mono tracking-widest uppercase ${REGIME_COLORS[regime] ?? "text-foreground border-border"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {regime}
            </div>
            {confidence && (
              <p className={`mt-1 text-[10px] font-mono tracking-wide ${CONFIDENCE_COLORS[confidence] ?? "text-muted-foreground"}`}>
                {confidence} confidence
              </p>
            )}
          </div>
        )}
      </div>

      {/* Latest finding */}
      {latestFinding && (
        <BracketCard label="LATEST FINDING" className="border border-border bg-card">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-foreground leading-snug">{latestFinding.title as string}</h2>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              {new Date(latestFinding.run_at as string).toLocaleDateString("en-US", {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{latestFinding.summary as string}</p>
        </BracketCard>
      )}

      {/* Conviction chart */}
      {convictionHistory.length >= 2 && (
        <BracketCard label="CONVICTION HISTORY" className="border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-mono text-muted-foreground/60 tracking-wide">
              dot color — green=confirmed · yellow=partial · red=wrong · dark=pending
            </p>
          </div>
          <ConvictionChart data={convictionHistory} />
        </BracketCard>
      )}

      {/* Indicators by category */}
      {Object.entries(byCategory).map(([category, rows], i) => (
        <FadeIn key={category} delay={i * 0.05}>
          <h3 className="text-[9px] font-mono tracking-[0.25em] text-muted-foreground/60 uppercase mb-3">
            {category}
          </h3>
          <div className="border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Indicator</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Latest</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Δ Period</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden md:table-cell">52w %ile</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((ind) => {
                  const delta = ind.period_delta_pct as number;
                  const deltaColor = delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted-foreground";
                  return (
                    <tr key={ind.series_id as string} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5 text-foreground">
                        <div className="text-sm">{ind.name as string}</div>
                        <div className="text-[10px] font-mono text-muted-foreground/50">{ind.latest_date as string}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right data-value text-foreground">
                        {formatValue(ind.latest_value as number, ind.unit as string)}
                      </td>
                      <td className={`px-4 py-2.5 text-right data-value ${deltaColor}`}>
                        {ind.period_delta_pct != null
                          ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right data-value text-muted-foreground hidden md:table-cell">
                        {ind.year_percentile != null ? `${Math.round(ind.year_percentile as number)}th` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-[10px] font-mono tracking-wide ${SIGNAL_COLORS[(ind.signal as string)?.toUpperCase()] ?? "text-muted-foreground"}`}>
                          {(ind.signal as string)?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      ))}

      {indicators.length === 0 && (
        <BracketCard className="border border-border bg-card p-12 text-center">
          <p className="text-sm font-mono text-muted-foreground">
            No indicators yet — run the pipeline to sync data.
          </p>
        </BracketCard>
      )}
    </FadeIn>
  );
}

function formatValue(value: number, unit: string): string {
  if (unit === "%" || unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "index") return value.toFixed(1);
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}
