"use client";

import { useState } from "react";

interface Props {
  label: string;
  endpoint: string;
  durationMs?: number;
  doneLabel?: string;
}

export function RunButton({ label, endpoint, durationMs = 120_000, doneLabel = "Done — refresh page" }: Props) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");

  async function handleClick() {
    if (status === "running") return;
    setStatus("running");
    await fetch(endpoint, { method: "POST" });
    setTimeout(() => setStatus("done"), durationMs);
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "running"}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        status === "running"
          ? "bg-yellow-400/10 text-yellow-400 cursor-not-allowed"
          : status === "done"
            ? "bg-green-400/10 text-green-400 hover:bg-green-400/20"
            : "bg-primary/10 text-primary hover:bg-primary/20"
      }`}
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        status === "running" ? "bg-yellow-400 animate-pulse" :
        status === "done" ? "bg-green-400" : "bg-primary"
      }`} />
      {status === "running" ? `Running…` : status === "done" ? doneLabel : label}
    </button>
  );
}
