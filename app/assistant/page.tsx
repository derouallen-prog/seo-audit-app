"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
    prompt: "Génère un article de blog complet et optimisé SEO pour ce site. Demande-moi le sujet, le mot-clé principal et le public cible si tu ne les connais pas encore.",
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
    label: "Analyse SERP",
    icon: <IconChartColumn />,
    desc: "Top 10, intentions, snippets",
    prompt: "Lance une analyse SERP sur les mots-clés principaux de ce site. Pour chaque mot-clé : identifie l'intention de recherche, décris la structure des résultats (featured snippets, PAA, ads, local pack…) et note les opportunités de positionnement.",
  },
  {
    label: "Longue traîne",
    icon: <IconFileSearch />,
    desc: "Mots-clés faible concurrence",
    prompt: "Identifie des mots-clés de longue traîne à fort potentiel pour ce site. Priorise les requêtes à faible concurrence avec une intention commerciale ou informationnelle claire, et regroupe-les par thématique.",
  },
  {
    label: "Ranking domaine",
    icon: <IconSearch />,
    desc: "Positions actuelles du domaine",
    prompt: "Vérifie les positions actuelles de ce domaine sur ses mots-clés principaux. Indique pour chaque mot-clé : la position, l'URL rankée, le volume estimé et les variations récentes si disponibles.",
  },
  {
    label: "Backlinks concurrents",
    icon: <IconGlobe />,
    desc: "Sources de liens à dupliquer",
    prompt: "Analyse les backlinks des principaux concurrents de ce domaine. Identifie les sources de liens les plus intéressantes à cibler pour une stratégie de netlinking.",
  },
  {
    label: "Données GSC",
    icon: <IconChartColumn />,
    desc: "Requêtes & positions Search Console",
    prompt: "Récupère les données Google Search Console de ce site : top requêtes, pages associées, clics, impressions et positions moyennes. Donne-moi le domaine si je ne le connais pas encore.",
  },
  {
    label: "Données Semrush",
    icon: <IconChartColumn />,
    desc: "Mots-clés & backlinks Semrush",
    prompt: "Analyse les données Semrush pour ce domaine : mots-clés positionnés, top pages organiques et profil de backlinks. Donne-moi le domaine si je ne le connais pas encore.",
  },
  {
    label: "Reddit search",
    icon: <IconReddit />,
    desc: "Sémantique & ninja linking",
    prompt: "Analyse les discussions Reddit sur la thématique principale de ce site. Identifie le vocabulaire réel des internautes, les questions récurrentes, les pain points, et les opportunités de ninja linking.",
  },
  {
    label: "Plan de contenu",
    icon: <IconWandSparkles />,
    desc: "Pilier + articles satellites",
    prompt: "Crée un plan de contenu éditorial complet avec page pilier et articles satellites pour la thématique principale de ce site. Inclus les mots-clés cibles, intentions, priorités et maillage interne suggéré.",
  },
  {
    label: "Stratégie SEO",
    icon: <IconSparkles className="h-3.5 w-3.5" />,
    desc: "Plan d'action prioritaire",
    prompt: "Génère un plan stratégique SEO complet et priorisé pour ce site. Couvre les axes : SEO technique, contenu, netlinking, maillage interne, SEO local et GEO. Pour chaque axe : actions concrètes, impact estimé et ordre de priorité.",
  },
];

const SUGGESTIONS: { label: string; icon: React.ReactNode; prompt: string }[] = [
  { label: "Analyser la SERP de \"veste imperméable homme\"", icon: <IconFileSearch className="h-4 w-4" />, prompt: "Analyse la SERP pour le mot-clé \"veste imperméable homme\"" },
  { label: "Backlinks concurrents de patagonia.com", icon: <IconChartColumn className="h-4 w-4" />, prompt: "Analyse les backlinks concurrents de patagonia.com" },
  { label: "Générer un plan de contenu autour de \"randonnée légère\"", icon: <IconWandSparkles className="h-4 w-4" />, prompt: "Génère un plan de contenu autour du sujet \"randonnée légère\"" },
  { label: "Longue traîne pour ma boutique outdoor", icon: <IconGlobe className="h-4 w-4" />, prompt: "Trouve des mots-clés de longue traîne pour une boutique outdoor" },
];

