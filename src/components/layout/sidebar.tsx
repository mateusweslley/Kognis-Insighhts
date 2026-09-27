import { AppSidebar } from "@/components/layout/app-sidebar";

type SidebarProps = {
  companyName?: string;
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar(props: SidebarProps) {
  return <AppSidebar {...props} />;
}
