"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { LogoutButton } from "@/components/layout/logout-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";

type AppTopbarProps = {
  companyName?: string;
  onMenuClick: () => void;
};

export function AppTopbar({ companyName, onMenuClick }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-xl lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Button size="icon" variant="secondary" aria-label="Abrir menu" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/dashboard" aria-label="Ir para o dashboard">
            <BrandMark showText={false} />
          </Link>
        </div>

        <div className="hidden min-w-0 lg:block">
          <p className="text-sm font-semibold text-text-primary">Kognis Insights</p>
          <p className="mt-0.5 text-xs text-text-muted">Plataforma de inteligência de consumo</p>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {companyName ? (
            <div className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-subtle sm:block">
              <span className="text-text-muted">Empresa</span>
              <span className="ml-2 font-semibold text-text-primary">{companyName}</span>
            </div>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
