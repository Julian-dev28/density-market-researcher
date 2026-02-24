import type { CryptoMetric, CategorySnapshot } from "../lib/types";
import { SignalBadge } from "./SignalBadge";

function fmtValue(m: CryptoMetric): string {
  if (m.unit === "USD") {
    const v = m.latestValue;
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    return `$${v.toFixed(0)}`;
  }
  if (m.unit === "%") return `${m.latestValue.toFixed(1)}%`;
  if (m.unit === "index (0-100)") return m.latestValue.toFixed(0);
  return m.latestValue.toFixed(2);
}

function fmtDeltaPct(val: number | null): string {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);

const SubHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60">
    <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600">
      {children}
    </span>
  </div>
);

export function CryptoPanel({
  metrics,
  categories,
}: {
  metrics: CryptoMetric[];
  categories: CategorySnapshot[];
}) {
  return (
    <div className="space-y-px border border-zinc-800/80 rounded overflow-hidden">
      {/* ── Metrics ── */}
      <SubHeader>On-Chain Metrics</SubHeader>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/40 border-b border-zinc-800/60">
            <TH>Metric</TH>
            <TH right>Value</TH>
            <TH right>Δ%</TH>
            <TH>Sig</TH>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr
              key={m.metricId}
              className={`border-b border-zinc-900 last:border-0 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 1 ? "bg-zinc-900/20" : ""
              }`}
            >
              <td className="px-3 py-1.5 text-zinc-300">{m.name}</td>
              <td className="px-3 py-1.5 text-right font-mono text-white font-medium tabular-nums whitespace-nowrap">
                {fmtValue(m)}
              </td>
              <td
                className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap ${
                  (m.periodDeltaPct ?? 0) > 0
                    ? "text-green-400"
                    : (m.periodDeltaPct ?? 0) < 0
                    ? "text-red-400"
                    : "text-zinc-600"
                }`}
              >
                {fmtDeltaPct(m.periodDeltaPct)}
              </td>
              <td className="px-3 py-1.5">
                <SignalBadge signal={m.signal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Categories ── */}
      <SubHeader>Market Categories</SubHeader>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/40 border-b border-zinc-800/60">
            <TH>Category</TH>
            <TH right>Mkt Cap</TH>
            <TH right>Dom%</TH>
            <TH>Sig</TH>
          </tr>
        </thead>
        <tbody>
          {categories.map((c, i) => (
            <tr
              key={c.categorySlug}
              className={`border-b border-zinc-900 last:border-0 hover:bg-white/[0.02] transition-colors ${
                i % 2 === 1 ? "bg-zinc-900/20" : ""
              }`}
            >
              <td className="px-3 py-1.5 text-zinc-300">{c.categoryName}</td>
              <td className="px-3 py-1.5 text-right font-mono text-white tabular-nums whitespace-nowrap">
                {c.totalMarketCapUsd
                  ? `$${(c.totalMarketCapUsd / 1e9).toFixed(0)}B`
                  : "—"}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-zinc-400 tabular-nums">
                {c.dominancePct?.toFixed(1)}%
              </td>
              <td className="px-3 py-1.5">
                <SignalBadge signal={c.categorySignal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
