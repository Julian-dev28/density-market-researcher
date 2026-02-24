import Link from "next/link";
import { RunButton } from "@/components/run-agent-button";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sectors", label: "Sectors" },
  { href: "/dashboard/crypto", label: "Crypto" },
  { href: "/dashboard/research", label: "Research" },
  { href: "/dashboard/expansions", label: "Expansions" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Macro Research</span>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-2 pb-4 space-y-1.5 border-t border-border pt-3">
          <RunButton
            label="Run pipeline"
            endpoint="/api/run-pipeline"
            durationMs={60_000}
            doneLabel="Done — refresh data"
          />
          <RunButton
            label="Run agent"
            endpoint="/api/run-agent"
            durationMs={150_000}
            doneLabel="Done — check Research"
          />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
