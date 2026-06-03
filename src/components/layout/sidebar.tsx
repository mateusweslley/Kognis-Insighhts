"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { panelNavigation } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/marketing/brand-mark";

type SidebarProps = {
  companyName?: string;
};

export function Sidebar({ companyName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 border-r border-white/10 bg-kognis-cyber/82 px-4 py-5 lg:block">
      <BrandMark className="px-2" />
      {companyName ? (
        <div className="mt-6 rounded-md border border-white/10 bg-white/[0.045] px-3 py-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Empresa</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{companyName}</p>
        </div>
      ) : null}
      <nav className="mt-10 space-y-1">
        {panelNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
                isActive
                  ? "bg-kognis-teal text-kognis-cyber"
                  : "hover:bg-white/8 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
