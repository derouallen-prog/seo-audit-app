import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "SEO Audit App",
  description: "Analyse SEO rapide + recommandations"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">
        <header className="border-b">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">SEO Audit App</h1>
            <a
              href="mailto:hello@example.com?subject=Am%C3%A9liorer%20ma%20strat%C3%A9gie%20SEO"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-900"
            >
              Améliorer ma stratégie SEO
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">
          © {new Date().getFullYear()} — SEO Audit App
        </footer>
      </body>
    </html>
  );
}
