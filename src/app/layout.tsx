import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kognis Insights",
  description: "Plataforma de inteligência para negócios presenciais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
