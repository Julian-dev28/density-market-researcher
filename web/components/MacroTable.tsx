import type { MacroIndicator } from "../lib/types";
import { SignalBadge } from "./SignalBadge";

function fmtValue(v: number): string {
  if (v >= 10_000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  const abs = Math.abs(delta);
  if (abs >= 10_000) return `${sign}${delta.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 100) return `${sign}${delta.toFixed(1)}`;
  return `${sign}${delta.toFixed(2)}`;
}

function PctileBar({ value }: { value: number | null }) {
  if (value === null) {
    return <div className="w-16 h-[3px] bg-zinc-800 rounded-sm" />;
  }
  const pct = Math.round(value * 100);
  const color =
    pct > 70 ? "bg-red-500" : pct < 30 ? "bg-green-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-[3px] bg-zinc-800 rounded-sm overflow-hidden">
        <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[9px] text-zinc-600 w-5 text-right tabular-nums">
        {pct}
      </span>
    </div>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

export function MacroTable({ indicators }: { indicators: MacroIndicator[] }) {
  return (
    <div className="border border-zinc-800/80 rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/70 border-b border-zinc-800/80">
            <TH>Series</TH>
            <TH>Name</TH>
            <TH right>Value</TH>
            <TH>Unit</TH>
            <TH right>Δ Period</TH>
            <TH right>Date</TH>
            <TH>52W %ile</TH>
            <TH>Sig</TH>
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <tr
              key={ind.seriesId}
              className={`border-b border-zinc-900 last:border-0 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 1 ? "bg-zinc-900/20" : ""
              }`}
            >
              {/* Series ID */}
              <td className="px-3 py-1.5 font-mono font-semibold text-zinc-200 whitespace-nowrap">
                {ind.seriesId}
              </td>
              {/* Name */}
              <td className="px-3 py-1.5 text-zinc-400 max-w-[200px]">
                <span className="block truncate" title={ind.name}>
                  {ind.name}
                </span>
              </td>
              {/* Value */}
              <td className="px-3 py-1.5 text-right font-mono text-white font-medium tabular-nums whitespace-nowrap">
                {fmtValue(ind.latestValue)}
              </td>
              {/* Unit */}
              <td className="px-3 py-1.5 text-zinc-600 text-[10px] max-w-[90px]">
                <span className="block truncate">{ind.unit}</span>
              </td>
              {/* Delta */}
              <td
                className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap ${
                  (ind.periodDelta ?? 0) > 0
                    ? "text-green-400"
                    : (ind.periodDelta ?? 0) < 0
                    ? "text-red-400"
                    : "text-zinc-600"
                }`}
              >
                {fmtDelta(ind.periodDelta)}
              </td>
              {/* Date */}
              <td className="px-3 py-1.5 text-right font-mono text-zinc-600 tabular-nums whitespace-nowrap text-[10px]">
                {ind.latestDate}
              </td>
              {/* 52w percentile bar */}
              <td className="px-3 py-1.5">
                <PctileBar value={ind.yearPercentile} />
              </td>
              {/* Signal */}
              <td className="px-3 py-1.5">
                <SignalBadge signal={ind.signal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
