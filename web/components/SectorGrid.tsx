import type { SectorSnapshot } from "../lib/types";
import { SignalBadge } from "./SignalBadge";

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

function PctCell({ val }: { val: number | null }) {
  const cls =
    val === null
      ? "text-zinc-600"
      : val > 0
      ? "text-green-400"
      : val < 0
      ? "text-red-400"
      : "text-zinc-500";
  return (
    <td className={`px-3 py-1.5 text-right font-mono text-xs tabular-nums whitespace-nowrap ${cls}`}>
      {fmtPct(val)}
    </td>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

export function SectorGrid({ sectors }: { sectors: SectorSnapshot[] }) {
  return (
    <div className="border border-zinc-800/80 rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/70 border-b border-zinc-800/80">
            <TH>Ticker</TH>
            <TH>Sector</TH>
            <TH right>1D</TH>
            <TH right>1M</TH>
            <TH right>YTD</TH>
            <TH right>vs SPY</TH>
            <TH>Sig</TH>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s, i) => (
            <tr
              key={s.sectorTicker}
              className={`border-b border-zinc-900 last:border-0 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 1 ? "bg-zinc-900/20" : ""
              }`}
            >
              <td className="px-3 py-1.5 font-mono font-semibold text-zinc-200">
                {s.sectorTicker}
              </td>
              <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">
                {s.sectorName}
              </td>
              <PctCell val={s.dayChangePct} />
              <PctCell val={s.monthChangePct} />
              <PctCell val={s.ytdChangePct} />
              <PctCell val={s.relativeStrengthVsSPY} />
              <td className="px-3 py-1.5">
                <SignalBadge signal={s.sectorSignal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
