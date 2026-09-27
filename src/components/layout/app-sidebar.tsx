"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/layout/logout-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { panelNavigation } from "@/constants/navigation";
import { cn } from "@/lib/utils";

type NavigationItem = (typeof panelNavigation)[number];

type AppSidebarProps = {
  companyName?: string;
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ companyName, className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const primaryItems = panelNavigation.filter((item) =>
    ["/dashboard", "/pesquisas", "/respostas"].includes(item.href),
  );
  const secondaryItems = panelNavigation.filter((item) =>
    ["/campanhas", "/configuracoes"].includes(item.href),
  );

  return (
    <aside
      className={cn(
        "flex h-dvh w-80 flex-col border-r border-border bg-surface px-5 py-6 shadow-subtle",
        className,
      )}
    >
      <Link href="/dashboard" onClick={onNavigate} aria-label="Ir para o dashboard">
        <BrandMark />
      </Link>

      {companyName ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Empresa
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-text-primary">{companyName}</p>
        </div>
      ) : null}

      <nav className="mt-8 space-y-6">
        <NavigationGroup items={primaryItems} pathname={pathname} onNavigate={onNavigate} />
        <NavigationGroup
          items={secondaryItems}
          pathname={pathname}
          onNavigate={onNavigate}
          className="border-t border-border pt-5"
        />
      </nav>

      <div className="mt-auto rounded-2xl bg-brand p-4 text-brand-foreground shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Kognis</p>
        <p className="mt-2 text-sm font-semibold">Inteligência de consumo para decisões melhores.</p>
      </div>

      <div className="mt-4">
        <LogoutButton className="w-full justify-start" />
      </div>
    </aside>
  );
}

function NavigationGroup({
  items,
  pathname,
  onNavigate,
  className,
}: {
  items: NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-text-secondary transition-colors",
              isActive
                ? "bg-brand-soft text-brand"
                : "hover:bg-surface-muted hover:text-text-primary",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </div>
  );
}
