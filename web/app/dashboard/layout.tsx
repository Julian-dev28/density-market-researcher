import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signout } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sectors", label: "Sectors" },
  { href: "/dashboard/crypto", label: "Crypto" },
  { href: "/dashboard/research", label: "Research" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
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

        <div className="px-4 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground truncate mb-3">{user.email}</p>
          <form action={signout}>
            <button
              type="submit"
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
