"use client";

import { useState } from "react";

interface Props {
  label: string;
  endpoint: string;
  durationMs?: number;
  doneLabel?: string;
}

export function RunButton({ label, endpoint, durationMs = 120_000, doneLabel = "done" }: Props) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  async function handleClick() {
    if (status === "running") return;
    setStatus("running");
    try {
      await fetch(endpoint, { method: "POST" });
    } catch {
      setStatus("idle");
      return;
    }
    setTimeout(() => setStatus("done"), durationMs);
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "running"}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs font-mono tracking-wide transition-colors text-left ${
        status === "running"
          ? "text-yellow-400 cursor-not-allowed"
          : status === "done"
            ? "text-green-400 hover:text-green-300"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-accent shrink-0">›</span>
      {status === "running" ? (
        <span className="flex items-center gap-1">
          {label}
          <span className="cursor-blink text-yellow-400">_</span>
        </span>
      ) : status === "done" ? (
        <span>{doneLabel} <span className="text-green-400">✓</span></span>
      ) : (
        label
      )}
    </button>
  );
}
