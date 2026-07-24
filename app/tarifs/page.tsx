import Link from "next/link";

const PLANS = [
  {
    name: "Découverte",
    price: "Gratuit",
    period: "",
    description: "Pour découvrir Search Mind sans engagement.",
    cta: "Commencer gratuitement",
    ctaHref: "/auth",
    featured: false,
    features: [
      "5 audits SEO / mois",
      "Score SEO global + 6 onglets",
      "Export .md",
      "Assistant IA — 10 messages / jour",
      "1 prompt Citations IA",
    ],
  },
  {
    name: "Pro",
    price: "49 €",
    period: "/ mois",
    description: "Pour les consultants et équipes SEO en croissance.",
    cta: "Démarrer l'essai gratuit",
    ctaHref: "/auth",
    featured: true,
    features: [
      "Audits illimités",
      "Score SEO complet + PageSpeed",
      "Export .md et .pdf",
      "Assistant IA illimité",
      "Citations IA — 25 prompts, 3 plateformes",
      "Google Search Console connectée",
      "Historique 90 jours",
    ],
  },
  {
    name: "Agence",
    price: "149 €",
    period: "/ mois",
    description: "Pour les agences qui gèrent plusieurs clients.",
    cta: "Contacter l'équipe",
    ctaHref: "mailto:contact@searchmind.fr",
    featured: false,
    features: [
      "Tout le plan Pro",
      "Multi-domaines illimités",
      "Citations IA — prompts illimités",
      "Rapports marque blanche (PDF)",
      "Accès API",
      "Support prioritaire",
      "Onboarding dédié",
    ],
  },
];

export default function TarifsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h1 className="font-display text-4xl text-ink sm:text-5xl">Tarifs simples et transparents</h1>
        <p className="mt-4 text-base text-ink-soft">
          Un outil SEO complet — audit, visibilité IA, assistant — sans surprises.
          Commencez gratuitement, passez Pro quand vous êtes prêt.
        </p>
      </div>

      {/* Plans */}
      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-7 ${
              plan.featured
                ? "border-brand bg-brand/5 shadow-lg shadow-brand/10"
                : "border-hairline bg-white"
            }`}
          >
            {plan.featured && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow">
                  Le plus populaire
                </span>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl text-ink">{plan.price}</span>
                {plan.period && <span className="text-sm text-ink-soft">{plan.period}</span>}
              </div>
              <p className="mt-2 text-sm text-ink-soft">{plan.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-good" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link href={plan.ctaHref}>
              <button
                className={`w-full rounded-xl py-2.5 text-sm font-medium transition ${
                  plan.featured
                    ? "bg-brand text-white hover:bg-brand-dark shadow glow-brand"
                    : "border border-hairline text-ink hover:bg-accent"
                }`}
              >
                {plan.cta}
              </button>
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ rapide */}
      <div className="mt-16 mx-auto max-w-2xl">
        <h2 className="font-display text-2xl text-ink mb-6 text-center">Questions fréquentes</h2>
        <div className="space-y-4">
          {[
            {
              q: "Puis-je annuler à tout moment ?",
              a: "Oui. Aucun engagement. Vous pouvez annuler depuis votre espace en un clic."
            },
            {
              q: "Qu'est-ce que les Citations IA ?",
              a: "Un module qui surveille si votre marque est citée ou mentionnée par Perplexity, Claude et Gemini sur des questions stratégiques.",
            },
            {
              q: "Les données sont-elles en temps réel ?",
              a: "L'audit SEO est en temps réel (~30s). Les Citations IA tournent en cron hebdomadaire ou à la demande.",
            },
            {
              q: "Y a-t-il une version d'essai ?",
              a: "Le plan Découverte est gratuit sans limite de durée. Le plan Pro est disponible en essai 14 jours sans CB.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-hairline bg-white p-5">
              <p className="font-medium text-sm text-ink">{q}</p>
              <p className="mt-1.5 text-sm text-ink-soft">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA bas */}
      <div className="mt-14 rounded-2xl border border-brand/20 bg-brand/5 p-10 text-center">
        <h2 className="font-display text-2xl text-ink">Une question sur les tarifs ?</h2>
        <p className="mt-2 text-sm text-ink-soft">Notre équipe répond sous 24h.</p>
        <a href="mailto:contact@searchmind.fr">
          <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition shadow glow-brand">
            Contacter l&apos;équipe
          </button>
        </a>
      </div>

    </div>
  );
}
