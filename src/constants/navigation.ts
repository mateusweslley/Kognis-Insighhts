import {
  BarChart3,
  ClipboardList,
  MessageSquareText,
  QrCode,
  Settings,
} from "lucide-react";

export const panelNavigation = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Pesquisas",
    href: "/pesquisas",
    icon: ClipboardList,
  },
  {
    title: "Campanhas",
    href: "/campanhas",
    icon: QrCode,
  },
  {
    title: "Respostas",
    href: "/respostas",
    icon: MessageSquareText,
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
] as const;
