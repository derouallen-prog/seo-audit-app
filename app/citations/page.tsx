"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PromptSet, Intent } from "@/lib/citations/types";
import { INTENTS, PLATFORMS } from "@/lib/citations/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface RunDetail {
  id: string;
  prompt_id: string;
  platform: string;
  run_at: string;
  cited: boolean;
  mentioned: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[];
  responseExcerpt: string;
  sources: string[];
}

interface PlatformShare { cited: number; mentioned: number; total: number; share: number; }
interface MentionShareItem { mentioned: number; total: number; share: number; }

interface CompetitorMatrixRow {
  domain: string;
  total: number;
  byPlatform: Record<string, number>;
}

interface TrendPoint {
  week: string;
  share: number;
  mentionShare: number;
  cited: number;
  mentioned: number;
  total: number;
}

interface ResultsData {
  prompts: PromptSet[];
  runDetails: RunDetail[];
  citationShare: Record<string, PlatformShare>;
  mentionShare: Record<string, MentionShareItem>;
  shareOfVoice: number | null;
  competitorMatrix: CompetitorMatrixRow[];
  topCompetitors: { domain: string; count: number }[];
  topPages: { url: string; count: number }[];
  trend: TrendPoint[];
  languages: string[];
  meta: { days: number; totalRuns: number };
}

// ── Platform config ────────────────────────────────────────────────────────
const PLATFORM_CFG: Record<string, { label: string; color: string; bg: string }> = {
  perplexity:   { label: "Perplexity", color: "#20808d", bg: "#e6f4f5" },
  claude:       { label: "Claude",     color: "#c96442", bg: "#fdf0eb" },
  gemini:       { label: "Gemini",     color: "#4285f4", bg: "#eaf1fe" },
  openai:       { label: "ChatGPT",    color: "#10a37f", bg: "#e6f6f2" },
  bing_copilot: { label: "Copilot",    color: "#0078d4", bg: "#e6f2fb" },
};

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "🇫🇷 Français",
  en: "🇬🇧 English",
  es: "🇪🇸 Español",
  de: "🇩🇪 Deutsch",
  it: "🇮🇹 Italiano",
};

// ── Domain autocomplete (Clearbit public API, no key required) ─────────────
interface ClearbitSuggestion { name: string; domain: string; logo: string }

