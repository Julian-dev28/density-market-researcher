"use client";

import { useEffect, useState, useCallback } from "react";
import { BracketCard } from "@/components/bracket-card";
import type { BtcPrediction } from "@/app/api/btc-predict/route";

const DIR = {
  BULLISH:  { text: "text-[#3d6e4f]", bg: "bg-[#3d6e4f]/10", border: "border-[#3d6e4f]/30", icon: "▲" },
  BEARISH:  { text: "text-[#b84455]", bg: "bg-[#b84455]/10", border: "border-[#b84455]/30", icon: "▼" },
  SIDEWAYS: { text: "text-[#b07a2a]", bg: "bg-[#b07a2a]/10", border: "border-[#b07a2a]/30", icon: "–" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function BtcPredictionPanel() {
  const [data, setData]       = useState<BtcPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const predict = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/btc-predict");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + refresh every 15 minutes
  useEffect(() => {
    predict();
    const t = setInterval(predict, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [predict]);

  const c = data ? DIR[data.direction] : DIR.SIDEWAYS;

  return (
    <BracketCard label="BTC · 15-MIN PREDICTION" className="border border-border bg-card">

      {/* Loading state (no prior data) */}
      {loading && !data && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <span className="text-xs font-mono text-muted-foreground">claude is thinking</span>
          <span className="cursor-blink text-accent font-mono">_</span>
        </div>
      )}

      {/* Error state */}
      {error && !data && (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-mono text-red-400">{error}</p>
          <button onClick={predict} className="text-[10px] font-mono text-accent hover:text-foreground transition-colors">
            › retry
          </button>
        </div>
      )}

      {/* Prediction */}
      {data && (
        <div className="space-y-4">

          {/* Direction + confidence */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-mono tracking-widest uppercase ${c.text} ${c.bg} ${c.border}`}>
                <span>{c.icon}</span>
                <span>{data.direction}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/50">
                {timeStr(data.predictedAt)} → expires {timeStr(data.expiresAt)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-3xl font-semibold data-value leading-none ${c.text}`}>
                {data.confidence}<span className="text-lg">%</span>
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">confidence</p>
            </div>
          </div>

          {/* Price targets */}
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-border px-3 py-2 text-center">
              <p className="text-[9px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase mb-1">Now</p>
              <p className="text-sm font-semibold data-value text-foreground">${fmt(data.currentPrice)}</p>
            </div>
            <div className={`border px-3 py-2 text-center ${c.border}`}>
              <p className="text-[9px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase mb-1">Low</p>
              <p className={`text-sm font-semibold data-value ${c.text}`}>${fmt(data.targetRange.low)}</p>
            </div>
            <div className={`border px-3 py-2 text-center ${c.border}`}>
              <p className="text-[9px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase mb-1">High</p>
              <p className={`text-sm font-semibold data-value ${c.text}`}>${fmt(data.targetRange.high)}</p>
            </div>
          </div>

          {/* Signals */}
          {data.signals.length > 0 && (
            <ul className="space-y-1">
              {data.signals.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="text-accent shrink-0 mt-px">›</span>
                  <span className="text-foreground">{s}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Rationale */}
          {data.rationale && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-accent/30 pl-3 py-0.5">
              {data.rationale}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/50 pt-2">
            <p className="text-[9px] font-mono text-muted-foreground/30 tracking-wide">
              claude-sonnet-4-6 · kraken 15m ohlcv
            </p>
            <button
              onClick={predict}
              disabled={loading}
              className="text-[10px] font-mono text-accent hover:text-foreground transition-colors disabled:opacity-40"
            >
              {loading ? <span>thinking<span className="cursor-blink">_</span></span> : "› refresh"}
            </button>
          </div>
        </div>
      )}

    </BracketCard>
  );
}
