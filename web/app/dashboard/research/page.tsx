import { createClient } from "@/lib/supabase/server";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/fade-in";

const REGIME_COLORS: Record<string, string> = {
  EXPANSION:   "text-green-400 border-green-400/20",
  RECOVERY:    "text-blue-400 border-blue-400/20",
  SLOWDOWN:    "text-yellow-400 border-yellow-400/20",
  CONTRACTION: "text-red-400 border-red-400/20",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   "text-green-400",
  MEDIUM: "text-yellow-400",
  LOW:    "text-muted-foreground",
};

type InvestmentIdea = { ticker: string; direction: string; thesis: string; catalyst?: string; keyRisk?: string };
type Anomaly = { indicator: string; observation: string; implication: string };
type QualityScores = { relevance: number; depth: number; temporalAccuracy: number; dataConsistency: number };
type Finding = {
  finding_id: string; run_at: string; title: string; macro_regime: string; confidence: string;
  conviction_score: number | null; quality_score: number | null; quality_scores: string | null;
  summary: string; key_findings: string; anomalies: string; investment_ideas: string;
};

export default async function ResearchPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("agent_findings").select("*").order("run_at", { ascending: false }).limit(20);
  const findings = (data ?? []) as Finding[];

  return (
    <FadeIn className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Research</h1>
        <p className="mt-1.5 text-xl font-semibold text-foreground">AI Macro Research Notes</p>
      </div>

      {findings.length === 0 ? (
        <BracketCard className="border border-border bg-card p-12 text-center">
          <p className="text-sm font-mono text-muted-foreground">
            No research yet — run <span className="text-accent">› run agent</span> to generate the first note.
          </p>
        </BracketCard>
      ) : (
        <FadeInStagger className="space-y-6">
          {findings.map((f) => {
            const keyFindings: string[] = safeParseJson(f.key_findings, []);
            const anomalies: Anomaly[] = safeParseJson(f.anomalies, []);
            const ideas: InvestmentIdea[] = safeParseJson(f.investment_ideas, []);
            const qs: QualityScores | null = safeParseJson(f.quality_scores ?? "", null);

            return (
              <FadeInItem key={f.finding_id}>
                <BracketCard
                  label={`FINDING · ${new Date(f.run_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  className="border border-border bg-card overflow-hidden"
                >
                  {/* Header */}
                  <div className="pb-4 border-b border-border flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-foreground leading-snug">{f.title}</h2>
                      <p className="text-[10px] font-mono text-muted-foreground/60">
                        {new Date(f.run_at).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                          year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      <span className={`text-[10px] font-mono tracking-widest uppercase border px-2 py-0.5 ${REGIME_COLORS[f.macro_regime] ?? "text-foreground border-border"}`}>
                        {f.macro_regime}
                      </span>
                      {f.conviction_score != null && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          conv <span className="text-foreground">{f.conviction_score}/10</span>
                        </span>
                      )}
                      {f.quality_score != null && (
                        <QualityBadge score={f.quality_score} scores={qs} />
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="pt-4 space-y-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.summary}</p>

                    {keyFindings.length > 0 && (
                      <div>
                        <h3 className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">Key Findings</h3>
                        <ul className="space-y-1.5">
                          {keyFindings.map((kf, i) => (
                            <li key={i} className="flex gap-2 text-sm text-foreground">
                              <span className="text-accent shrink-0">›</span>
                              <span>{kf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {anomalies.length > 0 && (
                      <div>
                        <h3 className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">Anomalies</h3>
                        <div className="space-y-2">
                          {anomalies.map((a, i) => (
                            <div key={i} className="border-l-2 border-accent/30 pl-3 py-1 text-sm">
                              <p className="font-medium text-foreground">{a.indicator}</p>
                              <p className="text-muted-foreground mt-0.5 text-xs">{a.observation}</p>
                              <p className="text-xs text-muted-foreground/60 mt-0.5 italic">{a.implication}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ideas.length > 0 && (
                      <div>
                        <h3 className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">Investment Ideas</h3>
                        <div className="space-y-2">
                          {ideas.map((idea, i) => (
                            <div key={i} className="border border-border px-3 py-2.5 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="data-value font-semibold text-foreground">{idea.ticker}</span>
                                <span className={`text-[10px] font-mono tracking-wide px-1.5 py-0.5 ${
                                  idea.direction?.toUpperCase() === "LONG" ? "text-green-400 bg-green-400/10" :
                                  idea.direction?.toUpperCase() === "SHORT" ? "text-red-400 bg-red-400/10" :
                                  "text-muted-foreground bg-muted"
                                }`}>
                                  {idea.direction?.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-xs">{idea.thesis}</p>
                              {idea.catalyst && (
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                  <span className="text-accent">catalyst</span> — {idea.catalyst}
                                </p>
                              )}
                              {idea.keyRisk && (
                                <p className="text-xs text-red-400/60 mt-0.5">
                                  <span className="text-red-400/80">risk</span> — {idea.keyRisk}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </BracketCard>
              </FadeInItem>
            );
          })}
        </FadeInStagger>
      )}
    </FadeIn>
  );
}

function safeParseJson<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

function QualityBadge({ score, scores }: { score: number; scores: QualityScores | null }) {
  const color = score >= 8 ? "text-green-400" : score >= 6 ? "text-yellow-400" : "text-red-400";
  const tooltip = scores
    ? `R:${scores.relevance} D:${scores.depth} T:${scores.temporalAccuracy} C:${scores.dataConsistency}`
    : undefined;
  return (
    <span className={`text-[10px] font-mono ${color}`} title={tooltip}>
      Q {score.toFixed(1)}/10
    </span>
  );
}
