import Link from "next/link";
import { Home, Menu } from "lucide-react";

import { LogoutButton } from "@/components/layout/logout-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  companyName?: string;
  onMenuClick: () => void;
};

export function Header({ companyName, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-kognis-cyber/86 px-4 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Button size="icon" variant="secondary" aria-label="Abrir menu" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/dashboard" aria-label="Ir para o dashboard">
            <BrandMark showText={false} />
          </Link>
        </div>
        <div className="hidden min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-muted-foreground lg:flex">
          <span className="truncate">{companyName}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Início</span>
            </Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
