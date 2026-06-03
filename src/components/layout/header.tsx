import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";

import { LogoutButton } from "@/components/layout/logout-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  companyName?: string;
};

export function Header({ companyName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-kognis-cyber/86 px-4 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Button size="icon" variant="secondary" aria-label="Abrir menu">
            <Menu className="h-4 w-4" />
          </Button>
          <BrandMark showText={false} />
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-muted-foreground lg:flex">
          <Search className="h-4 w-4" />
          {companyName ? companyName : "Buscar em breve"}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button size="icon" variant="secondary" aria-label="Notificações">
            <Bell className="h-4 w-4" />
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Landing</Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
