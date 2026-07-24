"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── SVG icons (inline, no dep) ────────────────────────────────────────────

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

function IconMessageSquare({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
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

// ── Data ─────────────────────────────────────────────────────────────────

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
    desc: "Opportunités netlinking",
    prompt: "Analyse les backlinks des principaux concurrents de ce site. Identifie les domaines référents les plus puissants, les types de liens obtenus et les opportunités concrètes pour répliquer leur stratégie.",
  },
  {
    label: "Données GSC",
    icon: <IconChartColumn />,
    desc: "Search Console · requêtes & pages",
    prompt: "Récupère et analyse les données de la Search Console pour ce site. Présente les requêtes top, les pages les plus cliquées, le CTR moyen, les impressions et les opportunités d'amélioration par requête.",
  },
  {
    label: "Données Semrush",
    icon: <IconChartColumn />,
    desc: "Trafic organique & mots-clés",
    prompt: "Analyse les données Semrush de ce domaine : mots-clés positionnés et leur évolution, trafic organique estimé, pages les plus performantes et mots-clés à fort potentiel non encore exploités.",
  },
  {
    label: "Reddit search",
    icon: <IconMessageSquare />,
    desc: "Questions & pain points",
    prompt: "Fais une recherche Reddit approfondie sur la thématique de ce site. Identifie les questions récurrentes, les pain points exprimés, les angles de contenu les plus engageants et les opportunités de ninja linking.",
  },
  {
    label: "People Also Ask (KPU)",
    icon: <IconFileSearch />,
    desc: "Questions PAA Google",
    prompt: "Récupère les questions People Also Ask (PAA) Google pour les sujets principaux de ce site. Structure les résultats par thèmes, identifie les intentions et propose comment y répondre dans le contenu.",
  },
  {
    label: "Suggestions Autocomplete (KPU)",
    icon: <IconFileSearch />,
    desc: "Sémantique & autocomplete",
    prompt: "Génère des suggestions d'autocomplete Google, questions sémantiques et variations lexicales pour les mots-clés principaux de ce site. Classe les résultats par intention et potentiel éditorial.",
  },
  {
    label: "Génération article",
    icon: <IconWandSparkles />,
    desc: "Article blog SEO complet",
    prompt: "Génère un article de blog complet et optimisé SEO/GEO sur le sujet principal de ce site. Inclus : titre optimisé, introduction engageante, structure H2/H3 claire, contenu approfondi avec données factuelles, et conclusion avec CTA.",
  },
  {
    label: "Fiche produit",
    icon: <IconWandSparkles />,
    desc: "Description e-commerce optimisée",
    prompt: "Génère une fiche produit e-commerce optimisée SEO pour un produit phare de ce site. Inclus : titre optimisé avec mot-clé principal, description longue structurée, arguments de vente, spécifications et balises méta.",
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
];

const SUGGESTIONS = [
  { label: "Analyser la SERP de \"veste imperméable homme\"", icon: <IconFileSearch className="h-4 w-4" />, prompt: "Analyse la SERP pour le mot-clé \"veste imperméable homme\"" },
  { label: "Backlinks concurrents de patagonia.com", icon: <IconChartColumn className="h-4 w-4" />, prompt: "Analyse les backlinks concurrents de patagonia.com" },
  { label: "Générer un plan de contenu autour de \"randonnée légère\"", icon: <IconWandSparkles className="h-4 w-4" />, prompt: "Génère un plan de contenu autour du sujet \"randonnée légère\"" },
  { label: "Longue traîne pour ma boutique outdoor", icon: <IconGlobe className="h-4 w-4" />, prompt: "Trouve des mots-clés de longue traîne pour une boutique outdoor" },
];

// ── Markdown components ───────────────────────────────────────────────────

const markdownComponents: Components = {
  h1: ({ children }) => <h2 className="text-base font-bold text-ink mt-1 mb-3 pb-2 border-b border-hairline">{children}</h2>,
  h2: ({ children }) => <h3 className="text-sm font-bold text-brand mt-5 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold text-ink mt-4 mb-1.5">{children}</h4>,
  p: ({ children }) => <p className="text-sm text-ink-soft leading-relaxed mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 mb-3 ml-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-sm text-ink-soft leading-relaxed flex gap-2">
      <span className="text-brand mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ href, children }) => {
    // Internal links (starting with /) rendered as CTA buttons
    if (href?.startsWith("/")) {
      return (
        <a href={href} className="inline-flex items-center gap-1.5 mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors no-underline">
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark underline underline-offset-2">
        {children}
      </a>
    );
  },
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

// ── Component ─────────────────────────────────────────────────────────────

function AssistantPageInner() {
  const searchParams = useSearchParams();
  const auditId = searchParams.get("auditId");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Track whether user has manually scrolled up
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

  // Only auto-scroll when user is already at the bottom
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

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, ...(auditId ? { auditId } : {}) }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setError(json?.error || "Erreur lors de la génération");
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
              setMessages([...nextMessages, { role: "assistant", content: accumulated }]);
              setStreamingContent("");
              setToolStatus(null);
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

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8" style={{ minHeight: "calc(100dvh - 4rem)" }}>

      {/* ── Sidebar ── */}
      <aside className="hidden lg:block">
        <div className="card-elevated sticky top-24 p-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white glow-brand">
              <IconSparkles />
            </div>
            <div>
              <div className="font-display text-lg text-ink">Mind</div>
              <div className="text-xs text-ink-soft">Assistant SEO · Claude</div>
            </div>
          </div>

          <div className="mt-6 text-xs font-medium uppercase tracking-wider text-ink-soft">
            Outils disponibles
          </div>
          <ul className="mt-3 space-y-0.5">
            {TOOLS.map(({ label, icon, desc, prompt }) => (
              <li key={label}>
                <button
                  onClick={() => send(prompt)}
                  disabled={loading}
                  title={desc}
                  className="group w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-soft transition-colors hover:bg-accent hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              <div className="text-sm font-medium text-ink">Session active</div>
              {auditId && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  ✓ Audit chargé
                </span>
              )}
            </div>
            <div className="text-xs text-ink-soft font-mono">mind-agent · multi-tours</div>
          </div>

          {/* Messages area */}
          <div ref={scrollAreaRef} className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">

            {/* Welcome + suggestions */}
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

            {/* Conversation */}
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

            {/* Streaming bubble */}
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

            {/* Tool status / typing indicator */}
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

            {/* Tool status under streaming */}
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
              <span className="font-mono">mind-agent · Claude</span>
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