// ── Markdown components ───────────────────────────────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="font-display text-xl text-ink mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="font-display text-lg text-ink mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-sm text-ink mt-3 mb-1.5 first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold text-xs text-ink mt-2 mb-1 first:mt-0 uppercase tracking-wide">{children}</h4>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
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
  return text.slice(0, 55).trim() + (text.length > 55 ? "…" : "");
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

  const showWelcome = messages.length === 0 && !loading;

  // Group sessions by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const grouped = sessions.reduce<{ today: SessionMeta[]; yesterday: SessionMeta[]; older: SessionMeta[] }>(
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
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-0 px-0 sm:gap-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8 lg:py-8" style={{ minHeight: "calc(100dvh - 4rem)" }}>

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col gap-4">

        {/* New conversation button */}
        <button
          onClick={startNewConversation}
          className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent transition w-full"
        >
          <IconPlus className="h-4 w-4 text-brand" />
          Nouvelle conversation
        </button>

        {/* Sessions history */}
        <div className="card-elevated flex-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100dvh - 14rem)" }}>
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
                        <li key={s.id} className="group relative flex items-center">
                          <button
                            onClick={() => loadSession(s.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                              s.id === sessionId
                                ? "bg-brand/10 text-brand font-medium"
                                : "text-ink-soft hover:bg-accent hover:text-ink"
                            }`}
                          >
                            <IconMessage className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="flex-1 min-w-0 truncate">{s.title}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                            disabled={deletingId === s.id}
                            className="absolute right-1 hidden group-hover:flex items-center justify-center h-5 w-5 rounded text-ink-soft hover:text-warn hover:bg-warn/10 transition"
                            title="Supprimer"
                          >
                            <IconTrash className="h-3 w-3" />
                          </button>
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
          <div className="text-xs font-medium uppercase tracking-wider text-ink-soft mb-2">
            Outils
          </div>

          {/* Top 3 featured */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {TOOLS.filter(t => t.featured).map(({ label, icon, desc, prompt }) => (
              <button
                key={label}
                onClick={() => send(prompt)}
                disabled={loading}
                title={desc}
                className="flex flex-col items-center gap-1 rounded-lg border border-brand/20 bg-brand/5 px-1 py-2 text-center text-brand hover:bg-brand/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-brand">{icon}</span>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-hairline mb-2" />

          {/* Rest of tools — scrollable */}
          <ul className="space-y-0.5 overflow-y-auto" style={{ maxHeight: "190px" }}>
            {TOOLS.filter(t => !t.featured).map(({ label, icon, desc, prompt }) => (
              <li key={label}>
                <button
                  onClick={() => send(prompt)}
                  disabled={loading}
                  title={desc}
                  className="group w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-soft transition-colors hover:bg-accent hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="shrink-0 text-brand">{icon}</span>
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-brand text-xs">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

      </aside>

      {/* ── Main chat ── */}
      <main className="flex flex-col" style={{ minHeight: "calc(100dvh - 8rem)" }}>
        <div className="card-elevated flex flex-1 flex-col overflow-hidden p-0">

          {/* Session header */}
          <div className="flex items-center justify-between border-b border-hairline bg-gradient-to-r from-brand-soft/60 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
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
              {sessionId && (
                <button
                  onClick={startNewConversation}
                  className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-xs text-ink-soft hover:bg-accent transition"
                >
                  <IconPlus className="h-3 w-3" />
                  Nouveau
                </button>
              )}
              <div className="text-xs text-ink-soft font-mono hidden sm:block">mind-agent · Claude</div>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={scrollAreaRef}
            className="relative flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6"
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

            {showWelcome && (
              <>
                <div className="flex gap-3" style={{ animation: "fadeUp 0.3s ease forwards" }}>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand">
                    <IconSparkles />
                  </div>
                  <div className="max-w-[720px] space-y-2">
                    <div className="inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed bg-accent text-ink">
                      Bonjour 👋 Je suis Mind, votre copilote SEO. Donnez-moi une URL, un mot-clé ou un objectif — je m&apos;occupe du reste.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-soft">Suggestions</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map(({ label, icon, prompt }) => (
                      <button
                        key={label}
                        onClick={() => send(prompt)}
                        className="group flex items-center gap-3 rounded-xl border border-hairline bg-background px-4 py-3 text-left text-sm text-ink transition-all hover:border-brand/40 hover:bg-brand-soft/40"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand transition-transform group-hover:scale-105">
                          {icon}
                        </div>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

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
                    <p className="text-xs text-brand flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                      {toolStatus}
                    </p>
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
                <p className="text-xs text-brand flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  {toolStatus}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600 pl-11">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Anonymous session banner */}
          {isAnonymous && (
            <div className="mx-4 mb-0 mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              <span>Conversation non sauvegardée — connectez-vous pour conserver votre historique.</span>
              <a href="/auth" className="shrink-0 font-medium text-amber-900 underline hover:text-amber-700">
                Se connecter
              </a>
            </div>
          )}

          {/* Input form */}
          <form
            className="border-t border-hairline p-4"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="text/*,.md,.markdown,.csv,.json,.yaml,.yml,image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; } }}
            />

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
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Joindre un fichier ou une image"
                className="h-9 w-9 shrink-0 rounded-lg border border-hairline bg-accent text-ink-soft hover:text-brand hover:border-brand/40 hover:bg-brand/5 disabled:opacity-40 disabled:cursor-not-allowed grid place-items-center transition-colors"
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
                className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
                style={{ maxHeight: "160px" }}
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
          </form>
        </div>
      </main>

    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantPageInner />
    </Suspense>
  );
}
