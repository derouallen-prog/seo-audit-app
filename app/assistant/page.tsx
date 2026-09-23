"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { WritingSetupModal, WritingChecklist, EditorToolbar, buildArticlePrompt } from "./WritingPanel";
import { RedditSetupModal, ProductSetupModal, ContentPlanSetupModal, PublicationCMSModal, WpConnectModal } from "./ToolSetupModals";
import type { WritingConfig } from "./WritingPanel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;        // full content sent to Claude (includes file text)
  _display?: string;      // text shown in the UI bubble (without file content)
  _attachments?: string[]; // file names shown as chips
}

interface SessionMeta {
  id: string;
  title: string;
  updated_at: string;
  audit_id?: string | null;
}

interface PendingFile {
  id: string;
  name: string;
  mimeType: string;
  textContent?: string;
  dataUrl?: string;
}

// ── SVG icons ────────────────────────────────────────────────────────────────

function IconSparkles({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>
    </svg>
  );
}

function IconChartColumn({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  );
}

function IconFileSearch({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/>
      <path d="m9 18-1.5-1.5"/><circle cx="5" cy="14" r="3"/>
    </svg>
  );
}

function IconGlobe({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  );
}

function IconWandSparkles({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/>
      <path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/>
      <path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>
    </svg>
  );
}

function IconArrowUp({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
    </svg>
  );
}

