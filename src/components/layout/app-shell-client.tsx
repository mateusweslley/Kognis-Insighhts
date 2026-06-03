"use client";

import { useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

type AppShellClientProps = {
  children: React.ReactNode;
  companyName: string;
};

export function AppShellClient({ children, companyName }: AppShellClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar companyName={companyName} className="hidden lg:block" />

      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none",
        )}
        aria-hidden="true"
        onClick={() => setIsSidebarOpen(false)}
      />
      <Sidebar
        companyName={companyName}
        onNavigate={() => setIsSidebarOpen(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 block min-h-dvh transform transition-transform duration-200 ease-out lg:hidden",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      />

      <div className="min-w-0 flex-1">
        <Header companyName={companyName} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="px-4 py-6 sm:px-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
