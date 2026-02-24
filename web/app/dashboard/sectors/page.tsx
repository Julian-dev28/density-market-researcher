import { createClient } from "@/lib/supabase/server";
import { SectorBarChart } from "@/components/charts/sector-bar";

const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400 bg-green-400/10",
  BEARISH: "text-red-400 bg-red-400/10",
  NEUTRAL: "text-yellow-400 bg-yellow-400/10",
};

export default async function SectorsPage() {
  const supabase = await createClient();

  // Get latest snapshot per sector (max date per sector_ticker)
  const { data: allSnapshots } = await supabase
    .from("sector_snapshots")
    .select("*")
    .order("date", { ascending: false });

  // Deduplicate: keep latest per sector
  const seen = new Set<string>();
  const snapshots = (allSnapshots ?? []).filter((s) => {
    if (seen.has(s.sector_ticker as string)) return false;
    seen.add(s.sector_ticker as string);
    return true;
  });

  // Sort by day change for chart
  const sorted = [...snapshots].sort(
    (a, b) => ((b.day_change_pct as number) ?? 0) - ((a.day_change_pct as number) ?? 0)
  );

  const chartData = sorted.map((s) => ({
    name: (s.sector_ticker as string).replace("XL", ""),
    fullName: s.sector_name as string,
    dayChange: s.day_change_pct as number ?? 0,
    weekChange: s.week_change_pct as number ?? 0,
    monthChange: s.month_change_pct as number ?? 0,
    ytdChange: s.ytd_change_pct as number ?? 0,
  }));

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sectors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          S&P 500 sector performance vs. macro regime
        </p>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-6">Day Change (%)</h2>
            <SectorBarChart data={chartData} />
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sector</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Day</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Week</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Month</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">YTD</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">vs SPY</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((s) => (
                  <tr key={s.snapshot_id as string} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.sector_ticker as string}</div>
                      <div className="text-xs text-muted-foreground">{s.sector_name as string}</div>
                    </td>
                    <PctCell value={s.day_change_pct as number} />
                    <PctCell value={s.week_change_pct as number} className="hidden sm:table-cell" />
                    <PctCell value={s.month_change_pct as number} className="hidden md:table-cell" />
                    <PctCell value={s.ytd_change_pct as number} className="hidden lg:table-cell" />
                    <PctCell value={s.relative_strength_vs_spy as number} className="hidden lg:table-cell" />
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SIGNAL_COLORS[(s.sector_signal as string)?.toUpperCase()] ?? "text-muted-foreground bg-muted"}`}>
                        {s.sector_signal as string}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No sector data yet. Run the pipeline to sync data.
        </div>
      )}
    </div>
  );
}

function PctCell({ value, className = "" }: { value: number | null; className?: string }) {
  const color =
    value == null ? "text-muted-foreground" : value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-muted-foreground";
  return (
    <td className={`px-4 py-3 text-right font-mono text-sm ${color} ${className}`}>
      {value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}
    </td>
  );
}
