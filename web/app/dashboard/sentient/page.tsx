import { createClient } from "@/lib/supabase/server";

export default async function SentientPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_findings")
    .select("quality_score, quality_scores, conviction_score, run_at")
    .not("quality_score", "is", null)
    .order("run_at", { ascending: false })
    .limit(10);

  const scored = data ?? [];

  const avgQuality =
    scored.length > 0
      ? Math.round((scored.reduce((s, r) => s + (r.quality_score ?? 0), 0) / scored.length) * 10) / 10
      : null;

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sentient Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This agent is wired into the Sentient AGI ecosystem — queryable via Sentient Chat,
          quality-scored via CryptoAnalystBench, and monetizable via the x402 payment protocol.
        </p>
      </div>

      {/* Sentient Chat endpoint */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Sentient Chat Endpoint</h2>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            This agent implements the{" "}
            <a
              href="https://github.com/sentient-agi/Sentient-Agent-Framework"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Sentient Agent Framework
            </a>{" "}
            SSE protocol — making it queryable directly from Sentient Chat.
          </p>
          <div className="rounded-lg bg-muted/40 px-4 py-3 font-mono text-xs text-foreground space-y-1">
            <p className="text-muted-foreground">POST /api/assist</p>
            <p>{`{ "query": "What is the current macro regime?" }`}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Streams back{" "}
            <code className="font-mono bg-muted px-1 rounded">TextChunkEvent</code> →{" "}
            <code className="font-mono bg-muted px-1 rounded">DoneEvent</code> using the
            Sentient SSE protocol. Automatically enriched with the 3 most recent research findings.
          </p>
          <div className="rounded-lg bg-muted/40 px-4 py-3 font-mono text-xs text-muted-foreground space-y-1">
            <p className="text-foreground">Example response stream:</p>
            <p>event: TextChunkEvent</p>
            <p>{`data: {"schema_version":"1.0","content_type":"TEXT_STREAM","stream_id":"...","is_complete":false,"content":"The current macro..."}`}</p>
            <p className="mt-1">event: DoneEvent</p>
            <p>{`data: {"schema_version":"1.0","content_type":"DONE","event_name":"done"}`}</p>
          </div>
        </div>
      </section>

      {/* CryptoAnalystBench quality scoring */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Research Quality Scoring</h2>
          {avgQuality != null && (
            <span className="text-xs text-muted-foreground">
              avg quality{" "}
              <span className={`font-semibold ${avgQuality >= 8 ? "text-green-400" : avgQuality >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                {avgQuality}/10
              </span>{" "}
              across {scored.length} scored notes
            </span>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            After each agent run, a Claude Haiku judge evaluates the research note on four axes
            from the{" "}
            <a
              href="https://github.com/sentient-agi/CryptoAnalystBench"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              CryptoAnalystBench
            </a>{" "}
            framework. Scores appear on the Research page alongside conviction scores.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Relevance", desc: "Analysis addresses regime with supporting evidence" },
              { label: "Depth", desc: "Specific values cited, implications fully explored" },
              { label: "Temporal Accuracy", desc: "Data is current, time references specific" },
              { label: "Data Consistency", desc: "No contradictions, ideas follow from regime" },
            ].map((d) => (
              <div key={d.label} className="rounded-lg bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
              </div>
            ))}
          </div>

          {scored.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent scores</p>
              {scored.map((r, i) => {
                const qs = r.quality_scores ? JSON.parse(r.quality_scores) : null;
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground w-20 shrink-0">
                      {r.run_at?.slice(0, 10)}
                    </span>
                    <span className={`font-semibold w-12 ${
                      (r.quality_score ?? 0) >= 8 ? "text-green-400" :
                      (r.quality_score ?? 0) >= 6 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {r.quality_score?.toFixed(1)}/10
                    </span>
                    {qs && (
                      <span className="text-muted-foreground">
                        R{qs.relevance} · D{qs.depth} · T{qs.temporalAccuracy} · C{qs.dataConsistency}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No scored notes yet. Run the agent to generate and score a research note.
            </p>
          )}
        </div>
      </section>

      {/* x402 monetized feed */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">x402 Monetized Research Feed</h2>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            The research feed is optionally gated behind the{" "}
            <a
              href="https://github.com/sentient-agi/agent-payments-skill"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              x402 protocol
            </a>{" "}
            — HTTP 402 with USDC micropayments on Base. AI agents pay to read AI research.
          </p>
          <div className="rounded-lg bg-muted/40 px-4 py-3 font-mono text-xs text-foreground space-y-1.5">
            <p className="text-muted-foreground"># Without payment:</p>
            <p>GET /api/feed → 402 Payment Required</p>
            <p className="text-muted-foreground/70">{`{ "x402Version":1, "accepts":[{ "scheme":"exact", "network":"base", "maxAmountRequired":"100000", "asset":"USDC" }] }`}</p>
            <p className="mt-2 text-muted-foreground"># With X-PAYMENT header (EIP-3009 signed):</p>
            <p>GET /api/feed + X-PAYMENT: &lt;base64&gt; → 200 + X-PAYMENT-RESPONSE</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              process.env.PAYMENT_ENABLED === "true"
                ? "bg-green-400/10 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                process.env.PAYMENT_ENABLED === "true" ? "bg-green-400" : "bg-muted-foreground"
              }`} />
              {process.env.PAYMENT_ENABLED === "true" ? "Payment enforcement: ON" : "Payment enforcement: OFF (set PAYMENT_ENABLED=true to enable)"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
