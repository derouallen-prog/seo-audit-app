import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SEO Audit App",
  description: "Quick SEO insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <div className="min-h-dvh bg-white text-black">
          <header className="border-b border-gray-200">
            <nav className="container flex h-14 items-center justify-between">
              <Link href="/" className="font-bold text-black text-lg">SEO Audit App</Link>
              <Link href="/assistant" className="text-sm font-medium text-brand hover:text-brand-dark transition">Assistant SEO</Link>
            </nav>
          </header>
          <main className="container py-8">{children}</main>
          <footer className="border-t border-gray-200">
            <div className="container py-6 text-sm text-gray-500">
              © {new Date().getFullYear()} — SEO Audit
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
