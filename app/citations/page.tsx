"use client";

import { useState, useEffect, useCallback } from "react";
import type { PromptSet, Intent } from "@/lib/citations/types";
import { INTENTS, PLATFORMS } from "@/lib/citations/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface RunDetail {
  id: string;
  prompt_id: string;
  platform: string;
  run_at: string;
  cited: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[];
  responseExcerpt: string;
  sources: string[];
}

interface CitationShare { cited: number; total: number; share: number; }

interface ResultsData {
  prompts: PromptSet[];
  runs: { id: string; prompt_id: string; platform: string; run_at: string; cited: boolean }[];
  runDetails: RunDetail[];
  citationShare: Record<string, CitationShare>;
  shareOfVoice: number | null;
  topCompetitors: { domain: string; count: number }[];
  topPages: { url: string; count: number }[];
  trend: { week: string; share: number; cited: number; total: number }[];
  meta: { days: number; totalRuns: number };
}

// ── Platform config ────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; logo: string }> = {
  perplexity: {
    label: "Perplexity",
    color: "#20808d",
    bg: "#e6f4f5",
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#20808d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  claude: {
    label: "Claude",
    color: "#c96442",
    bg: "#fdf0eb",
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#c96442" stroke-width="2"/><path d="M8 12s1.5-3 4-3 4 3 4 3-1.5 3-4 3-4-3-4-3z" fill="#c96442"/></svg>`,
  },
  gemini: {
    label: "Gemini",
    color: "#4285f4",
    bg: "#eaf1fe",
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 4l3 6-3 6-3-6 3-6z" fill="#4285f4"/></svg>`,
  },
  openai: {
    label: "ChatGPT",
    color: "#10a37f",
    bg: "#e6f6f2",
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#10a37f" stroke-width="2"/><path d="M8 9h8M8 12h8M8 15h5" stroke="#10a37f" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  bing_copilot: {
    label: "Bing Copilot",
    color: "#0078d4",
    bg: "#e6f2fb",
    logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="4" stroke="#0078d4" stroke-width="2"/><path d="M7 17l4-5 3 3 2-2.5" stroke="#0078d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
};

function PlatformBadge({ platform, size = "sm" }: { platform: string; size?: "sm" | "md" }) {
  const cfg = PLATFORM_CONFIG[platform] ?? { label: platform, color: "#6b7280", bg: "#f3f4f6", logo: "" };
  const sz = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sz}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span className="w-3.5 h-3.5 shrink-0" dangerouslySetInnerHTML={{ __html: cfg.logo }} />
      {cfg.label}
    </span>
  );
}

function CitedBadge({ cited }: { cited: boolean }) {
  return cited ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Cited
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Non cité
    </span>
  );
}

