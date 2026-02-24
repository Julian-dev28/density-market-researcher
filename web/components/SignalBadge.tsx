import type { SignalDirection } from "../lib/types";

const cfg: Record<SignalDirection, { label: string; cls: string }> = {
  BULLISH: {
    label: "BULL",
    cls: "text-green-400 bg-green-950/40 border border-green-900/60",
  },
  BEARISH: {
    label: "BEAR",
    cls: "text-red-400 bg-red-950/40 border border-red-900/60",
  },
  NEUTRAL: {
    label: "NEU",
    cls: "text-zinc-500 bg-zinc-800/40 border border-zinc-700/40",
  },
};

export function SignalBadge({ signal }: { signal: SignalDirection }) {
  const { label, cls } = cfg[signal];
  return (
    <span
      className={`inline-block px-1.5 py-px text-[9px] font-mono font-semibold tracking-widest rounded-sm ${cls}`}
    >
      {label}
    </span>
  );
}
