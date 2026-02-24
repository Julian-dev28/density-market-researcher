import type { MacroIndicator } from "../lib/types";
import { SignalBadge } from "./SignalBadge";

function fmtDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(3)}`;
}

function PercentileBar({ value }: { value: number | null }) {
  if (value === null) {
    return <div className="w-20 h-1.5 bg-zinc-800 rounded" />;
  }
  const pct = Math.round(value * 100);
  const color =
    pct > 70 ? "bg-red-500" : pct < 30 ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-zinc-800 rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-zinc-500 text-xs w-8 tabular-nums">{pct}th</span>
    </div>
  );
}

export function MacroTable({ indicators }: { indicators: MacroIndicator[] }) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">
              Series
            </th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
              Value
            </th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
              Δ
            </th>
            <th className="text-center px-3 py-2 text-zinc-500 font-medium text-xs">
              Signal
            </th>
            <th className="px-3 py-2 text-zinc-500 font-medium text-xs">52w</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <tr
              key={ind.seriesId}
              className={i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/20"}
            >
              <td className="px-3 py-2">
                <div className="font-mono text-xs text-white font-medium">
                  {ind.seriesId}
                </div>
                <div className="text-zinc-500 text-xs truncate max-w-[7rem]">
                  {ind.name}
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-white tabular-nums">
                {ind.latestValue.toFixed(2)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                  (ind.periodDelta ?? 0) > 0
                    ? "text-emerald-400"
                    : (ind.periodDelta ?? 0) < 0
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {fmtDelta(ind.periodDelta)}
              </td>
              <td className="px-3 py-2 text-center">
                <SignalBadge signal={ind.signal} />
              </td>
              <td className="px-3 py-2">
                <PercentileBar value={ind.yearPercentile} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
