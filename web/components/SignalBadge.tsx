import type { SignalDirection } from "../lib/types";

const STYLES: Record<SignalDirection, string> = {
  BULLISH: "bg-emerald-500/20 text-emerald-400",
  BEARISH: "bg-red-500/20 text-red-400",
  NEUTRAL: "bg-zinc-700/50 text-zinc-400",
};

export function SignalBadge({ signal }: { signal: SignalDirection }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STYLES[signal]}`}>
      {signal}
    </span>
  );
}