function MiniTrend({ data }: { data: ResultsData["trend"] }) {
  if (!data.length) return <p className="text-xs text-ink-soft">Pas encore de données.</p>;
  const max = Math.max(...data.map(d => d.share), 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => (
        <div key={i} title={`${d.week} : ${d.share}%`}
          className="flex-1 rounded-t-sm bg-brand/60 transition-all"
          style={{ height: `${Math.max((d.share / max) * 100, d.share > 0 ? 8 : 0)}%` }}
        />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CitationsPage() {
  const [tab, setTab] = useState<"overview" | "analyse" | "competitors" | "pages" | "setup">("overview");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [prompts, setPrompts] = useState<PromptSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  // Setup form
  const [form, setForm] = useState({ tracked_url: "", prompt_text: "", intent: "Informational" as Intent, topic: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Keyword generation
  const [kwInput, setKwInput] = useState("");
  const [generatedPrompts, setGeneratedPrompts] = useState<{ keyword: string; prompt_text: string; intent: Intent }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/citations/prompts"),
        fetch(`/api/citations/results?days=${days}`),
      ]);
      if (pRes.ok) { const d = await pRes.json() as { prompts: PromptSet[] }; setPrompts(d.prompts ?? []); }
      if (rRes.ok) { const d = await rRes.json() as ResultsData; setResults(d); }
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.tracked_url || !form.prompt_text) { setFormError("URL et prompt obligatoires."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/citations/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? "Erreur"); return; }
      setForm({ tracked_url: "", prompt_text: "", intent: "Informational", topic: "" });
      await loadData();
    } finally { setCreating(false); }
  }

  async function deletePrompt(id: string) {
    await fetch(`/api/citations/prompts?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function togglePrompt(id: string, active: boolean) {
    await fetch("/api/citations/prompts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) });
    await loadData();
  }

  async function runNow(promptId: string) {
    setRunning(promptId);
    try {
      await fetch("/api/citations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt_id: promptId }) });
      await loadData();
    } finally { setRunning(null); }
  }

  async function generateFromKeywords() {
    const keywords = kwInput.split(/[,\n]+/).map(k => k.trim()).filter(Boolean).slice(0, 15);
    if (!keywords.length) return;
    setGenerating(true);
    setGeneratedPrompts([]);
    try {
      const res = await fetch("/api/citations/generate-prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords }) });
      if (res.ok) {
        const d = await res.json() as { prompts: typeof generatedPrompts };
        setGeneratedPrompts(d.prompts ?? []);
      }
    } finally { setGenerating(false); }
  }

  async function saveAllGenerated() {
    if (!generatedPrompts.length || !form.tracked_url) { setFormError("Saisissez d'abord le domaine à tracker."); return; }
    setSavingAll(true);
    try {
      for (const gp of generatedPrompts) {
        await fetch("/api/citations/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracked_url: form.tracked_url, prompt_text: gp.prompt_text, intent: gp.intent, topic: gp.keyword }) });
      }
      setGeneratedPrompts([]);
      setKwInput("");
      await loadData();
    } finally { setSavingAll(false); }
  }

  function removeGenerated(idx: number) { setGeneratedPrompts(g => g.filter((_, i) => i !== idx)); }

  // Group runDetails by prompt
  const byPrompt: Record<string, RunDetail[]> = {};
  for (const rd of results?.runDetails ?? []) {
    if (!byPrompt[rd.prompt_id]) byPrompt[rd.prompt_id] = [];
    byPrompt[rd.prompt_id]!.push(rd);
  }

  const totalCitations = Object.values(results?.citationShare ?? {}).reduce((a, v) => ({ cited: a.cited + v.cited, total: a.total + v.total }), { cited: 0, total: 0 });
  const globalShare = totalCitations.total > 0 ? Math.round((totalCitations.cited / totalCitations.total) * 100) : null;

  const TABS = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "analyse", label: "Prompts analysés" },
    { key: "competitors", label: "Concurrents" },
    { key: "pages", label: "Pages citées" },
    { key: "setup", label: "Prompts" },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink">Visibilité IA</h1>
          <p className="mt-1 text-sm text-ink-soft">Citation Share, Share of Voice et analyse des réponses sur Perplexity, Claude et Gemini.</p>
        </div>
        <button onClick={() => setTab("setup")} className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition">
          + Nouveau prompt
        </button>
      </div>

      {/* Note méthodologique */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Note :</strong> Les mesures via API sont directionnelles — elles peuvent légèrement différer de l&apos;expérience grand public (personnalisation, mémoire). C&apos;est la même méthode que Profound, Peec AI et Otterly.
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-accent/50 p-1 mb-6 w-fit overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === key ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
          >{label}</button>
        ))}
      </div>

      {/* Period selector */}
      {tab !== "setup" && (
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-ink-soft">Période :</span>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${days === d ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}
            >{d}j</button>
          ))}
        </div>
      )}

      {/* ── TAB: Vue d'ensemble ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p> : !results || results.meta.totalRuns === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline p-16 text-center">
              <p className="text-ink-soft text-sm mb-2">Aucun run effectué pour l&apos;instant.</p>
              <button onClick={() => setTab("setup")} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition">+ Ajouter des prompts</button>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Citation Share", value: globalShare != null ? `${globalShare}%` : "—", sub: `${totalCitations.cited}/${totalCitations.total} runs` },
                  { label: "Share of Voice", value: results.shareOfVoice != null ? `${results.shareOfVoice}%` : "—", sub: "vs concurrents détectés" },
                  { label: "Prompts actifs", value: String(prompts.filter(p => p.active).length), sub: `${PLATFORMS.join(" · ")}` },
                  { label: "Runs ({days}j)", value: String(results.meta.totalRuns), sub: "toutes plateformes" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="rounded-2xl border border-hairline bg-white p-5">
                    <p className="text-xs text-ink-soft mb-1">{label.replace("{days}", String(days))}</p>
                    <p className="text-3xl font-bold text-ink">{value}</p>
                    <p className="text-xs text-ink-soft mt-1">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Platform breakdown with logos */}
              <div className="rounded-2xl border border-hairline bg-white p-6">
                <h2 className="font-semibold text-sm text-ink mb-5">Citation Share par plateforme</h2>
                <div className="space-y-5">
                  {PLATFORMS.map(p => {
                    const s = results.citationShare[p];
                    if (!s) return null;
                    const cfg = PLATFORM_CONFIG[p]!;
                    return (
                      <div key={p} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg }}
                          dangerouslySetInnerHTML={{ __html: cfg.logo }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-ink">{cfg.label}</span>
                            <span className="text-xs text-ink-soft">{s.cited}/{s.total} runs</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.share}%`, backgroundColor: cfg.color }} />
                            </div>
                            <span className="text-sm font-bold w-10 text-right" style={{ color: cfg.color }}>{s.share}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trend */}
              {results.trend.length > 0 && (
                <div className="rounded-2xl border border-hairline bg-white p-6">
                  <h2 className="font-semibold text-sm text-ink mb-4">Évolution du Citation Share ({days}j)</h2>
                  <MiniTrend data={results.trend} />
                  <div className="flex justify-between text-xs text-ink-soft mt-2">
                    <span>{results.trend[0]?.week}</span>
                    <span>{results.trend[results.trend.length - 1]?.week}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: Prompts analysés (style Semrush) ── */}
      {tab === "analyse" && (
        <div className="space-y-4">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p>
          : !results?.runDetails.length ? (
            <div className="rounded-2xl border border-dashed border-hairline p-12 text-center">
              <p className="text-sm text-ink-soft">Aucun run enregistré sur cette période.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_3fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-hairline bg-accent/30 text-xs font-semibold text-ink-soft uppercase tracking-wide">
                <span>Prompt</span>
                <span>Réponse IA</span>
                <span>Statut</span>
                <span>Sources</span>
                <span>Plateformes</span>
              </div>

              {/* Rows grouped by prompt */}
              {results.prompts.map(prompt => {
                const pRuns = byPrompt[prompt.id] ?? [];
                if (!pRuns.length) return null;
                const cited = pRuns.some(r => r.cited);
                const isOpen = expandedRow === prompt.id;
                const firstRun = pRuns[0]!;

                return (
                  <div key={prompt.id} className="border-b border-hairline last:border-0">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedRow(isOpen ? null : prompt.id)}
                      className="w-full grid grid-cols-[2fr_3fr_auto_auto_auto] gap-4 px-5 py-4 text-left hover:bg-accent/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink line-clamp-2">{prompt.prompt_text}</p>
                        <span className="text-xs text-ink-soft">{prompt.tracked_url}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-ink-soft line-clamp-3 leading-relaxed">
                          {firstRun.responseExcerpt || <span className="italic">Réponse non disponible</span>}
                        </p>
                      </div>
                      <div><CitedBadge cited={cited} /></div>
                      <div className="text-sm text-center text-ink-soft">{firstRun.sources.length}</div>
                      <div className="flex flex-wrap gap-1">
                        {pRuns.map(r => (
                          <span key={r.platform} className="w-2 h-2 rounded-full" title={PLATFORM_CONFIG[r.platform]?.label}
                            style={{ backgroundColor: r.cited ? PLATFORM_CONFIG[r.platform]?.color : "#d1d5db" }} />
                        ))}
                      </div>
                    </button>

                    {/* Expanded per-platform details */}
                    {isOpen && (
                      <div className="bg-accent/20 border-t border-hairline divide-y divide-hairline/60">
                        {pRuns.map(run => (
                          <div key={run.id} className="px-6 py-4 grid grid-cols-[140px_1fr_auto] gap-4 items-start">
                            <PlatformBadge platform={run.platform} size="md" />
                            <div>
                              {run.responseExcerpt && (
                                <p className="text-xs text-ink leading-relaxed mb-2">{run.responseExcerpt}{run.responseExcerpt.length >= 280 ? "…" : ""}</p>
                              )}
                              {run.sources.length > 0 && (
                                <div className="space-y-0.5">
                                  {run.sources.slice(0, 5).map((s, i) => (
                                    <p key={i} className={`text-xs truncate ${i === 0 && run.cited ? "text-green-700 font-medium" : "text-ink-soft"}`}>
                                      {i + 1}. {s}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <CitedBadge cited={run.cited} />
                              {run.citation_position && <span className="text-xs text-ink-soft">Pos. #{run.citation_position}</span>}
                              <span className="text-xs text-ink-soft">{new Date(run.run_at).toLocaleDateString("fr-FR")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Concurrents ── */}
      {tab === "competitors" && (
        <div className="space-y-4">
          {/* Share of Voice donut-style */}
          {results?.shareOfVoice != null && (
            <div className="rounded-2xl border border-hairline bg-white p-6">
              <h2 className="font-semibold text-sm text-ink mb-1">Share of Voice IA</h2>
              <p className="text-xs text-ink-soft mb-4">Part de votre domaine dans l&apos;ensemble des domaines cités sur les mêmes prompts.</p>
              <div className="flex items-center gap-6">
                <div className="text-5xl font-bold text-brand">{results.shareOfVoice}%</div>
                <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${results.shareOfVoice}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-white">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-semibold text-sm text-ink">Domaines concurrents détectés</h2>
              <p className="text-xs text-ink-soft mt-0.5">Domaines cités par les IA sur les mêmes questions que votre site.</p>
            </div>
            {loading ? <p className="p-8 text-center text-sm text-ink-soft">Chargement…</p>
            : !results?.topCompetitors?.length ? <p className="p-8 text-center text-sm text-ink-soft">Pas encore de données concurrentielles.</p>
            : (
              <div className="divide-y divide-hairline">
                {results.topCompetitors.map((c, i) => (
                  <div key={c.domain} className="flex items-center gap-4 px-6 py-3">
                    <span className="text-xs font-mono text-ink-soft w-6">{i + 1}</span>
                    <span className="flex-1 text-sm text-ink font-medium">{c.domain}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(100, (c.count / (results.topCompetitors[0]?.count ?? 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-ink-soft w-20 text-right">{c.count} citation{c.count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Pages citées ── */}
      {tab === "pages" && (
        <div className="rounded-2xl border border-hairline bg-white">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-semibold text-sm text-ink">Pages les plus citées par les IA</h2>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-ink-soft">Chargement…</p>
          : !results?.topPages?.length ? <p className="p-8 text-center text-sm text-ink-soft">Aucune citation enregistrée.</p>
          : (
            <div className="divide-y divide-hairline">
              {results.topPages.map((p, i) => (
                <div key={p.url} className="flex items-center gap-4 px-6 py-3">
                  <span className="text-xs font-mono text-ink-soft w-6">{i + 1}</span>
                  <p className="flex-1 text-sm text-brand truncate">{p.url}</p>
                  <span className="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-50 text-green-700">{p.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Setup prompts ── */}
      {tab === "setup" && (
        <div className="space-y-6">

          {/* ─ Génération depuis mots-clés ─ */}
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6">
            <h2 className="font-semibold text-sm text-ink mb-1">Générer des prompts depuis des mots-clés</h2>
            <p className="text-xs text-ink-soft mb-4">Entrez vos mots-clés (un par ligne ou séparés par des virgules) — l&apos;IA génère automatiquement des questions naturelles à surveiller.</p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
              <input type="text" placeholder="ex: monsite.fr" value={form.tracked_url}
                onChange={e => setForm(f => ({ ...f, tracked_url: e.target.value }))}
                className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex gap-3">
              <textarea rows={3} placeholder={"audit seo\nvisibilité ia\ncitation tracking"} value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
              />
              <button onClick={generateFromKeywords} disabled={generating || !kwInput.trim()}
                className="shrink-0 self-end rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-50"
              >{generating ? "Génération…" : "Générer"}</button>
            </div>

            {generatedPrompts.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-ink">{generatedPrompts.length} prompts générés — sélectionnez ceux à conserver :</p>
                  <button onClick={saveAllGenerated} disabled={savingAll || !form.tracked_url}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark transition disabled:opacity-50"
                  >{savingAll ? "Sauvegarde…" : "Tout sauvegarder"}</button>
                </div>
                {generatedPrompts.map((gp, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg bg-white border border-hairline p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-brand font-medium mb-0.5">{gp.keyword}</p>
                      <p className="text-sm text-ink">{gp.prompt_text}</p>
                      <span className="text-xs text-ink-soft">{gp.intent}</span>
                    </div>
                    <button onClick={() => removeGenerated(idx)} className="shrink-0 text-xs text-ink-soft hover:text-red-500 transition">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─ Ajout manuel ─ */}
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <h2 className="font-semibold text-sm text-ink mb-4">Ajouter un prompt manuellement</h2>
            <form onSubmit={createPrompt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                <input type="text" placeholder="ex: monsite.fr" value={form.tracked_url}
                  onChange={e => setForm(f => ({ ...f, tracked_url: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Prompt</label>
                <textarea rows={3} placeholder="ex: Quels sont les meilleurs outils SEO en 2026 ?" value={form.prompt_text}
                  onChange={e => setForm(f => ({ ...f, prompt_text: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
                />
                <p className="text-xs text-ink-soft mt-1">{form.prompt_text.length}/500</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Intention</label>
                  <select value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value as Intent }))}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand">
                    {INTENTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Thématique</label>
                  <input type="text" placeholder="ex: SEO technique" value={form.topic}
                    onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <button type="submit" disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-50">
                {creating ? "Création…" : "Ajouter le prompt"}
              </button>
            </form>
          </div>

          {/* ─ Liste des prompts ─ */}
          {prompts.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-white">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
                <h2 className="font-semibold text-sm text-ink">Prompts configurés ({prompts.length})</h2>
                <p className="text-xs text-ink-soft">Cron hebdomadaire · lundi 8h</p>
              </div>
              <div className="divide-y divide-hairline">
                {prompts.map(p => (
                  <div key={p.id} className="flex items-start gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-ink-soft font-medium">{p.tracked_url}</span>
                        <span className="text-xs text-ink-soft">{p.intent}</span>
                        {p.topic && <span className="text-xs text-ink-soft">· {p.topic}</span>}
                        {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">Inactif</span>}
                      </div>
                      <p className="text-sm text-ink">{p.prompt_text}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button onClick={() => runNow(p.id)} disabled={running === p.id}
                        title="Exécuter maintenant"
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-brand hover:border-brand transition disabled:opacity-50">
                        {running === p.id ? "…" : "▶"}
                      </button>
                      <button onClick={() => togglePrompt(p.id, !p.active)}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-ink transition">
                        {p.active ? "⏸" : "▶"}
                      </button>
                      <button onClick={() => deletePrompt(p.id)}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-red-600 hover:border-red-300 transition">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
