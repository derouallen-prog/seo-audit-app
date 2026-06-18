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
        <div className="min-h-dvh">
          <header className="border-b">
            <nav className="container flex h-14 items-center justify-between">
              <Link href="/" className="font-semibold">SEO Audit App</Link>
              <Link href="/assistant" className="text-sm text-gray-400 hover:text-white transition">Assistant SEO</Link>
            </nav>
          </header>
          <main className="container py-8">{children}</main>
          <footer className="border-t">
            <div className="container py-6 text-sm text-muted-foreground">
              © {new Date().getFullYear()} — SEO Audit
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
