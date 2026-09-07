"use client";

import React, { useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WritingConfig {
  subject: string;
  keyword: string;
  audience: string;
  contentType: "blog" | "product" | "landing";
  contentFocus: "concept" | "howto" | "comparison" | "list" | "opinion";
  length: "short" | "standard" | "long";
  brandVoice: string;
  language: string;
}

interface ContentAnalysis {
  wordCount: number;
  sectionCount: number;
  h2s: string[];
  h3s: string[];
  links: number;
  keywordCount: number;
  keywordDensity: number;
  overallScore: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET_WORDS: Record<WritingConfig["length"], number> = {
  short: 750,
  standard: 1600,
  long: 3000,
};
const TARGET_SECTIONS: Record<WritingConfig["length"], number> = {
  short: 3,
  standard: 6,
  long: 9,
};

// ── Analysis ──────────────────────────────────────────────────────────────────

function analyzeContent(text: string, keyword: string, targetWords: number, targetSections: number): ContentAnalysis {
  if (!text.trim()) {
    return { wordCount: 0, sectionCount: 0, h2s: [], h3s: [], links: 0, keywordCount: 0, keywordDensity: 0, overallScore: 0 };
  }
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const h2s = (text.match(/^## .+/gm) ?? []).map(h => h.replace(/^## /, ""));
  const h3s = (text.match(/^### .+/gm) ?? []).map(h => h.replace(/^### /, ""));
  const links = (text.match(/\[.+?\]\(.+?\)/g) ?? []).length;
  const kw = keyword.toLowerCase().trim();
  const keywordCount = kw
    ? (text.toLowerCase().match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length
    : 0;
  const keywordDensity = wordCount > 0 && kw ? (keywordCount / wordCount) * 100 : 0;

  let pts = 0;
  pts += Math.round(Math.min(wordCount / targetWords, 1) * 30);
  pts += Math.round(Math.min(h2s.length / targetSections, 1) * 25);
  if (keywordCount > 0) pts += 15;
  if (keywordDensity >= 0.5 && keywordDensity <= 2.5) pts += 10;
  if (links > 0) pts += 10;
  if (h3s.length > 0) pts += 10;

  return { wordCount, sectionCount: h2s.length, h2s, h3s, links, keywordCount, keywordDensity, overallScore: Math.min(pts, 100) };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildArticlePrompt(c: WritingConfig): string {
  const lengthDesc =
    c.length === "short" ? "court (500-1000 mots)" :
    c.length === "standard" ? "standard (1000-2200 mots)" :
    "long (2200-4000 mots)";
  const focusDesc =
    c.contentFocus === "concept" ? "expliquer un concept" :
    c.contentFocus === "howto" ? "guide pratique (how-to)" :
    c.contentFocus === "comparison" ? "comparatif" :
    c.contentFocus === "list" ? "article liste" :
    "article d'opinion / point de vue";
  const typeDesc =
    c.contentType === "blog" ? "article de blog" :
    c.contentType === "product" ? "fiche produit" :
    "landing page";
  const sections = TARGET_SECTIONS[c.length];

  let p = `Génère un ${typeDesc} SEO complet et optimisé sur le sujet suivant :\n\n`;
  p += `**Sujet :** ${c.subject}\n`;
  if (c.keyword) p += `**Mot-clé principal :** ${c.keyword}\n`;
  if (c.audience) p += `**Public cible :** ${c.audience}\n`;
  p += `**Format :** ${focusDesc}, longueur ${lengthDesc}\n`;
  if (c.brandVoice) p += `**Voix de marque :** ${c.brandVoice}\n`;
  if (c.language) p += `**Langue :** ${c.language}\n`;
  p += `\nStructure attendue : 1 H1, ${sections} H2 minimum, sous-sections H3 si pertinent, introduction et conclusion. `;
  p += `Inclure au moins 2 liens internes suggérés (en texte d'ancre entre crochets). `;
  p += `Terminer avec : balise title optimisée (30-65 car.) et meta description (120-155 car.).`;
  return p;
}

// ── WritingSetupModal ─────────────────────────────────────────────────────────

export function WritingSetupModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (config: WritingConfig) => void;
}) {
  const [step, setStep] = useState<"choice" | "manual" | "suggested">("choice");
  const [config, setConfig] = useState<WritingConfig>({
    subject: "",
    keyword: "",
    audience: "",
    contentType: "blog",
    contentFocus: "concept",
    length: "standard",
    brandVoice: "",
    language: "fr-FR",
  });

  const set = (patch: Partial<WritingConfig>) => setConfig(c => ({ ...c, ...patch }));

  const contentTypes: { id: WritingConfig["contentType"]; label: string }[] = [
    { id: "blog", label: "Article de blog" },
    { id: "product", label: "Fiche produit" },
    { id: "landing", label: "Landing page" },
  ];
  const contentFocuses: { id: WritingConfig["contentFocus"]; label: string }[] = [
    { id: "concept", label: "Expliquer un concept" },
    { id: "howto", label: "Guide pratique (how-to)" },
    { id: "comparison", label: "Comparatif" },
    { id: "list", label: "Article liste" },
    { id: "opinion", label: "Point de vue / opinion" },
  ];
  const lengths: { id: WritingConfig["length"]; label: string; detail: string }[] = [
    { id: "short", label: "Court", detail: "500–1 000 mots" },
    { id: "standard", label: "Standard", detail: "1 000–2 200 mots" },
    { id: "long", label: "Long", detail: "2 200–4 000 mots" },
  ];
  const languages = [
    { value: "fr-FR", label: "Français (FR)" },
    { value: "en-US", label: "Anglais (US)" },
    { value: "en-GB", label: "Anglais (UK)" },
    { value: "es-ES", label: "Espagnol (ES)" },
    { value: "de-DE", label: "Allemand (DE)" },
  ];

  const RadioList = <T extends string>({
    name, options, value, onChange,
  }: { name: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
    <div className="space-y-1.5">
      {options.map(opt => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition ${value === opt.id ? "border-brand bg-brand-soft/40" : "border-hairline hover:border-ink/20"}`}
        >
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${value === opt.id ? "border-brand" : "border-hairline"}`}>
            {value === opt.id && <div className="h-2 w-2 rounded-full bg-brand" />}
          </div>
          <span className={`text-sm ${value === opt.id ? "font-medium text-brand" : "text-ink"}`}>{opt.label}</span>
          <input type="radio" name={name} value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} className="hidden" />
        </label>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-background border border-hairline shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-brand-soft/40">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Rédaction IA</p>
            <h2 className="text-base font-bold text-ink mt-0.5">Configurer l&apos;article</h2>
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink transition rounded-lg p-1.5 hover:bg-accent">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* ── Étape 1 : choix ── */}
          {step === "choice" && (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft">Comment souhaitez-vous configurer votre article ?</p>
              <div className="grid gap-3">
                {[
                  {
                    target: "manual" as const,
                    emoji: "✏️",
                    title: "Je configure moi-même",
                    desc: "Sujet, mot-clé principal, public cible",
                  },
                  {
                    target: "suggested" as const,
                    emoji: "⚡",
                    title: "Setup guidé",
                    desc: "Type, focus éditorial, longueur, langue, voix de marque",
                  },
                ].map(({ target, emoji, title, desc }) => (
                  <button
                    key={target}
                    onClick={() => setStep(target)}
                    className="flex items-center gap-4 rounded-xl border border-hairline bg-white px-5 py-4 text-left hover:border-brand/40 hover:bg-brand-soft/30 transition group"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-soft flex items-center justify-center text-lg group-hover:scale-105 transition-transform">{emoji}</div>
                    <div>
                      <p className="font-semibold text-ink text-sm">{title}</p>
                      <p className="text-xs text-ink-soft mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Étape 2a : manuel ── */}
          {step === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Sujet de l&apos;article *</label>
                <input
                  autoFocus
                  value={config.subject}
                  onChange={e => set({ subject: e.target.value })}
                  placeholder="ex. : Comment choisir un canapé modulable pour petit appartement"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Mot-clé principal</label>
                <input
                  value={config.keyword}
                  onChange={e => set({ keyword: e.target.value })}
                  placeholder="ex. : canapé modulable appartement"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Public cible</label>
                <input
                  value={config.audience}
                  onChange={e => set({ audience: e.target.value })}
                  placeholder="ex. : Locataires de studio, budget 500–1500€"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Longueur cible</label>
                <div className="grid grid-cols-3 gap-2">
                  {lengths.map(({ id, label, detail }) => (
                    <button key={id} type="button" onClick={() => set({ length: id })}
                      className={`flex flex-col items-center rounded-xl border px-2 py-3 transition ${config.length === id ? "border-brand bg-brand-soft/40 text-brand" : "border-hairline hover:border-ink/20 text-ink"}`}>
                      <span className="text-sm font-semibold">{label}</span>
                      <span className={`text-[10px] mt-0.5 ${config.length === id ? "text-brand/70" : "text-ink-soft"}`}>{detail}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep("choice")} className="flex-1 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-accent transition">Retour</button>
                <button onClick={() => onSubmit(config)} disabled={!config.subject.trim()}
                  className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition">
                  Générer l&apos;article →
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 2b : guidé ── */}
          {step === "suggested" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Sujet / Requête cible *</label>
                <input autoFocus value={config.subject} onChange={e => set({ subject: e.target.value })}
                  placeholder="ex. : Modular furniture buying guide 2026"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Mot-clé principal</label>
                <input value={config.keyword} onChange={e => set({ keyword: e.target.value })}
                  placeholder="ex. : modular sofa buying guide"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Type de contenu</label>
                <RadioList name="contentType" options={contentTypes} value={config.contentType} onChange={v => set({ contentType: v })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Focus éditorial</label>
                <RadioList name="contentFocus" options={contentFocuses} value={config.contentFocus} onChange={v => set({ contentFocus: v })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Longueur de l&apos;article</label>
                <div className="grid grid-cols-3 gap-2">
                  {lengths.map(({ id, label, detail }) => (
                    <button key={id} type="button" onClick={() => set({ length: id })}
                      className={`flex flex-col items-center rounded-xl border px-2 py-3 transition ${config.length === id ? "border-brand bg-brand-soft/40 text-brand" : "border-hairline hover:border-ink/20 text-ink"}`}>
                      <span className="text-sm font-semibold">{label}</span>
                      <span className={`text-[10px] mt-0.5 ${config.length === id ? "text-brand/70" : "text-ink-soft"}`}>{detail}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Voix de marque</label>
                <input value={config.brandVoice} onChange={e => set({ brandVoice: e.target.value })}
                  placeholder="ex. : Expert, bienveillant, sans jargon"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Langue & marché</label>
                <select value={config.language} onChange={e => set({ language: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand/40">
                  {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep("choice")} className="flex-1 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-accent transition">Retour</button>
                <button onClick={() => onSubmit(config)} disabled={!config.subject.trim()}
                  className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition">
                  Générer l&apos;article →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EditorToolbar ─────────────────────────────────────────────────────────────

export function EditorToolbar({ wordCount }: { wordCount: number }) {
  const Btn = ({ children, title, className = "" }: { children: React.ReactNode; title: string; className?: string }) => (
    <button type="button" title={title}
      className={`h-7 min-w-[28px] px-1.5 rounded text-xs text-ink-soft hover:bg-accent hover:text-ink transition-colors ${className}`}>
      {children}
    </button>
  );
  const Sep = () => <div className="w-px h-4 bg-hairline mx-1 shrink-0" />;

  return (
    <div className="flex items-center gap-0.5 border-b border-hairline bg-background/80 px-3 py-1.5 overflow-x-auto shrink-0 backdrop-blur-sm">
      <Btn title="Gras" className="font-bold">B</Btn>
      <Btn title="Italique" className="italic">I</Btn>
      <Btn title="Barré" className="line-through">S</Btn>
      <Btn title="Code inline" className="font-mono text-[10px]">&lt;/&gt;</Btn>
      <Sep />
      <Btn title="Titre H1" className="font-semibold text-[11px]">H1</Btn>
      <Btn title="Titre H2" className="font-semibold text-[11px]">H2</Btn>
      <Btn title="Titre H3" className="font-semibold text-[11px]">H3</Btn>
      <Sep />
      <button type="button" title="Liste à puces" className="h-7 w-7 rounded text-ink-soft hover:bg-accent hover:text-ink transition-colors grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
      </button>
      <button type="button" title="Liste numérotée" className="h-7 w-7 rounded text-ink-soft hover:bg-accent hover:text-ink transition-colors grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10H6"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
      </button>
      <button type="button" title="Lien" className="h-7 w-7 rounded text-ink-soft hover:bg-accent hover:text-ink transition-colors grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <div className="flex-1" />
      <span className="text-xs text-ink-soft font-mono tabular-nums shrink-0">{wordCount.toLocaleString("fr-FR")} mots</span>
      <Sep />
      <button type="button" title="Annuler" className="h-7 w-7 rounded text-ink-soft hover:bg-accent hover:text-ink transition-colors grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.5-6.22"/></svg>
      </button>
      <button type="button" title="Rétablir" className="h-7 w-7 rounded text-ink-soft hover:bg-accent hover:text-ink transition-colors grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.5-6.22"/></svg>
      </button>
    </div>
  );
}

// ── WritingChecklist ──────────────────────────────────────────────────────────

export function WritingChecklist({
  content,
  config,
}: {
  content: string;
  config: WritingConfig;
}) {
  const targetWords = TARGET_WORDS[config.length];
  const targetSections = TARGET_SECTIONS[config.length];

  const a = useMemo(
    () => analyzeContent(content, config.keyword, targetWords, targetSections),
    [content, config.keyword, targetWords, targetSections]
  );

  const wordsPct = Math.min(Math.round((a.wordCount / targetWords) * 100), 100);
  const coveragePct = Math.min(Math.round((a.sectionCount / targetSections) * 100), 100);
  const overallPct = a.overallScore;
  const gaugeColor = overallPct >= 70 ? "#22c55e" : overallPct >= 40 ? "#f59e0b" : overallPct > 0 ? "#ef4444" : "#d1d5db";

  // Gauge: SVG semi-circle
  const gaugeArcLen = 157; // approx π*50 for r=50

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-4">
      {/* Overall gauge */}
      <div className="rounded-xl border border-hairline bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft mb-3 text-center">Overall</p>
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-20">
            <svg viewBox="0 0 120 64" className="w-full h-full">
              <path d="M 10,60 A 50,50 0 0,1 110,60" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
              <path
                d="M 10,60 A 50,50 0 0,1 110,60"
                fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(overallPct / 100) * gaugeArcLen} ${gaugeArcLen}`}
                style={{ transition: "stroke-dasharray 0.7s ease" }}
              />
              <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="bold" fill={overallPct > 0 ? gaugeColor : "#9ca3af"}>
                {overallPct > 0 ? overallPct : "—"}
              </text>
            </svg>
          </div>
          <p className="text-xs text-ink-soft mt-1">{overallPct > 0 ? "Score de rédaction /100" : "Calcul du score en cours…"}</p>
        </div>

        {/* KPI grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-4">
          {[
            { label: "Sections", value: String(a.sectionCount), sub: `/${targetSections}` },
            { label: "Couverture", value: `${coveragePct}%`, sub: "" },
            { label: "Mots", value: a.wordCount.toLocaleString("fr-FR"), sub: `/${targetWords.toLocaleString("fr-FR")}` },
            { label: "Liens", value: String(a.links), sub: "" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-hairline px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
              <p className="text-base font-bold text-ink mt-0.5 tabular-nums leading-none">
                {value}<span className="text-xs font-normal text-ink-soft">{sub}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mot-clé */}
      {config.keyword && (
        <div className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft mb-2">Mot-clé principal</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              ★ {config.keyword} {a.keywordCount > 0 ? "1" : "0"}
            </span>
            {a.keywordCount > 0 ? (
              <span className="text-xs text-green-600 font-medium">{a.keywordCount}× · {a.keywordDensity.toFixed(1)}%</span>
            ) : (
              <span className="text-xs text-ink-soft">Pas encore présent</span>
            )}
          </div>
        </div>
      )}

      {/* Couverture thématique */}
      <div className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Couverture thématique</p>
          <span className="text-xs font-bold text-ink">{coveragePct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${coveragePct}%` }} />
        </div>
        {/* Words progress */}
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-soft mb-1">Progression des mots</p>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${wordsPct}%`, background: wordsPct >= 100 ? "#22c55e" : wordsPct >= 60 ? "#f59e0b" : "#5d34ff" }} />
        </div>
        <div className="flex justify-between text-[10px] text-ink-soft">
          <span>{a.wordCount.toLocaleString("fr-FR")} mots</span>
          <span>Cible : {targetWords.toLocaleString("fr-FR")}</span>
        </div>
      </div>

      {/* Structure Hn */}
      <div className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft mb-3">Structure</p>
        <ul className="space-y-1.5">
          {a.h2s.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded bg-green-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 12 2 2 4-4"/></svg>
              </span>
              <span className="text-xs font-medium text-ink leading-tight pt-0.5">H2 — {h}</span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, targetSections - a.h2s.length) }).map((_, i) => (
            <li key={`ph-${i}`} className="flex items-start gap-2 opacity-35">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded border border-dashed border-hairline flex items-center justify-center">
                <span className="text-[8px] text-ink-soft font-bold">H2</span>
              </span>
              <span className="text-xs text-ink-soft leading-tight pt-0.5 italic">Section à venir…</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Config recap */}
      <div className="rounded-xl border border-hairline bg-white p-4 shadow-sm space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft mb-2">Paramètres</p>
        {[
          { label: "Sujet", value: config.subject || "—" },
          { label: "Longueur cible", value: config.length === "short" ? "Court · 500-1k mots" : config.length === "standard" ? "Standard · 1-2.2k mots" : "Long · 2.2-4k mots" },
          { label: "Langue", value: config.language },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <span className="text-xs text-ink-soft shrink-0">{label}</span>
            <span className="text-xs font-medium text-ink text-right truncate max-w-[140px]" title={value}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
