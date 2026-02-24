"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RunButton } from "@/components/run-agent-button";
import { ScrambleText } from "@/components/scramble-text";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sectors", label: "Sectors" },
  { href: "/dashboard/crypto", label: "Crypto" },
  { href: "/dashboard/research", label: "Research" },
  { href: "/dashboard/expansions", label: "Expansions" },
  { href: "/dashboard/sentient", label: "Sentient" },
];

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-1.5 text-xs font-mono tracking-wide transition-colors border-l ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {active && <span className="text-accent">›</span>}
      {!active && <span className="w-3" />}
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-48 shrink-0 border-r border-border flex flex-col noise-overlay">
        <div className="px-4 py-5 border-b border-border">
          <span className="text-[10px] font-mono tracking-[0.2em] text-accent uppercase">
            <ScrambleText text="MACRO RESEARCH" duration={800} />
          </span>
          <div className="mt-0.5 text-[9px] font-mono text-muted-foreground/60 tracking-wide">
            AI Research Platform
          </div>
        </div>

        <nav className="flex-1 py-4 px-0 space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="px-3 pb-5 pt-3 border-t border-border space-y-0.5">
          <div className="text-[9px] font-mono tracking-[0.15em] text-muted-foreground/50 uppercase px-2 pb-1">
            Commands
          </div>
          <RunButton
            label="run pipeline"
            endpoint="/api/run-pipeline"
            durationMs={60_000}
            doneLabel="pipeline done"
          />
          <RunButton
            label="run agent"
            endpoint="/api/run-agent"
            durationMs={150_000}
            doneLabel="agent done"
          />
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
