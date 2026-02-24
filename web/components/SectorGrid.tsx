import type { SectorSnapshot } from "@pipeline/types/index.js";
import { SignalBadge } from "./SignalBadge";

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function SectorGrid({ sectors }: { sectors: SectorSnapshot[] }) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">
              Sector
            </th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
              YTD
            </th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
              vs SPY
            </th>
            <th className="text-center px-3 py-2 text-zinc-500 font-medium text-xs">
              Signal
            </th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s, i) => (
            <tr
              key={s.sectorTicker}
              className={i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/20"}
            >
              <td className="px-3 py-2">
                <div className="font-mono text-xs text-white font-medium">
                  {s.sectorTicker}
                </div>
                <div className="text-zinc-500 text-xs truncate max-w-[8rem]">
                  {s.sectorName}
                </div>
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                  (s.ytdChangePct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {fmtPct(s.ytdChangePct)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                  (s.relativeStrengthVsSPY ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {fmtPct(s.relativeStrengthVsSPY)}
              </td>
              <td className="px-3 py-2 text-center">
                <SignalBadge signal={s.sectorSignal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
