"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { cn } from "@/lib/utils";

type AppShellClientProps = {
  children: React.ReactNode;
  companyName: string;
};

export function AppShellClient({ children, companyName }: AppShellClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background lg:flex">
      <AppSidebar companyName={companyName} className="sticky top-0 hidden h-dvh self-start lg:flex" />

      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/30 opacity-0 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none",
        )}
        aria-hidden="true"
        onClick={() => setIsSidebarOpen(false)}
      />
      <AppSidebar
        companyName={companyName}
        onNavigate={() => setIsSidebarOpen(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex min-h-dvh max-w-[86vw] transform transition-transform duration-200 ease-out lg:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      />

      <div className="min-w-0 flex-1">
        <AppTopbar companyName={companyName} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
