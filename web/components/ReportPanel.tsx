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
        const text = await res.text();
        setError(text || `Error ${res.status}`);
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
    <div className="border border-zinc-800 rounded-xl bg-zinc-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            AI Research Report
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Claude Opus 4.6 · macro + crypto synthesis · streams in real time
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            "Generate Report"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {report && (
        <div className="prose prose-invert prose-sm max-w-none border-t border-zinc-800 pt-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="text-zinc-600 text-sm text-center py-8 border-t border-zinc-800">
          Click &ldquo;Generate Report&rdquo; to stream a full investment
          research report from Claude Opus 4.6.
        </div>
      )}
    </div>
  );
}
