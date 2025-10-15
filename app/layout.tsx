import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: "SEO Audit App",
  description: "Quick SEO insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={GeistSans.className}>
        <div className="min-h-dvh">
          <header className="border-b">
            <nav className="container flex h-14 items-center justify-between">
              <span className="font-semibold">SEO Audit App</span>
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
