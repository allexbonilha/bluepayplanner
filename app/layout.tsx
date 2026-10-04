import type { Metadata } from "next";
import "./globals.css";
import "./analytics.css";
import "./goals.css";
import "./monthly-theme.css";




export const metadata: Metadata = {
  title: "Saldo — Patrimônio mensal",
  description: "Fechamento mensal de patrimônio, investimentos, receitas e despesas consolidadas.",
icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}