function DomainAutocomplete({ value, onChange }: { value: string; onChange: (domain: string) => void }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) setSuggestions((await res.json()) as ClearbitSuggestion[]);
      } catch { /* réseau indisponible — on ignore */ }
      finally { setFetching(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function select(domain: string) {
    setQuery(domain);
    onChange(domain);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="ex: monsite.fr ou votre marque…"
        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
      />
      {open && (fetching || suggestions.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hairline bg-white shadow-lg overflow-hidden">
          {fetching && <p className="px-4 py-2.5 text-xs text-ink-soft">Recherche…</p>}
          {suggestions.map(s => (
            <button key={s.domain} type="button" onMouseDown={() => select(s.domain)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors text-left">
              {s.logo
                ? <img src={s.logo} alt="" width={24} height={24} className="w-6 h-6 rounded shrink-0 object-contain" />
                : <div className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-bold text-ink-soft">{s.name[0]}</div>
              }
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{s.name}</p>
                <p className="text-xs text-ink-soft">{s.domain}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CFG[platform] ?? { label: platform, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function CitedBadge({ cited, mentioned }: { cited: boolean; mentioned: boolean }) {
  if (cited) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Cité
    </span>
  );
  if (mentioned) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Mentionné
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 bg-gray-50">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Absent
    </span>
  );
}

// ── SoV Donut SVG ─────────────────────────────────────────────────────────
function SoVDonut({ value, rank, total }: { value: number; rank: number; total: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="sovGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#c96442" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#sovGrad)" strokeWidth="12"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)" />
        <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1a1a2e">{value}%</text>
        <text x="50" y="60" textAnchor="middle" fontSize="7" fill="#6b7280">Share of Voice</text>
      </svg>
      {rank > 0 && (
        <p className="text-xs text-ink-soft mt-1">#{rank} sur {total} domaines</p>
      )}
    </div>
  );
}

// ── Mini trend bars ────────────────────────────────────────────────────────
function TrendBars({ data, field }: { data: TrendPoint[]; field: "share" | "mentionShare" }) {
  if (!data.length) return <p className="text-xs text-ink-soft">Pas encore de données.</p>;
  const max = Math.max(...data.map(d => d[field]), 1);
  const color = field === "share" ? "#10b981" : "#3b82f6";
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => (
        <div key={i} title={`${d.week} : ${d[field]}%`} className="flex-1 rounded-t-sm transition-all"
          style={{ height: `${Math.max((d[field] / max) * 100, d[field] > 0 ? 6 : 0)}%`, backgroundColor: color + "99" }} />
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
  const [language, setLanguage] = useState<string>("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<"citations" | "mentions">("citations");

  // Setup form
  const [form, setForm] = useState({ tracked_url: "", prompt_text: "", intent: "Informational" as Intent, topic: "", language: "fr" });
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
      const lang = language ? `&language=${language}` : "";
      const [pRes, rRes] = await Promise.all([
        fetch("/api/citations/prompts"),
        fetch(`/api/citations/results?days=${days}${lang}`),
      ]);
      if (pRes.ok) { const d = await pRes.json() as { prompts: PromptSet[] }; setPrompts(d.prompts ?? []); }
      if (rRes.ok) { const d = await rRes.json() as ResultsData; setResults(d); }
    } finally { setLoading(false); }
  }, [days, language]);

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
      setForm({ tracked_url: "", prompt_text: "", intent: "Informational", topic: "", language: "fr" });
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
      const res = await fetch("/api/citations/generate-prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords, language: form.language }) });
      if (res.ok) { const d = await res.json() as { prompts: typeof generatedPrompts }; setGeneratedPrompts(d.prompts ?? []); }
    } finally { setGenerating(false); }
  }

  async function saveAllGenerated() {
    if (!generatedPrompts.length || !form.tracked_url) { setFormError("Saisissez d'abord le domaine à tracker."); return; }
    setSavingAll(true);
    try {
      for (const gp of generatedPrompts) {
        await fetch("/api/citations/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracked_url: form.tracked_url, prompt_text: gp.prompt_text, intent: gp.intent, topic: gp.keyword, language: form.language }) });
      }
      setGeneratedPrompts([]);
      setKwInput("");
      await loadData();
    } finally { setSavingAll(false); }
  }

  // Computed
  const byPrompt: Record<string, RunDetail[]> = {};
  for (const rd of results?.runDetails ?? []) {
    if (!byPrompt[rd.prompt_id]) byPrompt[rd.prompt_id] = [];
    byPrompt[rd.prompt_id]!.push(rd);
  }

  const totalCited = Object.values(results?.citationShare ?? {}).reduce((a, v) => a + v.cited, 0);
  const totalMentioned = Object.values(results?.mentionShare ?? {}).reduce((a, v) => a + v.mentioned, 0);
  const totalRuns = results?.meta.totalRuns ?? 0;

  const ourCitations = totalCited;
  const allDomainCounts = (results?.competitorMatrix ?? []).map(c => c.total);
  const sovRank = allDomainCounts.filter(c => c > ourCitations).length + 1;
  const sovTotal = allDomainCounts.length + 1;

  const TABS = [
    { key: "overview",     label: "Vue d'ensemble" },
    { key: "analyse",      label: "Prompts analysés" },
    { key: "competitors",  label: "Concurrents" },
    { key: "pages",        label: "Pages citées" },
    { key: "setup",        label: "Prompts" },
  ] as const;

  const availableLanguages = results?.languages ?? [];
  const activePlatforms = PLATFORMS.filter(p => results?.citationShare[p] || results?.mentionShare[p]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink">Visibilité IA</h1>
          <p className="mt-1 text-sm text-ink-soft">Mentions et citations de votre marque sur Perplexity, Claude et Gemini.</p>
        </div>
        <button onClick={() => setTab("setup")}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition">
          + Nouveau prompt
        </button>
      </div>

      {/* Note méthodologique */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Note :</strong> Données issues d&apos;appels directs aux API LLMs (sans personnalisation ni mémoire). Même méthodologie que Profound, Peec AI et Otterly.
        Les <strong>citations</strong> = URL dans les sources · les <strong>mentions</strong> = marque évoquée dans le texte de la réponse.
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-accent/50 p-1 mb-5 w-fit overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === key ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      {tab !== "setup" && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-soft">Période :</span>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${days === d ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}>
                {d}j
              </button>
            ))}
          </div>
          {availableLanguages.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-soft">Langue :</span>
              <button onClick={() => setLanguage("")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!language ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}>
                Toutes
              </button>
              {availableLanguages.map(l => (
                <button key={l} onClick={() => setLanguage(l)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${language === l ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}>
                  {LANGUAGE_LABELS[l] ?? l}
                </button>
              ))}
            </div>
          )}
          {tab === "overview" && (
            <div className="ml-auto flex items-center gap-1 rounded-lg bg-accent/60 p-0.5">
              <button onClick={() => setMetricMode("citations")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${metricMode === "citations" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                Citations
              </button>
              <button onClick={() => setMetricMode("mentions")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${metricMode === "mentions" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                Mentions
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Vue d'ensemble ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p>
          : totalRuns === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline p-16 text-center">
              <p className="text-ink-soft text-sm mb-2">Aucun run effectué. Commencez par ajouter des prompts.</p>
              <button onClick={() => setTab("setup")}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition">
                + Ajouter des prompts
              </button>
            </div>
          ) : (
            <>
              {/* Top KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr] gap-4 items-stretch">
                <div className="rounded-2xl border border-hairline bg-white p-6 flex flex-col items-center justify-center">
                  <SoVDonut value={results?.shareOfVoice ?? 0} rank={sovRank} total={sovTotal} />
                </div>
                <div className={`rounded-2xl border p-5 ${metricMode === "citations" ? "border-green-200 bg-green-50" : "border-hairline bg-white"}`}>
                  <p className="text-xs text-ink-soft mb-1">Citations (URL)</p>
                  <p className="text-4xl font-bold text-green-700">{totalCited}</p>
                  <p className="text-xs text-ink-soft mt-2">URL apparaît dans les sources IA</p>
                  <div className="mt-3"><TrendBars data={results?.trend ?? []} field="share" /></div>
                </div>
                <div className={`rounded-2xl border p-5 ${metricMode === "mentions" ? "border-blue-200 bg-blue-50" : "border-hairline bg-white"}`}>
                  <p className="text-xs text-ink-soft mb-1">Mentions (texte)</p>
                  <p className="text-4xl font-bold text-blue-600">{totalMentioned}</p>
                  <p className="text-xs text-ink-soft mt-2">Marque évoquée dans la réponse</p>
                  <div className="mt-3"><TrendBars data={results?.trend ?? []} field="mentionShare" /></div>
                </div>
                <div className="rounded-2xl border border-hairline bg-white p-5">
                  <p className="text-xs text-ink-soft mb-1">Runs ({days}j)</p>
                  <p className="text-4xl font-bold text-ink">{totalRuns}</p>
                  <p className="text-xs text-ink-soft mt-2">{prompts.filter(p => p.active).length} prompts actifs</p>
                  <p className="text-xs text-ink-soft mt-1">{activePlatforms.join(" · ")}</p>
                </div>
              </div>

              {/* Platform breakdown */}
              <div className="rounded-2xl border border-hairline bg-white p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-sm text-ink">Répartition par plateforme</h2>
                  <div className="flex items-center gap-4 text-xs text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-1.5 rounded-full bg-green-500" />Citation (URL)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-1.5 rounded-full bg-blue-400" />Mention (texte)
                    </span>
                  </div>
                </div>
                <div className="space-y-5">
                  {PLATFORMS.filter(p => results?.citationShare[p]).map(p => {
                    const cit = results!.citationShare[p]!;
                    const men = results?.mentionShare[p];
                    const cfg = PLATFORM_CFG[p]!;
                    return (
                      <div key={p} className="flex items-center gap-4">
                        <div className="w-24 shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all duration-700"
                                style={{ width: `${cit.share}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-green-700 w-10 text-right">{cit.share}%</span>
                            <span className="text-xs text-ink-soft w-14 text-right">{cit.cited}/{cit.total}</span>
                          </div>
                          {men && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-blue-400 transition-all duration-700"
                                  style={{ width: `${men.share}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-blue-600 w-10 text-right">{men.share}%</span>
                              <span className="text-xs text-ink-soft w-14 text-right">{men.mentioned}/{men.total}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Prompts analysés ──────────────────────────────────────────── */}
      {tab === "analyse" && (
        <div className="space-y-4">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p>
          : !results?.runDetails.length ? (
            <div className="rounded-2xl border border-dashed border-hairline p-12 text-center">
              <p className="text-sm text-ink-soft">Aucun run enregistré sur cette période.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
              <div className="grid grid-cols-[2fr_3fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-hairline bg-accent/30 text-xs font-semibold text-ink-soft uppercase tracking-wide">
                <span>Prompt</span>
                <span>Réponse IA</span>
                <span>Statut</span>
                <span className="text-center">Sources</span>
                <span>Plateformes</span>
              </div>
              {results.prompts.map(prompt => {
                const pRuns = byPrompt[prompt.id] ?? [];
                if (!pRuns.length) return null;
                const cited = pRuns.some(r => r.cited);
                const mentioned = pRuns.some(r => r.mentioned);
                const isOpen = expandedRow === prompt.id;
                const firstRun = pRuns[0]!;
                return (
                  <div key={prompt.id} className="border-b border-hairline last:border-0">
                    <button onClick={() => setExpandedRow(isOpen ? null : prompt.id)}
                      className="w-full grid grid-cols-[2fr_3fr_auto_auto_auto] gap-4 px-5 py-4 text-left hover:bg-accent/20 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink line-clamp-2">{prompt.prompt_text}</p>
                        <span className="text-xs text-ink-soft">{prompt.tracked_url}</span>
                      </div>
                      <p className="text-xs text-ink-soft line-clamp-3 leading-relaxed self-center">
                        {firstRun.responseExcerpt || <em>Non disponible</em>}
                      </p>
                      <div className="self-center"><CitedBadge cited={cited} mentioned={mentioned} /></div>
                      <div className="text-sm text-center text-ink-soft self-center">{firstRun.sources.length}</div>
                      <div className="flex flex-wrap gap-1 self-center">
                        {pRuns.map(r => (
                          <span key={r.platform} className="w-2 h-2 rounded-full"
                            title={`${PLATFORM_CFG[r.platform]?.label}: ${r.cited ? "cité" : r.mentioned ? "mentionné" : "absent"}`}
                            style={{ backgroundColor: r.cited ? PLATFORM_CFG[r.platform]?.color : r.mentioned ? "#93c5fd" : "#d1d5db" }} />
                        ))}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="bg-accent/20 border-t border-hairline divide-y divide-hairline/60">
                        {pRuns.map(run => (
                          <div key={run.id} className="px-6 py-4 grid grid-cols-[140px_1fr_auto] gap-4 items-start">
                            <PlatformBadge platform={run.platform} />
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
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <CitedBadge cited={run.cited} mentioned={run.mentioned} />
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

      {/* ── TAB: Concurrents (matrix Ahrefs-style) ────────────────────────── */}
      {tab === "competitors" && (
        <div className="space-y-5">
          {results?.shareOfVoice != null && (
            <div className="rounded-2xl border border-hairline bg-white p-6 flex items-center gap-8 flex-wrap">
              <SoVDonut value={results.shareOfVoice} rank={sovRank} total={sovTotal} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink mb-1">Share of Voice IA</p>
                <p className="text-xs text-ink-soft max-w-sm">
                  Part de votre domaine dans l&apos;ensemble des URLs citées sur les mêmes questions.
                  Calculé sur les domaines co-présents dans les mêmes runs.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-6 text-xs">
                  <span className="text-ink-soft">Rang : <strong className="text-ink">#{sovRank}</strong> / {sovTotal}</span>
                  <span className="text-ink-soft">Citations : <strong className="text-green-700">{totalCited}</strong></span>
                  <span className="text-ink-soft">Mentions : <strong className="text-blue-600">{totalMentioned}</strong></span>
                </div>
              </div>
            </div>
          )}

          {loading ? <p className="py-8 text-center text-sm text-ink-soft">Chargement…</p>
          : !results?.competitorMatrix.length ? (
            <div className="rounded-2xl border border-dashed border-hairline p-12 text-center">
              <p className="text-sm text-ink-soft">Pas encore de données concurrentielles.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline">
                <h2 className="font-semibold text-sm text-ink">Domaines cités en concurrence</h2>
                <p className="text-xs text-ink-soft mt-0.5">Apparitions dans les sources IA sur les mêmes prompts que votre site.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-accent/30">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wide">Domaine</th>
                      <th className="px-4 py-3 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">Total</th>
                      {PLATFORMS.filter(p => results.competitorMatrix.some(r => r.byPlatform[p])).map(p => (
                        <th key={p} className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: PLATFORM_CFG[p]?.bg, color: PLATFORM_CFG[p]?.color }}>
                            {PLATFORM_CFG[p]?.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {results.competitorMatrix.map((row, i) => {
                      const maxTotal = results.competitorMatrix[0]?.total ?? 1;
                      const pCols = PLATFORMS.filter(p => results.competitorMatrix.some(r => r.byPlatform[p]));
                      return (
                        <tr key={row.domain} className="hover:bg-accent/10 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-ink-soft w-5">{i + 1}</span>
                              <span className="font-medium text-ink">{row.domain}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-gray-400 transition-all"
                                  style={{ width: `${(row.total / maxTotal) * 100}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-ink w-6 text-right">{row.total}</span>
                            </div>
                          </td>
                          {pCols.map(p => {
                            const val = row.byPlatform[p] ?? 0;
                            const maxForP = Math.max(...results.competitorMatrix.map(r => r.byPlatform[p] ?? 0), 1);
                            return (
                              <td key={p} className="px-4 py-3 text-center">
                                {val > 0 ? (
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: PLATFORM_CFG[p]?.bg }}>
                                      <div className="h-full rounded-full transition-all"
                                        style={{ width: `${(val / maxForP) * 100}%`, backgroundColor: PLATFORM_CFG[p]?.color }} />
                                    </div>
                                    <span className="text-xs text-ink-soft">{val}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-200">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Pages citées ─────────────────────────────────────────────── */}
      {tab === "pages" && (
        <div className="rounded-2xl border border-hairline bg-white">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-semibold text-sm text-ink">Pages les plus citées</h2>
            <p className="text-xs text-ink-soft mt-0.5">URLs de votre site apparaissant en source dans les réponses IA.</p>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-ink-soft">Chargement…</p>
          : !results?.topPages?.length ? <p className="p-8 text-center text-sm text-ink-soft">Aucune citation enregistrée.</p>
          : (
            <div className="divide-y divide-hairline">
              {results.topPages.map((p, i) => {
                const max = results.topPages[0]?.count ?? 1;
                return (
                  <div key={p.url} className="flex items-center gap-4 px-6 py-3">
                    <span className="text-xs font-mono text-ink-soft w-6">{i + 1}</span>
                    <p className="flex-1 text-sm text-brand truncate">{p.url}</p>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${(p.count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 w-8 text-center">{p.count}×</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Setup prompts ────────────────────────────────────────────── */}
      {tab === "setup" && (
        <div className="space-y-6">

          {/* Génération depuis mots-clés */}
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6">
            <h2 className="font-semibold text-sm text-ink mb-1">Générer des prompts depuis des mots-clés</h2>
            <p className="text-xs text-ink-soft mb-4">Entrez vos mots-clés (un par ligne ou séparés par virgules) — l&apos;IA génère des questions naturelles à surveiller.</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                <DomainAutocomplete
                  value={form.tracked_url}
                  onChange={v => setForm(f => ({ ...f, tracked_url: v }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Langue des prompts</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand">
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <textarea rows={3} placeholder={"audit seo\nvisibilité ia\ncitation tracking"} value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none" />
              <button onClick={generateFromKeywords} disabled={generating || !kwInput.trim()}
                className="shrink-0 self-end rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-50">
                {generating ? "Génération…" : "Générer"}
              </button>
            </div>

            {generatedPrompts.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-ink">{generatedPrompts.length} prompts générés :</p>
                  <button onClick={saveAllGenerated} disabled={savingAll || !form.tracked_url}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark transition disabled:opacity-50">
                    {savingAll ? "Sauvegarde…" : "Tout sauvegarder"}
                  </button>
                </div>
                {generatedPrompts.map((gp, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg bg-white border border-hairline p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-brand font-medium mb-0.5">{gp.keyword}</p>
                      <p className="text-sm text-ink">{gp.prompt_text}</p>
                      <span className="text-xs text-ink-soft">{gp.intent}</span>
                    </div>
                    <button onClick={() => setGeneratedPrompts(g => g.filter((_, i) => i !== idx))}
                      className="shrink-0 text-xs text-ink-soft hover:text-red-500 transition">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ajout manuel */}
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <h2 className="font-semibold text-sm text-ink mb-4">Ajouter un prompt manuellement</h2>
            <form onSubmit={createPrompt} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                  <DomainAutocomplete
                    value={form.tracked_url}
                    onChange={v => setForm(f => ({ ...f, tracked_url: v }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Langue</label>
                  <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand">
                    {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Prompt</label>
                <textarea rows={3} placeholder="ex: Quels sont les meilleurs outils SEO en 2026 ?" value={form.prompt_text}
                  onChange={e => setForm(f => ({ ...f, prompt_text: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none" />
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
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand" />
                </div>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <button type="submit" disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-50">
                {creating ? "Création…" : "Ajouter le prompt"}
              </button>
            </form>
          </div>

          {/* Liste des prompts */}
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
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/60 text-ink-soft">{LANGUAGE_LABELS[p.language] ?? p.language}</span>
                        {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">Inactif</span>}
                      </div>
                      <p className="text-sm text-ink">{p.prompt_text}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button onClick={() => runNow(p.id)} disabled={running === p.id} title="Exécuter maintenant"
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
