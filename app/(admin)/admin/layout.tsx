import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarNav } from "@/components/admin/sidebar-nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Workspaces",
    href: "/admin/workspaces",
    description: "Manage configuration and routing",
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent("/admin/workspaces")}`);
  }

  return (
    <div className="flex min-h-screen bg-muted/10 text-foreground">
      <aside className="hidden w-72 flex-col border-r border-muted bg-background/95 px-6 py-10 lg:flex">
        <Link href="/admin/workspaces" className="text-lg font-semibold text-foreground">
          EzChat Admin
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">Workspace operations</p>
        <div className="mt-10 flex flex-1 flex-col gap-6">
          <SidebarNav items={NAV_ITEMS} />
        </div>
        <div className="mt-8 rounded-md border border-muted bg-muted/30 p-4 text-xs text-muted-foreground">
          <span className="block font-medium text-foreground">{session.email}</span>
          <span>Administrator</span>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-muted bg-background/90 px-4 backdrop-blur lg:px-8">
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <Link href="/admin/workspaces" className="text-sm font-semibold text-foreground">
                EzChat Admin
              </Link>
            </div>
            <nav className="flex items-center gap-2 lg:hidden" aria-label="Mobile admin navigation">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
                {session.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-8 px-4 py-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
