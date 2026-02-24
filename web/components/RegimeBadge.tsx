import type { Regime, CryptoRegime } from "../lib/types";

type AnyRegime = Regime | CryptoRegime | null | undefined;

const cfg: Record<string, string> = {
  EXPANSION:   "text-green-400 border-green-900/50 bg-green-950/30",
  RECOVERY:    "text-blue-400 border-blue-900/50 bg-blue-950/30",
  SLOWDOWN:    "text-amber-400 border-amber-900/50 bg-amber-950/30",
  CONTRACTION: "text-red-400 border-red-900/50 bg-red-950/30",
  BULL_MARKET: "text-green-400 border-green-900/50 bg-green-950/30",
  ALT_SEASON:  "text-purple-400 border-purple-900/50 bg-purple-950/30",
  RISK_OFF:    "text-amber-400 border-amber-900/50 bg-amber-950/30",
  BEAR_MARKET: "text-red-400 border-red-900/50 bg-red-950/30",
};

export function RegimeBadge({ regime }: { regime: AnyRegime }) {
  if (!regime) return null;
  const cls = cfg[regime] ?? "text-zinc-400 border-zinc-700/40 bg-zinc-800/30";
  return (
    <span
      className={`inline-block px-2 py-px text-[9px] font-mono font-semibold tracking-widest uppercase border rounded-sm ${cls}`}
    >
      {regime.replace(/_/g, " ")}
    </span>
  );
}
