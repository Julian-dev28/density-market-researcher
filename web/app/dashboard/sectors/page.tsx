import { createClient } from "@/lib/supabase/server";
import { SectorBarChart } from "@/components/charts/sector-bar";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn } from "@/components/fade-in";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400",
  BEARISH: "text-red-400",
  NEUTRAL: "text-yellow-400",
};

export default async function SectorsPage() {
  const supabase = await createClient();

  const { data: allSnapshots } = await supabase
    .from("sector_snapshots")
    .select("*")
    .order("date", { ascending: false });

  const seen = new Set<string>();
  const snapshots = (allSnapshots ?? []).filter((s) => {
    if (seen.has(s.sector_ticker as string)) return false;
    seen.add(s.sector_ticker as string);
    return true;
  });

  const sorted = [...snapshots].sort(
    (a, b) => ((b.day_change_pct as number) ?? 0) - ((a.day_change_pct as number) ?? 0)
  );

  const chartData = sorted.map((s) => ({
    name: (s.sector_ticker as string).replace("XL", ""),
    fullName: s.sector_name as string,
    dayChange: (s.day_change_pct as number) ?? 0,
    weekChange: (s.week_change_pct as number) ?? 0,
    monthChange: (s.month_change_pct as number) ?? 0,
    ytdChange: (s.ytd_change_pct as number) ?? 0,
  }));

  return (
    <FadeIn className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Sectors</h1>
        <p className="mt-1.5 text-xl font-semibold text-foreground">S&P 500 Sector Performance</p>
      </div>

      {chartData.length > 0 ? (
        <>
          <BracketCard label="DAY CHANGE %" className="border border-border bg-card">
            <SectorBarChart data={chartData} />
          </BracketCard>

          <div className="border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Sector</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Day</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden sm:table-cell">Week</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden md:table-cell">Month</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden lg:table-cell">YTD</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase hidden lg:table-cell">vs SPY</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/60 uppercase">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((s) => (
                  <tr key={s.snapshot_id as string} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs text-accent">{s.sector_ticker as string}</div>
                      <div className="text-xs text-muted-foreground">{s.sector_name as string}</div>
                    </td>
                    <PctCell value={s.day_change_pct as number} />
                    <PctCell value={s.week_change_pct as number} className="hidden sm:table-cell" />
                    <PctCell value={s.month_change_pct as number} className="hidden md:table-cell" />
                    <PctCell value={s.ytd_change_pct as number} className="hidden lg:table-cell" />
                    <PctCell value={s.relative_strength_vs_spy as number} className="hidden lg:table-cell" />
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[10px] font-mono tracking-wide ${SIGNAL_COLORS[(s.sector_signal as string)?.toUpperCase()] ?? "text-muted-foreground"}`}>
                        {(s.sector_signal as string)?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <BracketCard className="border border-border bg-card p-12 text-center">
          <p className="text-sm font-mono text-muted-foreground">No sector data yet — run the pipeline.</p>
        </BracketCard>
      )}
    </FadeIn>
  );
}

function PctCell({ value, className = "" }: { value: number | null; className?: string }) {
  const color = value == null ? "text-muted-foreground" : value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-muted-foreground";
  return (
    <td className={`px-4 py-2.5 text-right data-value ${color} ${className}`}>
      {value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}
    </td>
  );
}
