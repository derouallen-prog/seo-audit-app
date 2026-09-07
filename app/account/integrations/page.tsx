"use client";

const INTEGRATIONS = [
  {
    id: "gsc",
    name: "Google Search Console",
    description: "Importe tes positions, impressions et clics directement dans Search Mind. Active les alertes de régression automatiques.",
    category: "SEO Data",
    color: "#4285F4",
    logo: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    connected: false,
    href: "/api/integrations/gsc/connect",
  },
  {
    id: "webflow",
    name: "Webflow",
    description: "Synchronise les métadonnées SEO de tes pages Webflow et reçois des suggestions d'optimisation en temps réel.",
    category: "CMS",
    color: "#4353FF",
    logo: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#4353FF">
        <path d="M17.805 6.14c-1.98 0-3.636 1.265-4.247 3.033-.582-1.77-2.143-3.033-4.04-3.033-2.349 0-4.253 1.9-4.253 4.243 0 .617.135 1.204.373 1.733L12 17.86l6.362-5.744c.238-.53.373-1.117.373-1.733 0-2.343-1.904-4.243-4.253-4.243h-.677z"/>
      </svg>
    ),
    connected: false,
    href: "/api/integrations/webflow/connect",
  },
  {
    id: "wordpress",
    name: "WordPress",
    description: "Connecte ton site WordPress via le plugin Search Mind pour pousser les optimisations directement en production.",
    category: "CMS",
    color: "#21759B",
    logo: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#21759B">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.592 14.964l-3.73-10.218a6.153 6.153 0 0 1 1.265-.218c.132 0 .25.017.364.017.119 0 .23-.017.334-.017-.398 1.316-1.268 3.956-2.233 10.436zm9.295-1.7a6.17 6.17 0 0 1-6.17 1.562l2.098-6.082 1.978-5.444a6.17 6.17 0 0 1 2.094 9.964zm-6.17 2.736A7.93 7.93 0 0 1 4.07 12a7.934 7.934 0 0 1 4.007-6.895L5.244 13.1A7.894 7.894 0 0 1 4.07 12a7.93 7.93 0 0 1 7.93-7.93 7.926 7.926 0 0 1 4.617 1.47L14.34 9.32l-1.553 4.507-1.254-3.807h-.002l1.254 3.807L11 17.14a7.93 7.93 0 0 1 2.533.86z"/>
      </svg>
    ),
    connected: false,
    href: "#",
    comingSoon: true,
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

function IntegrationCard({ integration }: { integration: typeof INTEGRATIONS[number] }) {
  return (
    <div className="rounded-xl border border-hairline bg-background px-5 py-4 flex items-start gap-4">
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
