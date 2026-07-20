import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vinted Reseller",
  description: "Gestão e análise do negócio de revenda na Vinted",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/artigos", label: "Artigos" },
  { href: "/compras", label: "Compras" },
  { href: "/despesas", label: "Despesas" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-edge bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <span className="text-sm font-semibold tracking-wide">
              Vinted&nbsp;Reseller
            </span>
            <nav className="flex gap-4 text-sm text-ink-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
