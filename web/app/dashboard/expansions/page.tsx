import { createClient } from "@/lib/supabase/server";

const STATUS_STYLES: Record<string, string> = {
  RUNNING:  "text-yellow-400 bg-yellow-400/10",
  COMPLETE: "text-green-400 bg-green-400/10",
  FAILED:   "text-red-400 bg-red-400/10",
};

export default async function ExpansionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("openhands_tasks")
    .select("*")
    .order("requested_at", { ascending: false });

  const tasks = data ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Self-Expansions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When the research agent identifies a data gap, it tasks OpenHands (an AI software engineer) to build the missing capability. The platform grows itself.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">No expansions yet</p>
          <p className="text-sm text-muted-foreground">
            When the agent identifies a genuine data gap — e.g., missing Treasury auction data, options flow, earnings revisions — it will autonomously task OpenHands to build the ingestion module and open a PR.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => (
            <div key={t.task_id as string} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.requested_at as string).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  {t.triggered_by_finding_id && (
                    <p className="text-xs text-muted-foreground">
                      Triggered by finding <code className="font-mono bg-muted px-1 py-0.5 rounded">{(t.triggered_by_finding_id as string).slice(0, 8)}</code>
                    </p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[t.status as string] ?? "text-muted-foreground bg-muted"}`}>
                  {t.status as string}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-foreground leading-relaxed">{t.description as string}</p>
                {t.conversation_id && (
                  <a
                    href={`https://app.all-hands.dev/conversations/${t.conversation_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs text-primary hover:underline"
                  >
                    View OpenHands conversation →
                  </a>
                )}
                {t.result && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                    {t.result as string}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
