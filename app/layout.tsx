import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import NavUser from "@/app/components/NavUser";
import MobileMenu from "@/app/components/MobileMenu";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Search Mind — Audit SEO all-in-one",
  description: "Analysez votre site en 30 secondes : technique, Core Web Vitals, mots-clés, backlinks et recommandations IA priorisées.",
  authors: [{ name: "Search Mind" }],
  openGraph: {
    title: "Search Mind — Audit SEO all-in-one",
    description: "Analysez votre site en 30 secondes : technique, Core Web Vitals, mots-clés, backlinks et recommandations IA priorisées.",
    type: "website",
  },
};

function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-brand text-white glow-brand shrink-0">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m20 20-4.5-4.5" />
          <circle cx="10.5" cy="10.5" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex items-baseline gap-1 leading-none">
        <span className="font-display text-xl text-ink">Search</span>
        <span className="font-display text-xl italic text-brand">Mind</span>
      </span>
    </span>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={playfair.variable}>
      <body>
        <div className="min-h-dvh bg-background text-ink">

          {/* Header */}
          <header className="sticky top-0 z-40 border-b border-hairline bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
              <Link href="/" className="shrink-0">
                <Logo />
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                {[
                  { href: "/", label: "Audit" },
                  { href: "/assistant", label: "Assistant" },
                  { href: "/citations", label: "Citations IA" },
                  { href: "/tarifs", label: "Tarifs" },
                  { href: "/integrations", label: "Intégrations" },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-md px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-accent hover:text-ink"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-2">
                <Link href="/assistant" className="hidden md:block">
                  <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-accent hover:text-ink">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                      <path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />
                    </svg>
                    Assistant IA
                  </button>
                </Link>
                <NavUser />
                <MobileMenu />
              </div>
            </div>
          </header>

          <main>{children}</main>

          {/* Footer */}
          <footer className="mt-16 border-t border-hairline bg-muted/40 sm:mt-24">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
              <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">

                {/* Brand bloc */}
                <div className="max-w-sm">
                  <Logo />
                  <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                    L&apos;observatoire SEO qui traduit vos données en actions. Audit, Core Web Vitals, mots-clés, backlinks et un assistant IA — dans une seule interface.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-background px-3 py-1.5 text-xs text-ink-soft">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
                    Tous les systèmes opérationnels
                  </div>
                </div>

                {/* Colonnes liens */}
                {[
                  {
                    title: "Produit",
                    links: ["Audit SEO", "Core Web Vitals", "Mots-clés", "Backlinks", "Assistant IA"],
                  },
                  {
                    title: "Ressources",
                    links: ["Documentation", "Guides SEO", "Changelog", "Statut", "API"],
                  },
                  {
                    title: "Entreprise",
                    links: ["À propos", "Blog", "Clients", "Tarifs", "Contact"],
                  },
                  {
                    title: "Légal",
                    links: ["Confidentialité", "CGU", "Mentions légales", "DPA", "Sécurité"],
                  },
                ].map(({ title, links }) => (
                  <div key={title}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</div>
                    <ul className="mt-4 space-y-2.5">
                      {links.map((l) => (
                        <li key={l}>
                          <a
                            href={l === "Tarifs" ? "/tarifs" : "#"}
                            className="text-sm text-ink-soft transition-colors hover:text-brand"
                          >{l}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-hairline pt-6 text-xs text-ink-soft sm:mt-12 sm:flex-row sm:items-center">
                <div>© {new Date().getFullYear()} Search Mind · Fait avec attention à Paris</div>
                <div className="font-mono">v1.0.0 · beta</div>
              </div>
            </div>
          </footer>

        </div>
      </body>
    </html>
  );
}
