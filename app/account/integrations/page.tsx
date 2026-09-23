"use client";

import { useState } from "react";
import Image from "next/image";
import { WpConnectModal } from "@/app/assistant/ToolSetupModals";

const INTEGRATIONS = [
  {
    id: "gsc",
    name: "Google Search Console",
    description: "Importe tes positions, impressions et clics directement dans Search Mind. Active les alertes de régression automatiques.",
    category: "SEO Data",
    color: "#4285F4",
    logo: (
      <Image src="/logos/gsc.png" alt="Google Search Console" width={24} height={24} className="h-6 w-6 rounded object-contain" />
    ),
    connected: false,
    href: "/api/gsc/auth",
  },
  {
    id: "webflow",
    name: "Webflow",
    description: "Synchronise les métadonnées SEO de tes pages Webflow et reçois des suggestions d'optimisation en temps réel.",
    category: "CMS",
    color: "#4353FF",
    logo: (
      <Image src="/logos/webflow.png" alt="Webflow" width={24} height={24} className="h-6 w-6 rounded object-contain" />
    ),
    connected: false,
    href: "/api/webflow/auth",
  },
  {
    id: "wordpress",
    name: "WordPress",
    description: "Connecte ton site WordPress via le flux Application Passwords (WP 5.6+) pour pousser tes optimisations directement en production.",
    category: "CMS",
    color: "#21759B",
    logo: (
      <Image src="/logos/wordpress.png" alt="WordPress" width={24} height={24} className="h-6 w-6 rounded object-contain" />
    ),
    connected: false,
    href: "/api/wp/auth",
    requiresSiteUrl: true,
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    description: "Analyse les performances SEO de tes fiches produits et catégories pour maximiser ta visibilité e-commerce.",
    category: "E-commerce",
    color: "#DF0067",
    logo: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#DF0067">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
    ),
    connected: false,
    href: "#",
    comingSoon: true,
  },
];

type Integration = typeof INTEGRATIONS[number];

function IntegrationCard({ integration }: { integration: Integration }) {
  const [showWpModal, setShowWpModal] = useState(false);

  return (
    <>
    {showWpModal && <WpConnectModal onClose={() => setShowWpModal(false)} />}
    <div className="rounded-xl border border-hairline bg-background px-5 py-4 flex flex-col gap-0">
      <div className="flex items-start gap-4">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: integration.color + "15" }}
        >
          {integration.logo}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink">{integration.name}</p>
            <span className="inline-flex rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium text-ink-soft">
              {integration.category}
            </span>
            {integration.comingSoon && (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-soft/60">
                Bientôt
              </span>
            )}
            {integration.connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                Connecté
              </span>
            )}
          </div>
          <p className="text-xs text-ink-soft mt-1 leading-relaxed">{integration.description}</p>
        </div>

        <div className="shrink-0 pt-0.5">
          {integration.comingSoon ? (
            <button disabled className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-soft/40 cursor-not-allowed">
              Bientôt
            </button>
          ) : integration.connected ? (
            <button className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted transition-colors">
              Gérer
            </button>
          ) : integration.requiresSiteUrl ? (
            <button
              onClick={() => setShowWpModal(true)}
              className="inline-flex items-center rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-background hover:bg-ink/80 transition-colors"
            >
              Connecter
            </button>
          ) : (
            <a
              href={integration.href}
              className="inline-flex items-center rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-background hover:bg-ink/80 transition-colors"
            >
              Connecter
            </a>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default function IntegrationsPage() {
  const connected = INTEGRATIONS.filter(i => i.connected);
  const available = INTEGRATIONS.filter(i => !i.connected);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Intégrations</h1>
        <p className="text-sm text-ink-soft mt-0.5">Connecte tes outils pour enrichir l&apos;analyse SEO</p>
      </div>

      {connected.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60">Connectées</p>
          {connected.map(i => <IntegrationCard key={i.id} integration={i} />)}
        </section>
      )}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60">Disponibles</p>
        {available.map(i => <IntegrationCard key={i.id} integration={i} />)}
      </section>

      <div className="rounded-xl border border-dashed border-hairline bg-muted/20 px-5 py-6 text-center">
        <p className="text-sm font-medium text-ink">Tu utilises un autre CMS ou outil SEO ?</p>
        <p className="text-xs text-ink-soft mt-1">Dis-nous quelle intégration manque et on l&apos;ajoutera en priorité.</p>
        <a
          href="mailto:hello@searchmind.fr?subject=Demande d'intégration"
          className="mt-3 inline-flex items-center rounded-lg border border-hairline bg-background px-4 py-2 text-xs font-medium text-ink hover:bg-muted transition-colors"
        >
          Suggérer une intégration
        </a>
      </div>
    </div>
  );
}
