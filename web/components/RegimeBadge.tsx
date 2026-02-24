import type { Regime, CryptoRegime } from "@pipeline/types/index.js";

type AnyRegime = Regime | CryptoRegime | null | undefined;

const STYLES: Record<string, string> = {
  EXPANSION: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  RECOVERY: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  SLOWDOWN: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  CONTRACTION: "bg-red-500/20 text-red-400 border border-red-500/30",
  BULL_MARKET: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  ALT_SEASON: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  RISK_OFF: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  BEAR_MARKET: "bg-red-500/20 text-red-400 border border-red-500/30",
};

export function RegimeBadge({ regime }: { regime: AnyRegime }) {
  if (!regime) return null;
  const styles = STYLES[regime] ?? "bg-zinc-700/50 text-zinc-300 border border-zinc-600";
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${styles}`}
    >
      {regime.replace(/_/g, " ")}
    </span>
  );
}
