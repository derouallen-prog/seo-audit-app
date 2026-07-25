"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionMeta {
  id: string;
  title: string;
  updated_at: string;
  audit_id?: string | null;
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

// ── Data ─────────────────────────────────────────────────────────────────────

const TOOLS: { label: string; icon: React.ReactNode; desc: string; prompt: string }[] = [
  {
    label: "Analyse SERP",
    icon: <IconChartColumn />,
    desc: "Top 10, intentions, snippets",
    prompt: "Lance une analyse SERP sur les mots-clés principaux de ce site. Pour chaque mot-clé analysé : identifie l'intention de recherche, décris la structure des résultats (featured snippets, PAA, ads, local pack…), note les opportunités de positionnement et propose un lien vers les résultats Google.",
  },
  {
    label: "Longue traîne",
    icon: <IconFileSearch />,
    desc: "Mots-clés faible concurrence",
    prompt: "Identifie des mots-clés de longue traîne à fort potentiel pour ce site. Priorise les requêtes à faible concurrence avec une intention commerciale ou informationnelle claire, et regroupe-les par thématique.",
  },
  {
    label: "Ranking domaine",
    icon: <IconGlobe />,
    desc: "Positions actuelles du domaine",
    prompt: "Vérifie les positions actuelles de ce domaine sur ses mots-clés principaux. Indique pour chaque mot-clé : la position, l'URL rankée, le volume estimé et les variations récentes si disponibles.",
  },
  {
    label: "Backlinks concurrents",
    icon: <IconChartColumn />,
    desc: "Sources de liens à dupliquer",
    prompt: "Analyse les backlinks des principaux concurrents de ce domaine. Identifie les sources de liens les plus intéressantes à cibler pour une stratégie de netlinking.",
  },
  {
    label: "Plan de contenu",
    icon: <IconWandSparkles />,
    desc: "Pilier + satellites",
    prompt: "Crée un plan de contenu éditorial complet avec page pilier et articles satellites pour la thématique principale de ce site. Inclus les mots-clés cibles, intentions, priorités et maillage interne suggéré.",
  },
  {
    label: "Stratégie SEO",
    icon: <IconSparkles className="h-3.5 w-3.5" />,
    desc: "Plan d'action prioritaire",
    prompt: "Génère un plan stratégique SEO complet et priorisé pour ce site. Couvre les axes : SEO technique, contenu, netlinking, maillage interne, SEO local et GEO. Pour chaque axe : actions concrètes, impact estimé et ordre de priorité.",
  },
  {
    label: "Publication WooCommerce",
    icon: <IconGlobe />,
    desc: "Brouillon produit WC",
    prompt: "Crée un brouillon de produit complet et optimisé prêt à publier sur WooCommerce pour ce site. Génère le contenu, les catégories, les tags et les métadonnées SEO.",
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

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, streamingContent]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
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
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError(null);
    setStreamingContent("");
    setToolStatus(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);

    // Create session on first message
    let sid = sessionIdRef.current;
    if (!sid) {
      sid = await createSession(text);
      if (sid) {
        setSessionId(sid);
        sessionIdRef.current = sid;
        router.replace(`/assistant?session=${sid}` + (auditId ? `&auditId=${auditId}` : ""));
      }
    }

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, ...(auditId ? { auditId } : {}) }),
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
                await saveSession(finalMessages, sid, isFirst ? titleFromMessage(text) : undefined);
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
          <ul className="space-y-0.5">
            {TOOLS.map(({ label, icon, desc, prompt }) => (
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
          <div ref={scrollAreaRef} className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">

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
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white glow-brand self-start">
                    <IconSparkles />
                  </div>
                )}
                <div className={`max-w-[720px] ${m.role === "user" ? "max-w-[80%]" : ""}`}>
                  {m.role === "user" ? (
                    <div className="inline-block rounded-2xl rounded-br-md px-4 py-2.5 bg-brand text-white text-sm leading-relaxed">
                      {m.content}
                    </div>
                  ) : (
                    <div className="rounded-2xl px-4 py-3 bg-accent text-ink">
                      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
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

          {/* Input form */}
          <form
            className="border-t border-hairline p-4"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <div className="flex items-end gap-2 rounded-2xl border border-hairline bg-background p-2 transition-shadow focus-within:border-brand/40 focus-within:shadow-lg">
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
                disabled={loading || !input.trim()}
                className="h-11 w-11 shrink-0 rounded-xl bg-brand text-white glow-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed grid place-items-center transition-colors"
              >
                <IconArrowUp />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
              <span>Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</span>
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
