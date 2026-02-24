import { createClient } from "@/lib/supabase/server";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn } from "@/components/fade-in";

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

  const paymentEnabled = process.env.PAYMENT_ENABLED === "true";

  return (
    <FadeIn className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Sentient</h1>
        <p className="mt-1.5 text-xl font-semibold text-foreground">Sentient AGI Integrations</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          This agent is wired into the Sentient ecosystem — queryable via Sentient Chat, quality-scored via CryptoAnalystBench, and monetizable via x402.
        </p>
      </div>

      {/* Sentient Chat */}
      <BracketCard label="SENTIENT CHAT ENDPOINT" className="border border-border bg-card space-y-4">
        <p className="text-sm text-muted-foreground">
          Implements the{" "}
          <a href="https://github.com/sentient-agi/Sentient-Agent-Framework" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-foreground transition-colors">
            Sentient Agent Framework
          </a>{" "}
          SSE protocol — queryable directly from Sentient Chat. Auto-enriched with the 3 most recent research findings.
        </p>
        <div className="border border-border bg-muted/10 px-4 py-3 font-mono text-xs space-y-1">
          <p className="text-muted-foreground/60"># request</p>
          <p className="text-foreground">POST /api/assist</p>
          <p className="text-muted-foreground">{`{ "query": "What is the current macro regime?" }`}</p>
          <p className="mt-2 text-muted-foreground/60"># response stream</p>
          <p className="text-foreground">event: TextChunkEvent</p>
          <p className="text-muted-foreground">{`data: {"schema_version":"1.0","content_type":"TEXT_STREAM","is_complete":false,"content":"The current..."}`}</p>
          <p className="mt-1 text-foreground">event: DoneEvent</p>
          <p className="text-muted-foreground">{`data: {"schema_version":"1.0","content_type":"DONE","event_name":"done"}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-green-400 tracking-wide">ACTIVE</span>
        </div>
      </BracketCard>

      {/* Quality Scoring */}
      <BracketCard label="CRYPTOANALYSTBENCH SCORING" className="border border-border bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground max-w-lg">
            After each agent run, a Claude Haiku judge scores the note on four dimensions from the{" "}
            <a href="https://github.com/sentient-agi/CryptoAnalystBench" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-foreground transition-colors">
              CryptoAnalystBench
            </a>{" "}
            framework.
          </p>
          {avgQuality != null && (
            <div className="shrink-0 text-right">
              <p className={`text-2xl font-semibold data-value ${avgQuality >= 8 ? "text-green-400" : avgQuality >= 6 ? "text-yellow-400" : "text-red-400"}`}>
                {avgQuality}/10
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/60">avg · {scored.length} notes</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Relevance", desc: "Analysis addresses current regime with evidence" },
            { label: "Depth", desc: "Specific values cited, implications fully explored" },
            { label: "Temporal Accuracy", desc: "Data is current, time references specific" },
            { label: "Data Consistency", desc: "No contradictions, ideas follow from regime" },
          ].map((d) => (
            <div key={d.label} className="border border-border px-3 py-2.5">
              <p className="text-xs font-mono text-accent tracking-wide">{d.label.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
            </div>
          ))}
        </div>

        {scored.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">Recent Scores</p>
            {scored.map((r, i) => {
              const qs = r.quality_scores ? JSON.parse(r.quality_scores) : null;
              const qc = (r.quality_score ?? 0) >= 8 ? "text-green-400" : (r.quality_score ?? 0) >= 6 ? "text-yellow-400" : "text-red-400";
              return (
                <div key={i} className="flex items-center gap-4 text-xs font-mono py-1 border-b border-border/50">
                  <span className="text-muted-foreground/50 w-20 shrink-0">{r.run_at?.slice(0, 10)}</span>
                  <span className={`font-semibold w-14 shrink-0 data-value ${qc}`}>{r.quality_score?.toFixed(1)}/10</span>
                  {qs && (
                    <span className="text-muted-foreground/60">
                      R{qs.relevance} · D{qs.depth} · T{qs.temporalAccuracy} · C{qs.dataConsistency}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs font-mono text-muted-foreground">No scored notes yet — run the agent.</p>
        )}
      </BracketCard>

      {/* x402 */}
      <BracketCard label="X402 PAYMENT PROTOCOL" className="border border-border bg-card space-y-4">
        <p className="text-sm text-muted-foreground">
          The research feed is optionally gated behind the{" "}
          <a href="https://github.com/sentient-agi/agent-payments-skill" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-foreground transition-colors">
            x402 protocol
          </a>{" "}
          — HTTP 402 with USDC micropayments on Base. AI agents pay to read AI research.
        </p>
        <div className="border border-border bg-muted/10 px-4 py-3 font-mono text-xs space-y-1.5">
          <p className="text-muted-foreground/60"># without payment</p>
          <p className="text-foreground">GET /api/feed → 402 Payment Required</p>
          <p className="text-muted-foreground">{`{ "x402Version":1, "accepts":[{ "scheme":"exact", "network":"base-sepolia", "asset":"USDC" }] }`}</p>
          <p className="mt-2 text-muted-foreground/60"># with X-PAYMENT header (EIP-3009)</p>
          <p className="text-foreground">GET /api/feed + X-PAYMENT: &lt;base64&gt; → 200 + X-PAYMENT-RESPONSE</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${paymentEnabled ? "bg-green-400 animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className={`text-[10px] font-mono tracking-wide ${paymentEnabled ? "text-green-400" : "text-muted-foreground/60"}`}>
            {paymentEnabled ? "ENFORCEMENT ON" : "ENFORCEMENT OFF — set PAYMENT_ENABLED=true to enable"}
          </span>
        </div>
      </BracketCard>
    </FadeIn>
  );
}
