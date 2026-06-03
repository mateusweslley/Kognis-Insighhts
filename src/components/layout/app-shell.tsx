import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { requireCurrentCompany } from "@/lib/company";

type AppShellProps = {
  children: React.ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const company = await requireCurrentCompany();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar companyName={company.name} />
      <div className="min-w-0 flex-1">
        <Header companyName={company.name} />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
