"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  label: string;
  href: string;
  description?: string;
};

interface SidebarNavProps {
  items: SidebarNavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Admin navigation">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-primary-500 text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            {item.description ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground/80">
                {item.description}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
