import { createClient } from "@/lib/supabase/server";

const REGIME_COLORS: Record<string, string> = {
  EXPANSION: "bg-green-400/10 text-green-400 border-green-400/30",
  RECOVERY: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  SLOWDOWN: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  CONTRACTION: "bg-red-400/10 text-red-400 border-red-400/30",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "text-green-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-muted-foreground",
};

type InvestmentIdea = {
  ticker: string;
  direction: string;
  thesis: string;
  catalyst?: string;
  keyRisk?: string;
};

type Anomaly = {
  indicator: string;
  observation: string;
  implication: string;
};

type Finding = {
  finding_id: string;
  run_at: string;
  title: string;
  macro_regime: string;
  confidence: string;
  summary: string;
  key_findings: string;
  anomalies: string;
  investment_ideas: string;
};

export default async function ResearchPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agent_findings")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(20);

  const findings = (data ?? []) as Finding[];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated macro research reports — each run reads prior findings before reasoning
        </p>
      </div>

      {findings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No research yet. Run <code className="font-mono bg-muted px-1 py-0.5 rounded">npm run agent</code> to generate the first report.
        </div>
      ) : (
        <div className="space-y-6">
          {findings.map((f) => {
            const keyFindings: string[] = safeParseJson(f.key_findings, []);
            const anomalies: Anomaly[] = safeParseJson(f.anomalies, []);
            const ideas: InvestmentIdea[] = safeParseJson(f.investment_ideas, []);

            return (
              <div
                key={f.finding_id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-foreground">{f.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {new Date(f.run_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${REGIME_COLORS[f.macro_regime] ?? "bg-muted text-muted-foreground border-border"}`}
                    >
                      {f.macro_regime}
                    </span>
                    <span className={`text-xs font-medium ${CONFIDENCE_COLORS[f.confidence] ?? "text-muted-foreground"}`}>
                      {f.confidence}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-5">
                  {/* Summary */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.summary}</p>

                  {/* Key findings */}
                  {keyFindings.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Key Findings
                      </h3>
                      <ul className="space-y-1">
                        {keyFindings.map((kf, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground">
                            <span className="text-muted-foreground shrink-0">·</span>
                            <span>{kf}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Anomalies */}
                  {anomalies.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Anomalies
                      </h3>
                      <div className="space-y-2">
                        {anomalies.map((a, i) => (
                          <div key={i} className="rounded-lg bg-muted/30 px-3 py-2.5 text-sm">
                            <p className="font-medium text-foreground">{a.indicator}</p>
                            <p className="text-muted-foreground mt-0.5">{a.observation}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1 italic">{a.implication}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investment ideas */}
                  {ideas.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Investment Ideas
                      </h3>
                      <div className="space-y-2">
                        {ideas.map((idea, i) => (
                          <div key={i} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-foreground">{idea.ticker}</span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  idea.direction?.toUpperCase() === "LONG"
                                    ? "bg-green-400/10 text-green-400"
                                    : idea.direction?.toUpperCase() === "SHORT"
                                      ? "bg-red-400/10 text-red-400"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {idea.direction}
                              </span>
                            </div>
                            <p className="text-muted-foreground">{idea.thesis}</p>
                            {idea.catalyst && (
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                <span className="text-muted-foreground">Catalyst:</span> {idea.catalyst}
                              </p>
                            )}
                            {idea.keyRisk && (
                              <p className="text-xs text-red-400/70 mt-0.5">
                                <span className="text-red-400/90">Risk:</span> {idea.keyRisk}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function safeParseJson<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
