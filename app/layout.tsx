import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Search Mind — Assistant SEO",
  description: "Analysez, auditez et optimisez votre référencement avec Search Mind.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <div className="min-h-dvh bg-white text-black">
          <header className="border-b border-gray-200">
            <nav className="container flex h-14 items-center justify-between">
              <Link href="/" className="font-bold text-black text-lg">Search Mind</Link>
              <Link href="/assistant" className="text-sm font-medium text-brand hover:text-brand-dark transition">Assistant SEO</Link>
            </nav>
          </header>
          <main className="container py-8">{children}</main>
          <footer className="border-t border-gray-200">
            <div className="container py-6 text-sm text-gray-500 flex items-center justify-between">
              <span>© {new Date().getFullYear()} Search Mind</span>
              <Link href="/legal/confidentialite" className="hover:underline">Politique de confidentialité</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
