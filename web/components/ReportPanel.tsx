"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PipelineOutput } from "../lib/pipeline";

export function ReportPanel({ data }: { data: PipelineOutput }) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setReport("");
    setError(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicators: data.indicators,
          sectors: data.sectors,
          cryptoMetrics: data.cryptoMetrics,
          categories: data.categories,
        }),
      });

      if (!res.ok) {
        setError((await res.text()) || `Error ${res.status}`);
        return;
      }
      if (!res.body) {
        setError("No response stream");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setReport((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-zinc-800/80 rounded overflow-hidden">
      {/* Panel header */}
      <div className="bg-zinc-900/70 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
            AI Research Report
          </span>
          <span className="text-zinc-800">·</span>
          <span className="text-[10px] font-mono text-zinc-700">
            Claude Opus 4.6 · macro + crypto synthesis · streams in real time
          </span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest rounded-sm bg-indigo-600/80 hover:bg-indigo-500/80 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors cursor-pointer disabled:cursor-not-allowed border border-indigo-500/40 disabled:border-zinc-700/50"
        >
          {loading ? (
            <>
              <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Report"
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="p-5 bg-[#07080a]">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-950/20 border border-red-900/40 rounded text-red-400 text-[11px] font-mono">
            ERROR: {error}
          </div>
        )}

        {report && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        )}

        {loading && !report && (
          <div className="text-zinc-700 text-[11px] font-mono text-center py-10 animate-pulse">
            ▋ generating...
          </div>
        )}

        {!report && !loading && !error && (
          <div className="text-zinc-700 text-[11px] font-mono text-center py-10">
            [ Click &ldquo;Generate Report&rdquo; to stream a full investment research report ]
          </div>
        )}
      </div>
    </div>
  );
}
