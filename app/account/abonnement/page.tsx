"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "0 €",
    period: "/ mois",
    description: "Pour découvrir Search Mind",
    features: ["1 site analysé", "3 audits / mois", "Assistant SEO basique", "Export PDF limité"],
    cta: "Plan actuel",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "29 €",
    period: "/ mois",
    description: "Pour les indépendants et petites équipes",
    features: ["5 sites analysés", "Audits illimités", "Assistant SEO avancé", "Export PDF & Markdown", "Rapport hebdomadaire", "Connexion Search Console"],
    cta: "Passer en Pro",
    highlight: true,
  },
  {
    id: "agency",
    name: "Agence",
    price: "89 €",
    period: "/ mois",
    description: "Pour les agences et équipes SEO",
    features: ["Sites illimités", "Audits illimités", "Accès API", "Dashboard multi-clients", "Support prioritaire", "Onboarding dédié"],
    cta: "Contacter l'équipe",
    highlight: false,
  },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}

export default function AbonnementPage() {
  const [currentPlan] = useState("starter");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Abonnement</h1>
        <p className="text-sm text-ink-soft mt-0.5">Gère ton plan et ta facturation</p>
      </div>

      {/* Current plan banner */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand/70 mb-0.5">Plan actuel</p>
          <p className="text-base font-semibold text-ink">Starter — Gratuit</p>
          <p className="text-xs text-ink-soft mt-0.5">Renouvellement automatique · Aucune carte enregistrée</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Actif</span>
      </div>

      {/* Plans */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60 mb-4">Choisir un plan</p>
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-xl border px-4 py-5 flex flex-col gap-4 transition-all ${
                plan.highlight
                  ? "border-brand bg-brand/3 shadow-sm shadow-brand/10"
                  : "border-hairline bg-background"
              } ${currentPlan === plan.id ? "ring-2 ring-brand/30" : ""}`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Recommandé
                </span>
              )}

              <div>
                <p className="text-sm font-semibold text-ink">{plan.name}</p>
                <p className="text-xs text-ink-soft mt-0.5">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink tabular-nums">{plan.price}</span>
                <span className="text-xs text-ink-soft">{plan.period}</span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-ink-soft">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`mt-auto rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  currentPlan === plan.id
                    ? "bg-muted text-ink-soft cursor-default"
                    : plan.highlight
                    ? "bg-brand text-white hover:bg-brand/90"
                    : "border border-hairline bg-background text-ink hover:border-ink/20"
                }`}
                disabled={currentPlan === plan.id}
              >
                {currentPlan === plan.id ? "Plan actuel" : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing info */}
      <div className="rounded-xl border border-hairline bg-background divide-y divide-hairline">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Moyen de paiement</p>
            <p className="text-xs text-ink-soft mt-0.5">Aucune carte enregistrée</p>
          </div>
          <button className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted transition-colors">
            Ajouter
          </button>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Factures</p>
            <p className="text-xs text-ink-soft mt-0.5">Aucune facture pour l&apos;instant</p>
          </div>
          <button className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-muted transition-colors">
            Voir tout
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-soft/50 text-center">
        Questions sur la facturation ?{" "}
        <a href="mailto:hello@searchmind.fr" className="underline hover:text-ink-soft transition-colors">
          hello@searchmind.fr
        </a>
      </p>
    </div>
  );
}
