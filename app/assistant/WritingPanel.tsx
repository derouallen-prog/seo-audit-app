"use client";

import React, { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WritingConfig {
  subject: string;
  keyword: string;
  audience: string;
  format: "guide_informationnel" | "comparatif" | "page_conseil_transactionnelle" | "actualite";
  searchIntent: "informationnelle" | "commerciale" | "transactionnelle" | "navigationnelle";
  readerLevel: "débutant" | "intermédiaire" | "expert";
  length: "short" | "standard" | "long";
  tone: string;
  language: string;
  clientSite: string;
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
// Émet le format exact "=== BRIEF DE RÉDACTION ===" attendu par l'assistant (Voie 1 du Socle
// commun SEO/GEO) : les champs sont transmis tels quels à generate_article, sans ré-interprétation.

const FORMAT_LABELS: Record<WritingConfig["format"], string> = {
  guide_informationnel: "Guide informationnel",
  comparatif: "Comparatif",
  page_conseil_transactionnelle: "Page conseil transactionnelle",
  actualite: "Actualité ou réaction à une mise à jour",
};
const LENGTH_WORDS: Record<WritingConfig["length"], string> = {
  short: "500 à 1 000 mots",
  standard: "1 000 à 2 200 mots",
  long: "2 200 à 4 000 mots",
};

export function buildArticlePrompt(c: WritingConfig): string {
  const lines = ["=== BRIEF DE RÉDACTION ===", ""];
  lines.push(`Sujet : ${c.subject}`);
  lines.push(`Mot-clé principal : ${c.keyword || "à déduire du sujet"}`);
  lines.push(`Format : ${FORMAT_LABELS[c.format]}`);
  lines.push(`Intention de recherche dominante : ${c.searchIntent}`);
  lines.push(`Niveau du lecteur : ${c.readerLevel}`);
  lines.push(`Ton : ${c.tone || "expert et direct"}`);
  lines.push(`Longueur visée : ${LENGTH_WORDS[c.length]}`);
  lines.push(`Client / site concerné : ${c.clientSite || "générique"}`);
  if (c.audience) lines.push(`Précision sur l'audience : ${c.audience}`);
  lines.push(`Langue : ${c.language}`);
  return lines.join("\n");
}

// ── KeywordField ──────────────────────────────────────────────────────────────

function KeywordField({
  value,
  onChange,
  onGenerate,
  generating,
  suggestions,
  onPickSuggestion,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
  suggestions: string[];
  onPickSuggestion: (v: string) => void;
  error: string | null;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Mot-clé principal</label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled || generating}
          title={disabled ? "Renseignez le sujet d'abord" : "Générer des suggestions avec l'IA"}
          className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {generating ? (
            <>
              <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Génération…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              Générer avec l&apos;IA
            </>
          )}
        </button>
      </div>

      <div className={`relative flex items-center rounded-xl border bg-white transition ${value ? "border-brand/40" : "border-hairline"}`}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="ex. : canapé modulable appartement"
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="mr-2 h-5 w-5 rounded-full bg-ink/10 text-ink-soft hover:bg-ink/20 hover:text-ink transition grid place-items-center shrink-0"
            title="Effacer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-medium text-ink-soft uppercase tracking-wide">Suggestions — cliquez pour sélectionner :</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((kw) => {
              const selected = value === kw;
              return (
                <button
                  key={kw}
                  type="button"
                  onClick={() => onPickSuggestion(kw)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${selected ? "border-brand bg-brand text-white shadow-sm" : "border-brand/30 bg-brand-soft text-brand hover:border-brand hover:bg-brand/10"}`}
                >
                  {selected && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 12 2 2 4-4"/></svg>
                  )}
                  {kw}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
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
    format: "guide_informationnel",
    searchIntent: "informationnelle",
    readerLevel: "intermédiaire",
    length: "standard",
    tone: "",
    language: "fr-FR",
    clientSite: "",
  });

  const set = (patch: Partial<WritingConfig>) => setConfig(c => ({ ...c, ...patch }));

  // Pré-remplit le site concerné depuis le sélecteur de site actif, sans écraser une saisie déjà faite.
  useEffect(() => {
    fetch("/api/sites")
      .then(r => r.ok ? r.json() : null)
      .then((d: { active?: { label?: string } | null } | null) => {
        if (d?.active?.label) set({ clientSite: d.active.label });
      })
      .catch(() => {});
  }, []);

  // Keyword suggestion state
  const [generatingKw, setGeneratingKw] = useState(false);
  const [suggestedKws, setSuggestedKws] = useState<string[]>([]);
  const [kwError, setKwError] = useState<string | null>(null);

  async function generateKeyword() {
    if (!config.subject.trim()) return;
    setGeneratingKw(true);
    setSuggestedKws([]);
    setKwError(null);
    try {
      const res = await fetch("/api/suggest-keyword", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: config.subject, language: config.language }),
      });
      const data = await res.json() as { keywords?: string[]; error?: string };
      if (data.keywords?.length) {
        setSuggestedKws(data.keywords);
      } else {
        setKwError("Impossible de générer des suggestions.");
      }
    } catch {
      setKwError("Erreur réseau.");
    } finally {
      setGeneratingKw(false);
    }
  }

  const formats: { id: WritingConfig["format"]; label: string; desc: string }[] = [
    { id: "guide_informationnel", label: "Guide informationnel", desc: "Expliquer un sujet à quelqu'un qui le découvre" },
    { id: "comparatif", label: "Comparatif", desc: "Opposer des options et aider à trancher" },
    { id: "page_conseil_transactionnelle", label: "Page conseil", desc: "Réponse pratique pour quelqu'un proche de l'achat" },
    { id: "actualite", label: "Actualité", desc: "Événement daté et son implication" },
  ];
  const searchIntents: { id: WritingConfig["searchIntent"]; label: string }[] = [
    { id: "informationnelle", label: "Informationnelle" },
    { id: "commerciale", label: "Commerciale" },
    { id: "transactionnelle", label: "Transactionnelle" },
    { id: "navigationnelle", label: "Navigationnelle" },
  ];
  const readerLevels: { id: WritingConfig["readerLevel"]; label: string }[] = [
    { id: "débutant", label: "Débutant" },
    { id: "intermédiaire", label: "Intermédiaire" },
    { id: "expert", label: "Expert" },
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
  }: { name: string; options: { id: T; label: string; desc?: string }[]; value: T; onChange: (v: T) => void }) => (
    <div className="space-y-1.5">
      {options.map(opt => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition ${value === opt.id ? "border-brand bg-brand-soft/40" : "border-hairline hover:border-ink/20"}`}
        >
          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${value === opt.id ? "border-brand" : "border-hairline"}`}>
            {value === opt.id && <div className="h-2 w-2 rounded-full bg-brand" />}
          </div>
          <span className="min-w-0">
            <span className={`block text-sm ${value === opt.id ? "font-medium text-brand" : "text-ink"}`}>{opt.label}</span>
            {opt.desc && <span className="block text-xs text-ink-soft">{opt.desc}</span>}
          </span>
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
            <h2 className="text-base font-bold text-ink mt-0.5">Configurer le contenu</h2>
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink transition rounded-lg p-1.5 hover:bg-accent">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* ── Étape 1 : choix ── */}
          {step === "choice" && (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft">Comment souhaitez-vous configurer votre contenu ?</p>
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
                    desc: "Format, intention de recherche, niveau du lecteur, longueur, ton",
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
                  onChange={e => { set({ subject: e.target.value }); setSuggestedKws([]); }}
                  placeholder="ex. : Comment choisir un canapé modulable pour petit appartement"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40"
                />
              </div>
              <KeywordField
                value={config.keyword}
                onChange={kw => set({ keyword: kw })}
                onGenerate={generateKeyword}
                generating={generatingKw}
                suggestions={suggestedKws}
                onPickSuggestion={kw => { set({ keyword: kw }); setSuggestedKws([]); }}
                error={kwError}
                disabled={!config.subject.trim()}
              />
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
                  Générer le contenu →
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 2b : guidé ── */}
          {step === "suggested" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Sujet / Requête cible *</label>
                <input autoFocus value={config.subject} onChange={e => { set({ subject: e.target.value }); setSuggestedKws([]); }}
                  placeholder="ex. : Modular furniture buying guide 2026"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40" />
              </div>
              <KeywordField
                value={config.keyword}
                onChange={kw => set({ keyword: kw })}
                onGenerate={generateKeyword}
                generating={generatingKw}
                suggestions={suggestedKws}
                onPickSuggestion={kw => { set({ keyword: kw }); setSuggestedKws([]); }}
                error={kwError}
                disabled={!config.subject.trim()}
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Format</label>
                <RadioList name="format" options={formats} value={config.format} onChange={v => set({ format: v })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Intention de recherche</label>
                <RadioList name="searchIntent" options={searchIntents} value={config.searchIntent} onChange={v => set({ searchIntent: v })} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Niveau du lecteur</label>
                <RadioList name="readerLevel" options={readerLevels} value={config.readerLevel} onChange={v => set({ readerLevel: v })} />
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
                <p className="mt-1.5 text-[11px] text-ink-soft">Cette longueur prime sur la fourchette par défaut du format choisi.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Ton</label>
                <input value={config.tone} onChange={e => set({ tone: e.target.value })}
                  placeholder="ex. : Expert, bienveillant, sans jargon"
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft mb-1.5">Client / site concerné</label>
                <input value={config.clientSite} onChange={e => set({ clientSite: e.target.value })}
                  placeholder="ex. : monsite.fr, ou générique si non précisé"
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
                  Générer le contenu →
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