function IconPlus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconTrash({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function IconMessage({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconPenLine({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
}

function IconPackage({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  );
}

function IconUploadCloud({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

function IconSearch({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function IconPanelLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>
    </svg>
  );
}

function IconReddit({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M14.5 9a3.5 3.5 0 0 1 0 6"/><path d="M9.5 9a3.5 3.5 0 0 0 0 6"/><path d="M12 6v2"/><circle cx="12" cy="5" r="1"/>
    </svg>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

interface Tool { label: string; icon: React.ReactNode; desc: string; prompt: string; featured?: boolean }

const TOOLS: Tool[] = [
  // ── Top 3 : outils de création/publication ────────────────────────────────
  {
    label: "Génération article",
    icon: <IconPenLine />,
    desc: "Article SEO & GEO complet",
    prompt: "Génère un article de blog complet et optimisé SEO pour mon site. Demande-moi le sujet, le mot-clé principal et le public cible si tu ne les connais pas encore.",
    featured: true,
  },
  {
    label: "Fiche produit",
    icon: <IconPackage />,
    desc: "Fiche e-commerce optimisée",
    prompt: "Génère une fiche produit e-commerce complète et optimisée SEO (600-900 mots, title, meta, description structurée). Demande-moi le nom du produit et ses caractéristiques si tu ne les connais pas.",
    featured: true,
  },
  {
    label: "Publication CMS",
    icon: <IconUploadCloud />,
    desc: "Publier sur WordPress / WooCommerce",
    prompt: "Je veux publier du contenu sur mon site WordPress ou WooCommerce. Dis-moi quel type de contenu (article, page, fiche produit, catégorie) et je m'en occupe directement depuis l'assistant.",
    featured: true,
  },
  // ── Outils data & analyse ─────────────────────────────────────────────────
  {
    label: "Analyse de SERP",
    icon: <IconChartColumn />,
    desc: "Analyse le top 10 Google sur un mot-clé : intentions de recherche, featured snippets, PAA, structure des résultats et opportunités de positionnement.",
    prompt: "Lance une analyse SERP sur les mots-clés principaux de mon site. Pour chaque mot-clé : identifie l'intention de recherche, décris la structure des résultats (featured snippets, PAA, ads, local pack) et note les opportunités de positionnement.",
  },
  {
    label: "Suggestion de mots-clés longue traîne",
    icon: <IconFileSearch />,
    desc: "Identifie des mots-clés à faible concurrence et fort potentiel, regroupés par thématique, avec volume et intention.",
    prompt: "Identifie des mots-clés de longue traîne à fort potentiel pour mon site. Priorise les requêtes à faible concurrence avec une intention commerciale ou informationnelle claire, et regroupe-les par thématique.",
  },
  {
    label: "Ranking domaine",
    icon: <IconSearch />,
    desc: "Vérifie les positions actuelles du domaine sur ses mots-clés : position Google, URL rankée, volume estimé et variations récentes.",
    prompt: "Vérifie les positions actuelles de mon site sur ses mots-clés principaux. Indique pour chaque mot-clé : la position, l'URL rankée, le volume estimé et les variations récentes si disponibles.",
  },
  {
    label: "Trouver des opportunités de backlinks",
    icon: <IconGlobe />,
    desc: "Analyse les profils de liens des concurrents et identifie les sources les plus pertinentes à cibler pour une stratégie de netlinking.",
    prompt: "Analyse les backlinks des principaux concurrents de mon domaine. Identifie les sources de liens les plus intéressantes à cibler pour une stratégie de netlinking.",
  },
  {
    label: "Obtenir des données organic de la GSC",
    icon: <IconChartColumn />,
    desc: "Récupère depuis Google Search Console les top requêtes, clics, impressions et positions moyennes du site connecté.",
    prompt: "Récupère les données Google Search Console de mon site : top requêtes, pages associées, clics, impressions et positions moyennes. Donne-moi le domaine si je ne le connais pas encore.",
  },
  {
    label: "Données Semrush",
    icon: <IconChartColumn />,
    desc: "Extrait depuis Semrush les mots-clés organiques du domaine, ses top pages et son profil de backlinks pour identifier forces et faiblesses.",
    prompt: "Analyse les données Semrush pour mon domaine : mots-clés positionnés, top pages organiques et profil de backlinks. Donne-moi le domaine si je ne le connais pas encore.",
  },
  {
    label: "Popularité mots-clés et marque sur Reddit",
    icon: <IconReddit />,
    desc: "Analyse les discussions Reddit pour extraire le vocabulaire réel des internautes, leurs pain points, questions et opportunités de ninja linking.",
    prompt: "",
  },
  {
    label: "Rédiger un plan de contenu",
    icon: <IconWandSparkles />,
    desc: "Construit un plan éditorial complet avec page pilier et articles satellites, mots-clés cibles, intentions et maillage interne.",
    prompt: "",
  },
  {
    label: "Stratégie SEO",
    icon: <IconSparkles className="h-3.5 w-3.5" />,
    desc: "Génère un plan d'action SEO global et priorisé : technique, contenu, netlinking, maillage interne, SEO local et GEO. Chaque recommandation est classée par impact et urgence.",
    prompt: "Génère un plan stratégique SEO complet et priorisé pour mon site. Couvre les axes : SEO technique, contenu, netlinking, maillage interne, SEO local et GEO. Pour chaque axe : actions concrètes, impact estimé et ordre de priorité.",
  },
];

interface AnimatedSuggestion {
  prefix: string;
  suffix: string;
  variants: string[];
  icon: React.ReactNode;
  promptTemplate: (kw: string) => string;
}

const ANIMATED_SUGGESTIONS: AnimatedSuggestion[] = [
  {
    prefix: 'Analyser la SERP de "',
    suffix: '"',
    variants: ["veste imperméable homme", "guide d'achat poêle inox", "crème visage vegan", "chaussures trail running"],
    icon: <IconFileSearch className="h-4 w-4" />,
    promptTemplate: (kw) => `Analyse la SERP pour le mot-clé "${kw}"`,
  },
  {
    prefix: "Comparer mon domaine à ",
    suffix: "",
    variants: ["decathlon.fr", "sephora.fr", "maison-du-monde.fr", "cdiscount.com"],
    icon: <IconChartColumn className="h-4 w-4" />,
    promptTemplate: (kw) => `Compare mon domaine à ${kw} : trafic organique, mots-clés positionnés, et profil de backlinks`,
  },
  {
    prefix: 'Questions PAA sur "',
    suffix: '"',
    variants: ["nutrition sportive", "décoration scandinave", "randonnée légère", "vin naturel"],
    icon: <IconWandSparkles className="h-4 w-4" />,
    promptTemplate: (kw) => `Trouve les questions People Also Ask et la sémantique autour de "${kw}"`,
  },
  {
    prefix: "Mots-clés Google Ads pour ",
    suffix: "",
    variants: ["ma boutique de sport", "mon cabinet dentaire", "mon agence immo", "mon blog cuisine"],
    icon: <IconGlobe className="h-4 w-4" />,
    promptTemplate: (kw) => `Récupère les métriques Google Ads (volume, CPC, concurrence) pour les mots-clés de ${kw}`,
  },
];

// ── Markdown components ───────────────────────────────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="font-sans font-semibold text-xl text-ink mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="font-sans font-semibold text-lg text-ink mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-sm text-ink mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold text-xs text-ink mt-2 mb-1 first:mt-0 uppercase tracking-wide">{children}</h4>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-4 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic text-ink-soft">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark underline underline-offset-2">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-ink/5 p-3 text-xs font-mono my-2 whitespace-pre-wrap break-all">{children}</pre>
  ),
  code: ({ children }) => (
    <code className="bg-accent text-ink-soft rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
  ),
  hr: () => <hr className="border-hairline my-4" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand pl-3 text-sm text-ink-soft italic my-3">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 rounded-lg border border-hairline">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-brand text-white">{children}</thead>,
  th: ({ children }) => <th className="text-left font-semibold text-xs uppercase tracking-wide py-2 px-3">{children}</th>,
  td: ({ children }) => <td className="py-2 px-3 text-ink border-b border-hairline">{children}</td>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleFromMessage(text: string): string {
  const maxLen = 60;
  if (text.length <= maxLen) return text.trim();
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).trim();
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Export toolbar ────────────────────────────────────────────────────────────

function ExportBar({ content }: { content: string }) {
  function downloadMd() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reponse-mind.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyText() {
    navigator.clipboard.writeText(content).catch(() => {});
  }

  async function printPdf() {
    const win = window.open("", "_blank");
    if (!win) return;
    // Render markdown → HTML dynamically
    let html = content;
    try {
      const { marked } = await import("marked");
      html = await marked.parse(content);
    } catch {
      // fallback: escape and wrap in <pre> if marked fails
      html = `<pre style="white-space:pre-wrap">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Export Mind</title><style>
      body{font-family:system-ui,sans-serif;padding:2.5rem;max-width:820px;margin:auto;color:#111;line-height:1.65}
      h1{font-size:1.8rem;font-weight:700;margin:0 0 1.5rem;border-bottom:2px solid #e5e7eb;padding-bottom:.75rem}
      h2{font-size:1.25rem;font-weight:600;margin:2rem 0 .75rem;color:#1a1a2e}
      h3{font-size:1.05rem;font-weight:600;margin:1.5rem 0 .5rem}
      p{margin:.5rem 0 1rem}
      ul,ol{padding-left:1.5rem;margin:.5rem 0 1rem}
      li{margin:.3rem 0}
      strong{font-weight:600}
      pre{background:#f3f4f6;padding:1rem;border-radius:.5rem;overflow-x:auto;white-space:pre-wrap}
      code{background:#f3f4f6;padding:.1em .3em;border-radius:.2em;font-size:.875em}
      table{border-collapse:collapse;width:100%;margin:1rem 0}
      td,th{border:1px solid #e5e7eb;padding:.5rem .75rem;text-align:left}
      th{background:#f9fafb;font-weight:600}
      blockquote{border-left:3px solid #6366f1;margin:1rem 0;padding:.5rem 1rem;color:#555;background:#f9f9ff}
      @media print{body{padding:1rem}}
    </style></head><body>${html}</body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5 pl-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      <button
        onClick={copyText}
        title="Copier le texte"
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-ink-soft hover:text-ink hover:bg-accent transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        Copier
      </button>
      <button
        onClick={downloadMd}
        title="Télécharger en Markdown"
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-ink-soft hover:text-ink hover:bg-accent transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        .md
      </button>
      <button
        onClick={printPdf}
        title="Exporter en PDF"
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-ink-soft hover:text-ink hover:bg-accent transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
        PDF
      </button>
    </div>
  );
}

// ── Animated suggestion card ─────────────────────────────────────────────────

function AnimatedSuggestionCard({
  suggestion,
  onSelect,
  initialVariantIdx = 0,
}: {
  suggestion: AnimatedSuggestion;
  onSelect: (text: string) => void;
  initialVariantIdx?: number;
}) {
  const [variantIdx, setVariantIdx] = useState(initialVariantIdx % suggestion.variants.length);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "erasing">("typing");

  const currentVariant = suggestion.variants[variantIdx] ?? suggestion.variants[0] ?? "";

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (charCount < currentVariant.length) {
        t = setTimeout(() => setCharCount(c => c + 1), 55);
      } else {
        t = setTimeout(() => setPhase("hold"), 2200);
      }
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("erasing"), 400);
    } else {
      if (charCount > 0) {
        t = setTimeout(() => setCharCount(c => c - 1), 28);
      } else {
        setVariantIdx(i => (i + 1) % suggestion.variants.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(t);
  }, [phase, charCount, currentVariant]);

  function handleClick() {
    onSelect(suggestion.promptTemplate(currentVariant));
  }

  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-3 rounded-xl border border-hairline bg-background px-4 py-3 text-left text-sm text-ink transition-all hover:border-brand/40 hover:bg-brand-soft/40 cursor-pointer"
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand transition-transform group-hover:scale-105">
        {suggestion.icon}
      </div>
      <span className="flex-1 min-w-0 truncate">
        {suggestion.prefix}
        <span className="text-brand">{currentVariant.slice(0, charCount)}</span>
        <span className="inline-block w-0.5 h-3.5 bg-brand/70 animate-pulse align-middle mx-px" />
        {suggestion.suffix}
      </span>
    </button>
  );
}

// ── Tool tooltip ──────────────────────────────────────────────────────────────

function ToolTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLSpanElement>(null);
  const TIP_W = 176; // w-44

  function show() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const spaceRight = window.innerWidth - r.right - 8;
    if (spaceRight >= TIP_W) {
      setPos({ top: cy, left: r.right + 8 });
    } else {
      setPos({ top: cy, right: window.innerWidth - r.left + 8 });
    }
  }

  return (
    <span className="ml-auto shrink-0" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      <span
        ref={btnRef}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-hairline text-[10px] font-medium text-ink-soft cursor-help hover:border-brand/50 hover:text-brand transition-colors leading-none select-none"
      >
        ?
      </span>
      {pos && (
        <span
          className="pointer-events-none fixed z-[9999] w-44 -translate-y-1/2 rounded-xl bg-ink px-3 py-2 text-[11px] leading-relaxed text-white shadow-xl"
          style={{ top: pos.top, left: pos.left, right: pos.right }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── Source chips for tool status ──────────────────────────────────────────────

const SOURCE_CHIPS: { match: string; label: string; cls: string }[] = [
  { match: "DataForSEO", label: "DataForSEO", cls: "bg-orange-100 text-orange-700" },
  { match: "Google Ads", label: "Google Ads", cls: "bg-blue-100 text-blue-700" },
  { match: "Search Console", label: "GSC", cls: "bg-green-100 text-green-700" },
  { match: "Semrush", label: "Semrush", cls: "bg-red-100 text-red-700" },
  { match: "Reddit", label: "Reddit", cls: "bg-orange-100 text-orange-600" },
  { match: "Business Profile", label: "GBP", cls: "bg-yellow-100 text-yellow-700" },
  { match: "LLMs", label: "Perplexity / Gemini", cls: "bg-purple-100 text-purple-700" },
  { match: "KPU", label: "KPU", cls: "bg-teal-100 text-teal-700" },
  { match: "WordPress", label: "WordPress", cls: "bg-sky-100 text-sky-700" },
  { match: "WooCommerce", label: "WooCommerce", cls: "bg-violet-100 text-violet-700" },
];

function getSourceChips(status: string) {
  return SOURCE_CHIPS.filter(c => status.includes(c.match));
}

// ── Component ─────────────────────────────────────────────────────────────────

function AssistantPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("auditId");
  const sessionParam = searchParams.get("session");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Writing mode
  const [writingMode, setWritingMode] = useState(false);
  const [showWritingSetup, setShowWritingSetup] = useState(false);
  const [showRedditSetup, setShowRedditSetup] = useState(false);
  const [showProductSetup, setShowProductSetup] = useState(false);
  const [showContentPlanSetup, setShowContentPlanSetup] = useState(false);
  const [writingConfig, setWritingConfig] = useState<WritingConfig | null>(null);

  // Sidebar resize + visibility
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const isResizingRef = useRef(false);

  // Session context menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Session search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // CMS modal
  const [showPublicationCMSSetup, setShowPublicationCMSSetup] = useState(false);

  // Attach panel (+ button)
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [cmsEnabled, setCmsEnabled] = useState(false);
  const [gscEnabled, setGscEnabled] = useState(false);
  const [showCmsModal, setShowCmsModal] = useState(false);
  const [cmsExpanded, setCmsExpanded] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [showWpModalFromPanel, setShowWpModalFromPanel] = useState(false);

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const sessionIdRef = useRef<string | null>(sessionParam);

  // Keep ref in sync
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json() as SessionMeta[];
        setSessions(data);
      }
    } catch { /* silently ignore */ }
    setSessionsLoaded(true);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load session from URL param on mount
  useEffect(() => {
    if (!sessionParam) return;
    fetch(`/api/chat/sessions/${sessionParam}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { messages?: ChatMessage[] } | null) => {
        if (data?.messages) setMessages(data.messages);
      })
      .catch(() => {});
  }, [sessionParam]);

  // Scroll tracking
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = scrollAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, streamingContent]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function isTextFile(mimeType: string, name: string): boolean {
    if (mimeType.startsWith("text/")) return true;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return ["md", "markdown", "csv", "json", "xml", "yaml", "yml", "txt"].includes(ext);
  }

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const processed: PendingFile[] = [];
    for (const file of arr) {
      const id = Math.random().toString(36).slice(2);
      if (isTextFile(file.type, file.name)) {
        const text = await file.text();
        processed.push({ id, name: file.name, mimeType: file.type || "text/plain", textContent: text });
      } else if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        processed.push({ id, name: file.name, mimeType: file.type, dataUrl });
      }
    }
    setPendingFiles(prev => [...prev, ...processed]);
  }

  function removeFile(id: string) {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  // Save conversation to Supabase
  async function saveSession(msgs: ChatMessage[], sid: string, title?: string) {
    try {
      await fetch(`/api/chat/sessions/${sid}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: msgs, ...(title ? { title } : {}) }),
      });
      // Refresh session list silently
      loadSessions();
    } catch { /* ignore */ }
  }

  // Create new session and return its id
  async function createSession(firstMessage: string): Promise<string | null> {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: titleFromMessage(firstMessage),
          messages: [],
          ...(auditId ? { auditId } : {}),
        }),
      });
      if (!res.ok) return null;
      const { id } = await res.json() as { id: string };
      return id;
    } catch { return null; }
  }

  async function startNewConversation() {
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    setError(null);
    setStreamingContent("");
    // Navigate to /assistant (remove session param)
    router.push("/assistant" + (auditId ? `?auditId=${auditId}` : ""));
  }

  async function loadSession(id: string) {
    const res = await fetch(`/api/chat/sessions/${id}`);
    if (!res.ok) return;
    const data = await res.json() as { messages: ChatMessage[]; audit_id?: string | null };
    setMessages(data.messages ?? []);
    setSessionId(id);
    setError(null);
    router.push(`/assistant?session=${id}`);
  }

  async function deleteSession(id: string) {
    setDeletingId(id);
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    setSessions(s => s.filter(x => x.id !== id));
    if (sessionId === id) startNewConversation();
    setDeletingId(null);
  }

  async function send(overrideText?: string) {
    const rawText = (overrideText ?? input).trim();
    if (!rawText && pendingFiles.length === 0) return;
    if (loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError(null);
    setStreamingContent("");
    setToolStatus(null);

    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    const textFiles = filesToSend.filter(f => f.textContent !== undefined);
    const imageFiles = filesToSend.filter(f => f.dataUrl !== undefined);

    // UI display text: only what the user typed
    const displayText = rawText.trim() || "(Fichier joint)";

    // Full content for Claude: user text + embedded file contents
    const fileBlocks = textFiles.map(f =>
      `\n\n**Fichier joint : ${f.name}**\n\`\`\`\n${f.textContent}\n\`\`\``
    ).join("");
    const fullContent = displayText + fileBlocks;

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: fullContent,
        _display: displayText,
        _attachments: filesToSend.length > 0 ? filesToSend.map(f => f.name) : undefined,
      },
    ];
    setMessages(nextMessages);
    setLoading(true);

    // Create session on first message
    let sid = sessionIdRef.current;
    if (!sid) {
      sid = await createSession(displayText);
      if (sid) {
        setSessionId(sid);
        sessionIdRef.current = sid;
        setIsAnonymous(false);
        router.replace(`/assistant?session=${sid}` + (auditId ? `&auditId=${auditId}` : ""));
      } else {
        setIsAnonymous(true);
      }
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          ...(auditId ? { auditId } : {}),
          ...(imageFiles.length > 0 ? { images: imageFiles.map(f => ({ name: f.name, dataUrl: f.dataUrl! })) } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setError(json?.error || "Erreur lors de la génération");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (currentEvent === "token") {
              accumulated += JSON.parse(data) as string;
              setStreamingContent(accumulated);
            } else if (currentEvent === "status") {
              const { label } = JSON.parse(data) as { label: string };
              setToolStatus(label);
            } else if (currentEvent === "done") {
              const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: accumulated }];
              setMessages(finalMessages);
              setStreamingContent("");
              setToolStatus(null);
              // Auto-save
              if (sid) {
                const isFirst = nextMessages.length === 1;
                await saveSession(finalMessages, sid, isFirst ? titleFromMessage(displayText) : undefined);
              }
            } else if (currentEvent === "error") {
              setError(JSON.parse(data) as string);
            }
          }
        }
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
      setStreamingContent("");
      setToolStatus(null);
    }
  }

  function handleToolClick(tool: Tool) {
    if (tool.label === "Génération article") { setShowWritingSetup(true); return; }
    if (tool.label === "Popularité mots-clés et marque sur Reddit") { setShowRedditSetup(true); return; }
    if (tool.label === "Fiche produit") { setShowProductSetup(true); return; }
    if (tool.label === "Rédiger un plan de contenu") { setShowContentPlanSetup(true); return; }
    if (tool.label === "Publication CMS") { setShowPublicationCMSSetup(true); return; }
    // Fill input, user sends manually
    setInput(tool.prompt);
    setTimeout(() => { textareaRef.current?.focus(); autoResize(); }, 0);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    function onMove(ev: MouseEvent) {
      if (!isResizingRef.current) return;
      const newW = startW + ev.clientX - startX;
      const maxW = 320;
      if (newW < 180) {
        setSidebarVisible(false);
      } else {
        setSidebarWidth(Math.max(200, Math.min(maxW, newW)));
      }
    }
    function onUp() {
      isResizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleWritingSubmit(config: WritingConfig) {
    setWritingConfig(config);
    setWritingMode(true);
    setShowWritingSetup(false);
    send(buildArticlePrompt(config));
  }

  const showWelcome = messages.length === 0 && !loading;

  // Article content for writing checklist
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const articleContent = writingMode ? (streamingContent || lastAssistantMsg?.content || "") : "";
  const articleWordCount = articleContent.trim().split(/\s+/).filter(Boolean).length;

  // Filter + group sessions
  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped = filteredSessions.reduce<{ today: SessionMeta[]; yesterday: SessionMeta[]; older: SessionMeta[] }>(
    (acc, s) => {
      const d = new Date(s.updated_at).toDateString();
      if (d === today) acc.today.push(s);
      else if (d === yesterday) acc.yesterday.push(s);
      else acc.older.push(s);
      return acc;
    },
    { today: [], yesterday: [], older: [] }
  );

  return (
    <>
    <div className="flex w-full" style={{ height: "calc(100dvh - 4rem)", overflow: "hidden" }}>

      {/* ── Sidebar (hidden in writing mode or toggled off) ── */}
      {!writingMode && sidebarVisible && <>
      <aside
        className="hidden lg:flex flex-col gap-3 bg-background px-3 py-4"
        style={{ width: sidebarWidth, flexShrink: 0, minWidth: 200 }}
      >

        {/* Sidebar header: new conv + search + hide */}
        <div className="flex items-center gap-1">
          <button
            onClick={startNewConversation}
            className="flex flex-1 items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-accent transition"
          >
            <IconPlus className="h-3.5 w-3.5 text-brand shrink-0" />
            Nouvelle conversation
          </button>
          <button
            onClick={() => { setShowSearch(v => !v); setSearchQuery(""); }}
            title="Rechercher dans l'historique"
            className={`h-8 w-8 shrink-0 rounded-lg border grid place-items-center transition-colors ${showSearch ? "border-brand/40 text-brand bg-brand/5" : "border-hairline text-ink-soft hover:border-brand/40 hover:text-brand hover:bg-brand/5"}`}
          >
            <IconSearch className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setSidebarVisible(false)}
            title="Masquer la barre latérale"
            className="h-8 w-8 shrink-0 rounded-lg border border-hairline text-ink-soft hover:border-brand/40 hover:text-brand hover:bg-brand/5 grid place-items-center transition-colors"
          >
            <IconPanelLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative -mt-1">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-soft/60 pointer-events-none" />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans l'historique…"
              className="w-full rounded-lg border border-brand/30 bg-background pl-7 pr-7 py-1.5 text-xs text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-brand/50 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink text-xs leading-none">✕</button>
            )}
          </div>
        )}

        {/* Sessions history */}
        <div className="card-elevated flex-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100dvh - 22rem)" }}>
          {!sessionsLoaded ? (
            <p className="text-xs text-ink-soft text-center py-4">Chargement…</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-ink-soft text-center py-4 leading-relaxed">
              Vos conversations apparaîtront ici.
            </p>
          ) : (
            <div className="space-y-4">
              {(["today", "yesterday", "older"] as const).map(group => {
                const items = grouped[group];
                if (!items.length) return null;
                const label = group === "today" ? "Aujourd'hui" : group === "yesterday" ? "Hier" : "Plus tôt";
                return (
                  <div key={group}>
                    <div className="text-xs font-medium uppercase tracking-wider text-ink-soft px-2 mb-1">{label}</div>
                    <ul className="space-y-0.5">
                      {items.map(s => (
                        <li key={s.id} className="group/sess relative flex items-center">
                          {renamingId === s.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => setRenamingId(null)}
                              onKeyDown={e => {
                                if (e.key === "Enter") setRenamingId(null);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="flex-1 rounded-lg border border-brand/40 bg-background px-2 py-1 text-xs text-ink focus:outline-none focus:border-brand/60"
                            />
                          ) : (
                            <button
                              onClick={() => { loadSession(s.id); setOpenMenuId(null); setMenuPos(null); }}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                                s.id === sessionId
                                  ? "bg-brand/10 text-brand font-medium"
                                  : "text-ink-soft hover:bg-accent hover:text-ink"
                              }`}
                            >
                              <IconMessage className="h-3 w-3 shrink-0 opacity-60" />
                              <span className="relative flex-1 min-w-0 overflow-hidden">
                                <span className="block whitespace-nowrap">{pinnedIds.has(s.id) ? "📌 " : ""}{s.title.replace(/…$/, "")}</span>
                                <span
                                  className="pointer-events-none absolute inset-y-0 right-0 w-10"
                                  style={{ background: `linear-gradient(to left, ${s.id === sessionId ? "hsl(var(--brand) / 0.1)" : "hsl(var(--background))"}, transparent)` }}
                                />
                              </span>
                            </button>
                          )}

                          {/* 3-dot button — avant le tooltip dans le DOM pour activer peer-hover */}
                          {renamingId !== s.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openMenuId === s.id) {
                                  setOpenMenuId(null); setMenuPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  setOpenMenuId(s.id);
                                }
                              }}
                              className="peer/dot absolute right-1 hidden group-hover/sess:flex items-center justify-center h-5 w-5 rounded text-ink-soft hover:bg-accent hover:text-ink transition text-sm leading-none shrink-0"
                            >
                              ···
                            </button>
                          )}

                          {/* Tooltip title — masqué quand le bouton ··· est survolé */}
                          {renamingId !== s.id && (
                            <span className="pointer-events-none absolute left-8 top-full mt-1 z-50 hidden group-hover/sess:block peer-hover/dot:!hidden max-w-[200px] rounded-lg bg-ink px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-xl whitespace-normal break-words">
                              {s.title.replace(/…$/, "")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tools section */}
        <div className="card-elevated p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-ink-soft mb-3">
            Outils
          </div>

          {/* Top 3 featured */}
          <div className="mb-1.5">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-amber-400 text-[11px]">★</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-soft/80">Les plus populaires</span>
            </div>
            <div className="grid grid-cols-3 gap-1 mb-3" style={{ minWidth: 0 }}>
              {TOOLS.filter(t => t.featured).map((tool) => (
                <button
                  key={tool.label}
                  onClick={() => handleToolClick(tool)}
                  disabled={loading}
                  className="group/feat relative flex flex-col items-center gap-1 rounded-lg border border-brand/20 bg-brand/5 px-1 py-2 text-center text-brand hover:bg-brand/10 transition disabled:opacity-40 disabled:cursor-not-allowed overflow-visible min-w-0"
                >
                  <span className="text-brand">{tool.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{tool.label}</span>
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 hidden group-hover/feat:block w-36 rounded-xl bg-ink px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-xl text-center">
                    {tool.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-hairline mb-2" />

          {/* Rest of tools — scrollable */}
          <ul className="space-y-0.5 overflow-y-auto" style={{ maxHeight: "240px" }}>
            {TOOLS.filter(t => !t.featured).map((tool) => (
              <li key={tool.label}>
                <button
                  onClick={() => handleToolClick(tool)}
                  disabled={loading}
                  className="group w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-soft transition-colors hover:bg-accent hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="shrink-0 text-brand">{tool.icon}</span>
                  <span className="group/tlabel flex-1 min-w-0 relative">
                    <span className="block whitespace-normal leading-snug">{tool.label}</span>
                    <span className="pointer-events-none absolute left-0 top-full mt-1 z-50 hidden group-hover/tlabel:block max-w-[220px] rounded-lg bg-ink px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-xl whitespace-normal break-words">
                      {tool.label}
                    </span>
                  </span>
                  <ToolTip text={tool.desc} />
                </button>
              </li>
            ))}
          </ul>
        </div>

      </aside>
      {/* Drag-to-resize handle */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-[3px] shrink-0 cursor-col-resize border-r border-hairline hover:border-brand/40 hover:bg-brand/10 transition-colors select-none"
      />
      </>}

      {/* ── Main chat ── */}
      <main className="flex flex-col flex-1 bg-background min-w-0" style={{ minHeight: "calc(100dvh - 4rem)" }}>
        <div className="card-elevated flex flex-1 flex-col overflow-hidden p-0">

          {/* Session header */}
          <div className="flex items-center justify-between border-b border-hairline bg-gradient-to-r from-brand-soft/60 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              {!sidebarVisible && !writingMode && (
                <button
                  onClick={() => setSidebarVisible(true)}
                  title="Afficher la barre latérale"
                  className="hidden lg:grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-hairline text-ink-soft hover:border-brand/40 hover:text-brand hover:bg-brand/5 transition-colors"
                >
                  <IconPanelLeft className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="h-2 w-2 animate-pulse rounded-full bg-good" />
              <div className="text-sm font-medium text-ink">
                {sessionId
                  ? (sessions.find(s => s.id === sessionId)?.title ?? "Session active")
                  : "Nouvelle conversation"}
              </div>
              {auditId && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  ✓ Audit chargé
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {writingMode && (
                <button
                  onClick={() => { setWritingMode(false); setWritingConfig(null); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-xs text-ink-soft hover:bg-accent transition"
                >
                  ← Quitter la rédaction
                </button>
              )}
              {sessionId && !writingMode && (
                <button
                  onClick={startNewConversation}
                  className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-xs text-ink-soft hover:bg-accent transition"
                >
                  <IconPlus className="h-3 w-3" />
                  Nouveau
                </button>
              )}
              <div className="text-xs text-ink-soft font-mono hidden sm:block">
                {writingMode ? "Mode rédaction · Claude" : "mind-agent · Claude"}
              </div>
            </div>
          </div>

          {/* Editor toolbar (writing mode) */}
          {writingMode && <EditorToolbar wordCount={articleWordCount} />}

          {/* ── Welcome centered layout ── */}
          {showWelcome && (
            <div
              className="flex flex-1 flex-col items-center justify-center overflow-hidden px-4 sm:px-6 py-6"
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-brand/5 backdrop-blur-sm">
                  <IconUploadCloud className="h-10 w-10 text-brand opacity-70" />
                  <span className="text-sm font-medium text-brand">Déposez vos fichiers ici</span>
                </div>
              )}
              <div className="w-full max-w-[720px]" style={{ animation: "fadeUp 0.35s ease forwards" }}>
                {/* Welcome message */}
                <div className="flex gap-3 mb-6">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand">
                    <IconSparkles />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed bg-accent text-ink">
                      Bonjour, je suis Mind, votre copilote SEO. Donnez-moi une URL, un mot-clé ou un objectif et je m&apos;occupe du reste.
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="mb-6">
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-soft mb-3">Suggestions</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ANIMATED_SUGGESTIONS.map((suggestion, i) => (
                      <AnimatedSuggestionCard
                        key={i}
                        suggestion={suggestion}
                        initialVariantIdx={i}
                        onSelect={(text) => {
                          setInput(text);
                          setTimeout(() => { textareaRef.current?.focus(); autoResize(); }, 0);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Input bar — centered */}
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="text/*,.md,.markdown,.csv,.json,.yaml,.yml,image/*"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; } }}
                  />
                  {showAttachPanel && <div className="fixed inset-0 z-20" onClick={() => setShowAttachPanel(false)} />}
                  {showAttachPanel && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 rounded-2xl border border-hairline bg-background shadow-2xl z-30">
                      <div className="p-4 space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Joindre</p>
                        <button type="button" onClick={() => { fileInputRef.current?.click(); setShowAttachPanel(false); }} className="w-full flex items-center gap-3 rounded-xl border border-hairline p-3 text-left hover:bg-accent transition">
                          <div className="h-9 w-9 rounded-lg bg-brand/10 grid place-items-center shrink-0"><IconUploadCloud className="h-4 w-4 text-brand" /></div>
                          <div><div className="text-sm font-medium text-ink">Importer des fichiers ou des images</div><div className="text-xs text-ink-soft mt-0.5">PDF, images, CSV, JSON, Markdown…</div></div>
                        </button>
                        <div className="border-t border-hairline pt-3 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft mb-2">Connecteurs</p>
                          {/* CMS group */}
                          <button type="button" onClick={() => setCmsExpanded(v => !v)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent transition">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-[#21759B]/10 flex items-center justify-center shrink-0">
                                <Image src="/logos/wordpress.png" alt="WordPress" width={16} height={16} className="h-4 w-4 rounded object-contain" />
                              </div>
                              <div><div className="text-sm font-medium text-ink">CMS</div><div className="text-[11px] text-ink-soft">WordPress, Webflow</div></div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-ink-soft transition-transform ${cmsExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                          {cmsExpanded && (
                            <div className="ml-3 pl-3 border-l border-hairline space-y-1 pb-1">
                              <button type="button" onClick={() => { setShowWpModalFromPanel(true); setShowAttachPanel(false); }} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent transition text-left">
                                <Image src="/logos/wordpress.png" alt="WordPress" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                <span className="text-sm text-ink">WordPress</span>
                              </button>
                              <a href="/api/webflow/auth" className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent transition">
                                <Image src="/logos/webflow.png" alt="Webflow" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                <span className="text-sm text-ink">Webflow</span>
                              </a>
                            </div>
                          )}
                          {/* Sources de données group */}
                          <button type="button" onClick={() => setDataExpanded(v => !v)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent transition">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-[#4285F4]/10 flex items-center justify-center shrink-0">
                                <Image src="/logos/gsc.png" alt="GSC" width={16} height={16} className="h-4 w-4 rounded object-contain" />
                              </div>
                              <div><div className="text-sm font-medium text-ink">Sources de données</div><div className="text-[11px] text-ink-soft">GSC, Google Ads, Semrush…</div></div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-ink-soft transition-transform ${dataExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                          {dataExpanded && (
                            <div className="ml-3 pl-3 border-l border-hairline space-y-0.5 pb-1">
                              {/* GSC */}
                              <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                                <div className="flex items-center gap-2.5">
                                  <Image src="/logos/gsc.png" alt="GSC" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                  <span className="text-sm text-ink">Search Console</span>
                                </div>
                                <button type="button" onClick={() => setGscEnabled(v => !v)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${gscEnabled ? "bg-brand" : "bg-hairline"}`}><span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${gscEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} /></button>
                              </div>
                              {/* Google Ads */}
                              <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                                <div className="flex items-center gap-2.5">
                                  <Image src="/logos/google-ads.webp" alt="Google Ads" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                  <span className="text-sm text-ink">Google Ads</span>
                                </div>
                                <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                              </div>
                              {/* Semrush */}
                              <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                                <div className="flex items-center gap-2.5">
                                  <Image src="/logos/semrush.png" alt="Semrush" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                  <span className="text-sm text-ink">Semrush</span>
                                </div>
                                <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                              </div>
                              {/* Reddit */}
                              <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                                <div className="flex items-center gap-2.5">
                                  <Image src="/logos/reddit.png" alt="Reddit" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                                  <span className="text-sm text-ink">Reddit</span>
                                </div>
                                <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {pendingFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {pendingFiles.map(f => (
                        <div key={f.id} className="flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 px-2 py-1 text-xs text-brand">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {f.dataUrl ? <img src={f.dataUrl} alt={f.name} className="h-4 w-4 rounded object-cover" /> : <span className="opacity-60">📄</span>}
                          <span className="max-w-[120px] truncate">{f.name}</span>
                          <button type="button" onClick={() => removeFile(f.id)} className="ml-0.5 opacity-60 hover:opacity-100 transition" aria-label="Retirer le fichier">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); send(); }}>
                    <div className="flex items-end gap-2 rounded-2xl border border-hairline bg-background p-2 transition-shadow focus-within:border-brand/40 focus-within:shadow-lg">
                      <button type="button" onClick={() => setShowAttachPanel(v => !v)} disabled={loading} title="Joindre ou connecter" className={`h-9 w-9 shrink-0 rounded-lg border bg-accent text-ink-soft hover:text-brand hover:border-brand/40 hover:bg-brand/5 disabled:opacity-40 disabled:cursor-not-allowed grid place-items-center transition-colors ${showAttachPanel ? "border-brand/40 text-brand bg-brand/5" : "border-hairline"}`}>
                        <IconPlus className="h-4 w-4" />
                      </button>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => { setInput(e.target.value); autoResize(); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                        placeholder="Demandez à Mind d'analyser une SERP, générer un article, auditer un concurrent…"
                        className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                        style={{ maxHeight: "200px" }}
                      />
                      <button type="submit" disabled={loading || (!input.trim() && pendingFiles.length === 0)} className="h-11 w-11 shrink-0 rounded-xl bg-brand text-white glow-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed grid place-items-center transition-colors">
                        <IconArrowUp />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
                      <span className="hidden sm:block">Entrée pour envoyer · Maj+Entrée pour un retour à la ligne · Glisser-déposer pour joindre</span>
                      <span className="sm:hidden">Maj+Entrée pour un retour à la ligne</span>
                      <span className="font-mono hidden sm:block">mind-agent · Claude</span>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ── Chat messages area (visible when conversation started) ── */}
          {!showWelcome && (
            <div
              ref={scrollAreaRef}
              className="relative flex-1 overflow-y-auto py-4 sm:py-6"
              style={{ animation: "fadeUp 0.25s ease forwards" }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-brand/5 backdrop-blur-sm">
                  <IconUploadCloud className="h-10 w-10 text-brand opacity-70" />
                  <span className="text-sm font-medium text-brand">Déposez vos fichiers ici</span>
                </div>
              )}

              <div className="max-w-[720px] mx-auto w-full px-4 sm:px-6 space-y-4 sm:space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 group ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand self-start">
                      <IconSparkles />
                    </div>
                  )}
                  <div className={`min-w-0 ${m.role === "user" ? "max-w-[80%]" : "max-w-[720px] w-full"}`}>
                    {m.role === "user" ? (
                      <div className="flex flex-col items-end gap-1">
                        {m._attachments && m._attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end mb-0.5">
                            {m._attachments.map((name, j) => (
                              <span key={j} className="flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand">
                                <span className="opacity-60">📎</span>
                                <span className="max-w-[140px] truncate">{name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="inline-block rounded-2xl rounded-br-md px-4 py-2.5 bg-brand text-white text-sm leading-relaxed break-words">
                          {m._display ?? m.content}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl px-4 py-3 bg-accent text-ink overflow-hidden">
                          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        <ExportBar content={m.content} />
                      </>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white self-start text-xs font-semibold">
                      U
                    </div>
                  )}
                </div>
              ))}

              {loading && streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand self-start">
                    <IconSparkles />
                  </div>
                  <div className="max-w-[720px] rounded-2xl px-4 py-3 bg-accent text-ink">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-brand opacity-75 animate-pulse ml-0.5 align-middle" />
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand self-start">
                    <IconSparkles />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-accent">
                    {toolStatus ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-brand flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
                          {toolStatus}
                        </p>
                        {getSourceChips(toolStatus).map(chip => (
                          <span key={chip.label} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}>
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading && streamingContent && toolStatus && (
                <div className="flex justify-start pl-11">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-brand flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shrink-0" />
                      {toolStatus}
                    </p>
                    {getSourceChips(toolStatus).map(chip => (
                      <span key={chip.label} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600 pl-11">{error}</p>}
              <div ref={bottomRef} />
              </div>{/* end max-w-[720px] wrapper */}
            </div>
          )}

          {/* Anonymous session banner */}
          {isAnonymous && (
            <div className="mx-4 mb-0 mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              <span>Conversation non sauvegardée. Connectez-vous pour conserver votre historique.</span>
              <a href="/auth" className="shrink-0 font-medium text-amber-900 underline hover:text-amber-700">
                Se connecter
              </a>
            </div>
          )}

          {/* Input form — chat mode (bottom) */}
          {!showWelcome && (
          <form
            className="px-4 pt-3 pb-4 relative"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
          <div className="max-w-[720px] mx-auto">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="text/*,.md,.markdown,.csv,.json,.yaml,.yml,image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; } }}
            />

            {/* Overlay to close attach panel on outside click */}
            {showAttachPanel && (
              <div className="fixed inset-0 z-20" onClick={() => setShowAttachPanel(false)} />
            )}

            {/* Attach panel */}
            {showAttachPanel && (
              <div className="absolute bottom-full left-4 mb-2 w-80 rounded-2xl border border-hairline bg-background shadow-2xl z-30">
                <div className="p-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Joindre</p>
                  <button type="button" onClick={() => { fileInputRef.current?.click(); setShowAttachPanel(false); }} className="w-full flex items-center gap-3 rounded-xl border border-hairline p-3 text-left hover:bg-accent transition">
                    <div className="h-9 w-9 rounded-lg bg-brand/10 grid place-items-center shrink-0"><IconUploadCloud className="h-4 w-4 text-brand" /></div>
                    <div><div className="text-sm font-medium text-ink">Importer des fichiers ou des images</div><div className="text-xs text-ink-soft mt-0.5">PDF, images, CSV, JSON, Markdown…</div></div>
                  </button>
                  <div className="border-t border-hairline pt-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft mb-2">Connecteurs</p>
                    {/* CMS group */}
                    <button type="button" onClick={() => setCmsExpanded(v => !v)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent transition">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-[#21759B]/10 flex items-center justify-center shrink-0">
                          <Image src="/logos/wordpress.png" alt="WordPress" width={16} height={16} className="h-4 w-4 rounded object-contain" />
                        </div>
                        <div><div className="text-sm font-medium text-ink">CMS</div><div className="text-[11px] text-ink-soft">WordPress, Webflow</div></div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-ink-soft transition-transform ${cmsExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                    {cmsExpanded && (
                      <div className="ml-3 pl-3 border-l border-hairline space-y-1 pb-1">
                        <button type="button" onClick={() => { setShowWpModalFromPanel(true); setShowAttachPanel(false); }} className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent transition text-left">
                          <Image src="/logos/wordpress.png" alt="WordPress" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                          <span className="text-sm text-ink">WordPress</span>
                        </button>
                        <a href="/api/webflow/auth" className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent transition">
                          <Image src="/logos/webflow.png" alt="Webflow" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                          <span className="text-sm text-ink">Webflow</span>
                        </a>
                      </div>
                    )}
                    {/* Sources de données group */}
                    <button type="button" onClick={() => setDataExpanded(v => !v)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent transition">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-[#4285F4]/10 flex items-center justify-center shrink-0">
                          <Image src="/logos/gsc.png" alt="GSC" width={16} height={16} className="h-4 w-4 rounded object-contain" />
                        </div>
                        <div><div className="text-sm font-medium text-ink">Sources de données</div><div className="text-[11px] text-ink-soft">GSC, Google Ads, Semrush…</div></div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-ink-soft transition-transform ${dataExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                    {dataExpanded && (
                      <div className="ml-3 pl-3 border-l border-hairline space-y-0.5 pb-1">
                        <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                          <div className="flex items-center gap-2.5">
                            <Image src="/logos/gsc.png" alt="GSC" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                            <span className="text-sm text-ink">Search Console</span>
                          </div>
                          <button type="button" onClick={() => setGscEnabled(v => !v)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${gscEnabled ? "bg-brand" : "bg-hairline"}`}><span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${gscEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} /></button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                          <div className="flex items-center gap-2.5">
                            <Image src="/logos/google-ads.webp" alt="Google Ads" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                            <span className="text-sm text-ink">Google Ads</span>
                          </div>
                          <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                          <div className="flex items-center gap-2.5">
                            <Image src="/logos/semrush.png" alt="Semrush" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                            <span className="text-sm text-ink">Semrush</span>
                          </div>
                          <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent transition">
                          <div className="flex items-center gap-2.5">
                            <Image src="/logos/reddit.png" alt="Reddit" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" />
                            <span className="text-sm text-ink">Reddit</span>
                          </div>
                          <button type="button" className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors bg-hairline"><span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform translate-x-0.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* File chips */}
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pendingFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 px-2 py-1 text-xs text-brand">
                    {f.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.dataUrl} alt={f.name} className="h-4 w-4 rounded object-cover" />
                    ) : (
                      <span className="opacity-60">📄</span>
                    )}
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="ml-0.5 opacity-60 hover:opacity-100 transition"
                      aria-label="Retirer le fichier"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-hairline bg-background p-2 transition-shadow focus-within:border-brand/40 focus-within:shadow-lg">
              {/* + button */}
              <button
                type="button"
                onClick={() => setShowAttachPanel(v => !v)}
                disabled={loading}
                title="Joindre ou connecter"
                className={`h-9 w-9 shrink-0 rounded-lg border bg-accent text-ink-soft hover:text-brand hover:border-brand/40 hover:bg-brand/5 disabled:opacity-40 disabled:cursor-not-allowed grid place-items-center transition-colors ${showAttachPanel ? "border-brand/40 text-brand bg-brand/5" : "border-hairline"}`}
              >
                <IconPlus className="h-4 w-4" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Demandez à Mind d'analyser une SERP, générer un article, auditer un concurrent…"
                className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                style={{ maxHeight: "200px" }}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && pendingFiles.length === 0)}
                className="h-11 w-11 shrink-0 rounded-xl bg-brand text-white glow-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed grid place-items-center transition-colors"
              >
                <IconArrowUp />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
              <span className="hidden sm:block">Entrée pour envoyer · Maj+Entrée pour un retour à la ligne · Glisser-déposer pour joindre</span>
              <span className="sm:hidden">Maj+Entrée pour un retour à la ligne</span>
              <span className="font-mono hidden sm:block">mind-agent · Claude</span>
            </div>
          </div>{/* end centered wrapper */}
          </form>
          )}
        </div>
      </main>

      {/* ── Writing checklist panel ── */}
      {writingMode && writingConfig && (
        <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto py-0 pl-0 pr-0" style={{ width: 300, flexShrink: 0 }}>
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 backdrop-blur-sm py-2 mb-1 border-b border-hairline">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Suivi rédaction</p>
          </div>
          <WritingChecklist content={articleContent} config={writingConfig} />
        </aside>
      )}

    </div>

    {/* ── Session context menu (fixed position, not clipped by scroll) ── */}
    {openMenuId && menuPos && (
      <>
        <div className="fixed inset-0 z-40" onClick={() => { setOpenMenuId(null); setMenuPos(null); }} />
        <div className="fixed z-50 min-w-[172px] rounded-xl border border-hairline bg-background shadow-xl py-1" style={{ top: menuPos.top, right: menuPos.right }}>
          <button
            onClick={() => { setPinnedIds(prev => { const n = new Set(prev); n.has(openMenuId) ? n.delete(openMenuId) : n.add(openMenuId); return n; }); setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-accent"
          >
            {pinnedIds.has(openMenuId) ? "Désépingler" : "Épingler"}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/assistant?session=${openMenuId}`); setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-accent"
          >
            Partager (copier le lien)
          </button>
          <button
            onClick={() => { setRenameValue(sessions.find(s => s.id === openMenuId)?.title ?? ""); setRenamingId(openMenuId); setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-accent"
          >
            Renommer
          </button>
          <button
            onClick={() => { window.print(); setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-accent"
          >
            Exporter en PDF
          </button>
          <div className="border-t border-hairline my-1" />
          <button
            onClick={() => { const id = openMenuId; setOpenMenuId(null); setMenuPos(null); deleteSession(id); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
          >
            Supprimer
          </button>
        </div>
      </>
    )}

    {/* ── Tool setup modals ── */}
    {showRedditSetup && <RedditSetupModal onClose={() => setShowRedditSetup(false)} onSubmit={(p) => { setShowRedditSetup(false); send(p); }} />}
    {showProductSetup && <ProductSetupModal onClose={() => setShowProductSetup(false)} onSubmit={(p) => { setShowProductSetup(false); send(p); }} />}
    {showContentPlanSetup && <ContentPlanSetupModal onClose={() => setShowContentPlanSetup(false)} onSubmit={(p) => { setShowContentPlanSetup(false); send(p); }} />}
    {showPublicationCMSSetup && <PublicationCMSModal onClose={() => setShowPublicationCMSSetup(false)} onSubmit={(p) => { setShowPublicationCMSSetup(false); send(p); }} cmsEnabled={cmsEnabled} />}

    {/* ── CMS connection modal (WordPress) ── */}
    {showCmsModal && <WpConnectModal onClose={() => setShowCmsModal(false)} />}
    {showWpModalFromPanel && <WpConnectModal onClose={() => setShowWpModalFromPanel(false)} />}

    {/* ── Writing setup modal ── */}
    {showWritingSetup && (
      <WritingSetupModal
        onClose={() => setShowWritingSetup(false)}
        onSubmit={handleWritingSubmit}
      />
    )}
    </>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantPageInner />
    </Suspense>
  );
}
