import { createClient } from "@/lib/supabase/server";
import { BracketCard } from "@/components/bracket-card";
import { FadeIn, FadeInStagger, FadeInItem } from "@/components/fade-in";

const STATUS_COLORS: Record<string, string> = {
  RUNNING:  "text-yellow-400",
  COMPLETE: "text-green-400",
  FAILED:   "text-red-400",
};

export default async function ExpansionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("openhands_tasks")
    .select("*")
    .order("requested_at", { ascending: false });

  const tasks = data ?? [];

  return (
    <FadeIn className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-sm font-mono tracking-[0.15em] text-muted-foreground uppercase">Expansions</h1>
        <p className="mt-1.5 text-xl font-semibold text-foreground">Autonomous Platform Growth</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          When the research agent identifies a data gap, it tasks OpenHands — an AI software engineer — to build the missing capability and open a PR. The platform grows itself.
        </p>
      </div>

      {tasks.length === 0 ? (
        <BracketCard className="border border-border bg-card p-12 text-center space-y-3">
          <p className="text-sm font-mono text-foreground">No expansions yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            When the agent identifies a genuine data gap — Treasury auction data, options flow, earnings revisions — it will autonomously dispatch OpenHands to build the ingestion module.
          </p>
        </BracketCard>
      ) : (
        <FadeInStagger className="space-y-4">
          {tasks.map((t) => (
            <FadeInItem key={t.task_id as string}>
              <BracketCard
                label={`TASK · ${new Date(t.requested_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                className="border border-border bg-card overflow-hidden"
              >
                <div className="pb-3 border-b border-border flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground/60">
                      {new Date(t.requested_at as string).toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    {t.triggered_by_finding_id && (
                      <p className="text-[10px] font-mono text-muted-foreground/50">
                        triggered by <span className="text-accent">{(t.triggered_by_finding_id as string).slice(0, 8)}</span>
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-mono tracking-widest uppercase ${STATUS_COLORS[t.status as string] ?? "text-muted-foreground"}`}>
                    [{t.status as string}]
                  </span>
                </div>

                <div className="pt-3 space-y-3">
                  <p className="text-sm text-foreground leading-relaxed">{t.description as string}</p>
                  {t.conversation_id && (
                    <a
                      href={`https://app.all-hands.dev/conversations/${t.conversation_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-[10px] font-mono text-accent hover:text-foreground transition-colors"
                    >
                      › view openhands conversation
                    </a>
                  )}
                  {t.result && (
                    <p className="text-xs font-mono text-muted-foreground border-l-2 border-accent/20 pl-3 py-1">
                      {t.result as string}
                    </p>
                  )}
                </div>
              </BracketCard>
            </FadeInItem>
          ))}
        </FadeInStagger>
      )}
    </FadeIn>
  );
}
