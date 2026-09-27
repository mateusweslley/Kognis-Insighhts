import { AppTopbar } from "@/components/layout/app-topbar";

type HeaderProps = {
  companyName?: string;
  onMenuClick: () => void;
};

export function Header(props: HeaderProps) {
  return <AppTopbar {...props} />;
}
