import type { CryptoMetric, CategorySnapshot } from "../lib/types";
import { SignalBadge } from "./SignalBadge";

function fmtValue(m: CryptoMetric): string {
  if (m.unit === "USD") return `$${(m.latestValue / 1e9).toFixed(1)}B`;
  if (m.unit === "%") return `${m.latestValue.toFixed(1)}%`;
  if (m.unit === "index (0-100)") return m.latestValue.toFixed(0);
  return m.latestValue.toFixed(2);
}

function fmtDeltaPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function CryptoPanel({
  metrics,
  categories,
}: {
  metrics: CryptoMetric[];
  categories: CategorySnapshot[];
}) {
  return (
    <div className="space-y-3">
      {/* Metrics table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">
                Metric
              </th>
              <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
                Value
              </th>
              <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
                Δ%
              </th>
              <th className="text-center px-3 py-2 text-zinc-500 font-medium text-xs">
                Signal
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.metricId}
                className={i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/20"}
              >
                <td className="px-3 py-2 text-zinc-300 text-xs leading-tight">
                  {m.name}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-white tabular-nums">
                  {fmtValue(m)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                    (m.periodDeltaPct ?? 0) > 0
                      ? "text-emerald-400"
                      : (m.periodDeltaPct ?? 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {fmtDeltaPct(m.periodDeltaPct)}
                </td>
                <td className="px-3 py-2 text-center">
                  <SignalBadge signal={m.signal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Categories table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-3 py-2 text-zinc-500 font-medium text-xs">
                Category
              </th>
              <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
                Mkt Cap
              </th>
              <th className="text-right px-3 py-2 text-zinc-500 font-medium text-xs">
                Dom%
              </th>
              <th className="text-center px-3 py-2 text-zinc-500 font-medium text-xs">
                Signal
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr
                key={c.categorySlug}
                className={i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/20"}
              >
                <td className="px-3 py-2 text-zinc-300 text-xs">
                  {c.categoryName}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-white tabular-nums">
                  {c.totalMarketCapUsd
                    ? `$${(c.totalMarketCapUsd / 1e9).toFixed(0)}B`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">
                  {c.dominancePct?.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-center">
                  <SignalBadge signal={c.categorySignal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
