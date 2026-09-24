"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
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

interface RunClean {
  id: string;
  prompt_id: string;
  platform: string;
  run_at: string;
  cited: boolean;
  mentioned: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[];
  response_text: string | null;
}

interface ResultsData {
  prompts: PromptSet[];
  runs: RunClean[];
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

interface UserProfile {
  site_url?: string | null;
  market?: string | null;
  competitors?: string[] | null;
}

type VolumeLevel = "faible" | "moyen" | "élevé";

interface GeneratedPrompt {
  keyword: string;
  prompt_text: string;
  intent: Intent;
  estimated_volume?: VolumeLevel;
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

function getWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

// ── Domain autocomplete ────────────────────────────────────────────────────
interface ClearbitSuggestion { name: string; domain: string; logo: string }

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

function DomainAutocomplete({ value, onChange }: { value: string; onChange: (domain: string) => void }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const inputDomain = query.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const faviconUrl = hasTLD(query.trim()) && inputDomain
    ? `https://www.google.com/s2/favicons?domain=${inputDomain}&sz=64`
    : null;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2 || hasTLD(q)) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) setSuggestions((await res.json()) as ClearbitSuggestion[]);
      } catch { /* réseau indisponible */ }
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
      {faviconUrl && (
        <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          <Image src={faviconUrl} alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded object-contain" />
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="ex: monsite.fr ou votre marque…"
        className={`w-full rounded-lg border border-hairline bg-white py-2 text-sm focus:outline-none focus:border-brand ${faviconUrl ? "pl-9 pr-3" : "px-3"}`}
      />
      {open && (fetching || suggestions.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hairline bg-white shadow-lg overflow-hidden">
          {fetching && <p className="px-4 py-2.5 text-xs text-ink-soft">Recherche…</p>}
          {suggestions.map(s => (
            <button key={s.domain} type="button" onMouseDown={() => select(s.domain)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors text-left">
              {s.logo
                ? <Image src={s.logo} alt="" width={24} height={24} unoptimized className="w-6 h-6 rounded shrink-0 object-contain" />
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
function TrendBars({ data, field, selectedWeek, onBarClick }: {
  data: TrendPoint[];
  field: "share" | "mentionShare";
  selectedWeek?: string | null;
  onBarClick?: (week: string) => void;
}) {
  if (!data.length) return <p className="text-xs text-ink-soft">Pas encore de données.</p>;
  const max = Math.max(...data.map(d => d[field]), 1);
  const color = field === "share" ? "#10b981" : "#3b82f6";
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => {
        const isSelected = selectedWeek === d.week;
        const isDimmed = !!selectedWeek && !isSelected;
        const weekDate = new Date(d.week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return (
          <div key={i}
            onClick={() => onBarClick?.(isSelected ? "" : d.week)}
            title={`Sem. du ${weekDate} : ${d[field]}%`}
            className={`flex-1 rounded-t-sm transition-all ${onBarClick ? "cursor-pointer" : ""} ${isDimmed ? "opacity-25" : ""} ${isSelected ? "ring-1 ring-current ring-offset-1" : ""}`}
            style={{ height: `${Math.max((d[field] / max) * 100, d[field] > 0 ? 6 : 0)}%`, backgroundColor: color + (isSelected ? "dd" : "99") }}
          />
        );
      })}
    </div>
  );
}

// ── Weekly drill-down panel ────────────────────────────────────────────────
function WeekPanel({ week, runs, prompts, onClose }: {
  week: string;
  runs: RunClean[];
  prompts: PromptSet[];
  onClose: () => void;
}) {
  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]));
  const weekRuns = runs.filter(r => getWeekKey(r.run_at) === week).sort((a, b) => a.platform.localeCompare(b.platform));
  const weekStart = new Date(week + "T12:00:00Z");
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmtShort = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const label = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;
  const cited = weekRuns.filter(r => r.cited).length;
  const mentioned = weekRuns.filter(r => r.mentioned).length;
  if (!weekRuns.length) return null;
  return (
    <div className="rounded-xl border border-hairline bg-white overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-accent/30">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-xs font-semibold text-ink">Semaine du {label}</p>
          <span className="text-xs text-green-700 font-medium">{cited} citation{cited !== 1 ? "s" : ""}</span>
          <span className="text-xs text-blue-600 font-medium">{mentioned} mention{mentioned !== 1 ? "s" : ""}</span>
          <span className="text-xs text-ink-soft">{weekRuns.length} run{weekRuns.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={onClose} className="text-xs text-ink-soft hover:text-ink transition px-1">✕</button>
      </div>
      <div className="divide-y divide-hairline/60 max-h-72 overflow-y-auto">
        {weekRuns.map(run => {
          const prompt = promptMap[run.prompt_id];
          return (
            <div key={run.id} className="px-5 py-3 flex items-start gap-4">
              <PlatformBadge platform={run.platform} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-soft line-clamp-1">{prompt?.prompt_text ?? "—"}</p>
                {run.response_text && (
                  <p className="text-xs text-ink mt-1 leading-relaxed line-clamp-2 opacity-70">{run.response_text}</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <CitedBadge cited={run.cited} mentioned={run.mentioned} />
                <span className="text-xs text-ink-soft">{new Date(run.run_at).toLocaleDateString("fr-FR")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CitationsPage() {
  const [tab, setTab] = useState<"visibilite" | "prompts" | "citations">("visibilite");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [prompts, setPrompts] = useState<PromptSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [days, setDays] = useState(30);
  const [language, setLanguage] = useState<string>("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<"citations" | "mentions">("citations");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [runAllStatus, setRunAllStatus] = useState<{ loading: boolean; ran?: number; errors?: number } | null>(null);

  // User profile (for domain pre-fill)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Setup form
  const [form, setForm] = useState({ tracked_url: "", prompt_text: "", intent: "Informational" as Intent, topic: "", language: "fr" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Prompt generation
  const [kwInput, setKwInput] = useState("");
  const [brandName, setBrandName] = useState("");
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);

  // Load user profile and pre-fill domain
  useEffect(() => {
    fetch("/api/account/profile")
      .then(r => r.ok ? r.json() : null)
      .then((data: { profile?: UserProfile } | null) => {
        if (data?.profile) {
          setUserProfile(data.profile);
          if (data.profile.site_url) {
            const domain = data.profile.site_url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? data.profile.site_url;
            setForm(f => ({ ...f, tracked_url: f.tracked_url || domain }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const lang = language ? `&language=${language}` : "";
      const [pRes, rRes] = await Promise.all([
        fetch("/api/citations/prompts"),
        fetch(`/api/citations/results?days=${days}${lang}`),
      ]);
      if (pRes.status === 401 || rRes.status === 401) { setNotLoggedIn(true); return; }
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
      setForm(f => ({ ...f, prompt_text: "", topic: "" }));
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

  async function runAll() {
    setRunAllStatus({ loading: true });
    try {
      const res = await fetch("/api/citations/run-all", { method: "POST" });
      const data = await res.json() as { ran?: number; errors?: number };
      setRunAllStatus({ loading: false, ran: data.ran ?? 0, errors: data.errors ?? 0 });
      await loadData();
    } catch {
      setRunAllStatus({ loading: false, errors: 1 });
    }
  }

  async function runNow(promptId: string) {
    setRunning(promptId);
    try {
      await fetch("/api/citations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt_id: promptId }) });
      await loadData();
    } finally { setRunning(null); }
  }

  async function getSuggestions() {
    const domain = form.tracked_url || (userProfile?.site_url ?? "");
    const brand = brandName || domain.replace(/\.[^.]+$/, "");
    if (!brand && !domain) return;
    setGenerating(true);
    setGeneratedPrompts([]);
    setPromptsSaved(false);
    try {
      const res = await fetch("/api/citations/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, domain, language: form.language, market: userProfile?.market }),
      });
      if (res.ok) { const d = await res.json() as { prompts: GeneratedPrompt[] }; setGeneratedPrompts(d.prompts ?? []); }
    } finally { setGenerating(false); }
  }

  async function generateFromKeywords() {
    const keywords = kwInput.split(/[,\n]+/).map(k => k.trim()).filter(Boolean).slice(0, 15);
    if (!keywords.length) return;
    setGenerating(true);
    setGeneratedPrompts([]);
    setPromptsSaved(false);
    try {
      const res = await fetch("/api/citations/generate-prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords, language: form.language }) });
      if (res.ok) { const d = await res.json() as { prompts: GeneratedPrompt[] }; setGeneratedPrompts(d.prompts ?? []); }
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
      setPromptsSaved(true);
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
    { key: "visibilite" as const, label: "Visibilité" },
    { key: "prompts"    as const, label: "Prompts" },
    { key: "citations"  as const, label: "Citations" },
  ];

  const availableLanguages = results?.languages ?? [];
  const activePlatforms = PLATFORMS.filter(p => results?.citationShare[p] || results?.mentionShare[p]);

  if (notLoggedIn) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10">
            <svg className="h-7 w-7 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl text-ink mb-2">Citations IA</h1>
          <p className="text-sm text-ink-soft mb-6">Connectez-vous pour configurer vos prompts et suivre votre visibilité sur les moteurs IA.</p>
          <a href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition shadow glow-brand">
            Se connecter
          </a>
          <p className="mt-4 text-xs text-ink-soft">
            Pas encore de compte ?{" "}
            <a href="/auth" className="text-brand hover:underline">Créer un compte gratuit</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-3xl text-ink">Visibilité IA</h1>
            {userProfile?.site_url && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/60 text-xs text-ink-soft">
                <Image
                  src={`https://www.google.com/s2/favicons?domain=${userProfile.site_url.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(/[/?#]/)[0]}&sz=32`}
                  alt="" width={14} height={14} unoptimized className="rounded"
                />
                {userProfile.site_url.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(/[/?#]/)[0]}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-soft">Mentions et citations de votre marque sur Perplexity, Claude, Gemini, ChatGPT et Copilot.</p>
        </div>
        <button onClick={() => setTab("prompts")}
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
      <div className="flex gap-1 rounded-xl bg-accent/50 p-1 mb-5 w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters bar (Visibilité + Citations) */}
      {tab !== "prompts" && (
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
          {tab === "visibilite" && (
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

      {/* ── TAB: Visibilité ────────────────────────────────────────────────── */}
      {tab === "visibilite" && (
        <div className="space-y-5">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p>
          : totalRuns === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline bg-white p-12 text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
              </div>
              <h3 className="font-display text-xl text-ink mb-2">Surveillez votre visibilité IA</h3>
              <p className="text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
                {prompts.length > 0
                  ? `${prompts.length} prompt${prompts.length > 1 ? "s" : ""} configuré${prompts.length > 1 ? "s" : ""} — lancez une analyse pour voir vos données.`
                  : "Configurez des prompts dans l'onglet Prompts, puis lancez une analyse."}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                {prompts.length > 0 ? (
                  <button onClick={runAll} disabled={runAllStatus?.loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition shadow glow-brand disabled:opacity-60">
                    {runAllStatus?.loading ? "Analyse en cours…" : "▶ Lancer l'analyse"}
                  </button>
                ) : (
                  <button onClick={() => setTab("prompts")}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition shadow glow-brand">
                    Configurer mes prompts →
                  </button>
                )}
              </div>
              {runAllStatus && !runAllStatus.loading && (
                <p className={`mt-3 text-xs ${(runAllStatus.errors ?? 0) > 0 ? "text-amber-600" : "text-green-700"}`}>
                  {runAllStatus.ran} analyse{(runAllStatus.ran ?? 0) !== 1 ? "s" : ""} terminée{(runAllStatus.ran ?? 0) !== 1 ? "s" : ""}
                  {(runAllStatus.errors ?? 0) > 0 && ` · ${runAllStatus.errors} erreur(s)`}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* ── 4 KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "VISIBILITY", value: `${results?.shareOfVoice ?? 0}%`, sub: `Rang #${sovRank}/${sovTotal}`, color: "text-ink" },
                  { label: "CITATIONS", value: String(totalCited), sub: "URLs dans sources IA", color: "text-green-700" },
                  { label: "MENTIONS", value: String(totalMentioned), sub: "Marque dans réponses", color: "text-blue-600" },
                  { label: "VOS PAGES", value: String(results?.topPages?.length ?? 0), sub: "URLs citées distinctes", color: "text-purple-700" },
                ].map(k => (
                  <div key={k.label} className="rounded-xl border border-hairline bg-white px-4 py-4">
                    <p className="text-[10px] font-semibold tracking-widest text-ink-soft/60 uppercase mb-1">{k.label}</p>
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-ink-soft mt-1">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── Trend chart + Competitor leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

                {/* Trend polyline */}
                <div className="rounded-2xl border border-hairline bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-sm text-ink">Évolution sur {days}j</h2>
                    <div className="flex items-center gap-1 rounded-lg bg-accent/60 p-0.5">
                      <button onClick={() => setMetricMode("citations")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${metricMode === "citations" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                        Citations
                      </button>
                      <button onClick={() => setMetricMode("mentions")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${metricMode === "mentions" ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}>
                        Mentions
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const trend = results?.trend ?? [];
                    if (!trend.length) return <p className="text-xs text-ink-soft text-center py-8">Pas encore de données de tendance.</p>;
                    const field = metricMode === "citations" ? "share" : "mentionShare";
                    const vals = trend.map(d => d[field]);
                    const max = Math.max(...vals, 1);
                    const W = 560; const H = 120; const pad = 8;
                    const pts = trend.map((d, i) => {
                      const x = pad + (i / Math.max(trend.length - 1, 1)) * (W - 2 * pad);
                      const y = H - pad - (d[field] / max) * (H - 2 * pad);
                      return `${x},${y}`;
                    }).join(" ");
                    const areaBot = H - pad;
                    const firstPt = `${pad},${H - pad}`;
                    const lastPt = `${W - pad},${H - pad}`;
                    const lineColor = metricMode === "citations" ? "#10b981" : "#3b82f6";
                    const areaColor = metricMode === "citations" ? "#10b98118" : "#3b82f618";
                    return (
                      <div className="overflow-x-auto">
                        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full" style={{ minWidth: 200, height: 120 }}>
                          {/* gridlines */}
                          {[0,25,50,75,100].map(v => {
                            const y = H - pad - (v / 100) * (H - 2 * pad);
                            return <line key={v} x1={pad} y1={y} x2={W - pad} y2={y} stroke="#f3f4f6" strokeWidth="1"/>;
                          })}
                          {/* area fill */}
                          <polyline points={`${firstPt} ${pts} ${lastPt} ${pad},${areaBot}`} fill={areaColor} stroke="none"/>
                          {/* line */}
                          <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                          {/* dots */}
                          {trend.map((d, i) => {
                            const x = pad + (i / Math.max(trend.length - 1, 1)) * (W - 2 * pad);
                            const y = H - pad - (d[field] / max) * (H - 2 * pad);
                            return <circle key={i} cx={x} cy={y} r="3" fill={lineColor} stroke="white" strokeWidth="1.5">
                              <title>{new Date(d.week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {d[field]}%</title>
                            </circle>;
                          })}
                        </svg>
                        {/* x labels */}
                        <div className="flex justify-between mt-1 px-1">
                          {trend.filter((_, i) => i === 0 || i === Math.floor(trend.length / 2) || i === trend.length - 1).map((d, i) => (
                            <span key={i} className="text-[10px] text-ink-soft">
                              {new Date(d.week + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Competitor leaderboard */}
                {results?.competitorMatrix && results.competitorMatrix.length > 0 && (
                  <div className="rounded-2xl border border-hairline bg-white p-5">
                    <h2 className="font-semibold text-sm text-ink mb-4">Benchmark IA</h2>
                    <div className="space-y-2.5">
                      {results.competitorMatrix.slice(0, 7).map((row, i) => {
                        const maxTotal = results.competitorMatrix[0]?.total ?? 1;
                        const share = Math.round((row.total / Math.max(totalRuns, 1)) * 100);
                        return (
                          <div key={row.domain} className="flex items-center gap-2">
                            <Image
                              src={`https://www.google.com/s2/favicons?domain=${row.domain}&sz=32`}
                              alt="" width={16} height={16} unoptimized
                              className="rounded shrink-0 w-4 h-4 object-contain"
                            />
                            <p className="flex-1 text-xs text-ink truncate min-w-0">{row.domain}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full bg-brand/60 transition-all"
                                  style={{ width: `${(row.total / maxTotal) * 100}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-ink w-8 text-right">{share}%</span>
                              <span className="text-xs text-ink-soft w-3">#{i + 1}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly drill-down */}
              {selectedWeek && results && (
                <WeekPanel
                  week={selectedWeek}
                  runs={results.runs ?? []}
                  prompts={results.prompts}
                  onClose={() => setSelectedWeek(null)}
                />
              )}

              {/* ── Sources table (Promptwatch style) */}
              {results?.runDetails && results.runDetails.length > 0 && (() => {
                // Collect unique cited sources with favicon + type inference
                const sourceMap: Map<string, { url: string; domain: string; prompt: string; type: string; count: number }> = new Map();
                const TYPE_RULES: [RegExp, string][] = [
                  [/reddit\.com/i, "Forum"],
                  [/quora\.com/i, "Forum"],
                  [/trustpilot|avis|reviews?|g2\.com|capterra/i, "Avis"],
                  [/wikipedia\.org/i, "Encyclopédie"],
                  [/youtube\.com/i, "Vidéo"],
                  [/amazon\.|fnac\.|cdiscount\.|darty\./i, "E-commerce"],
                  [/\.gov|\.gouv/i, "Officiel"],
                  [/blog|article|magazine|media|presse|news|actu/i, "Blog/Media"],
                ];
                for (const rd of results.runDetails) {
                  for (const src of rd.sources.slice(0, 5)) {
                    const domain = src.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] ?? "";
                    if (!domain) continue;
                    const existing = sourceMap.get(domain);
                    if (existing) { existing.count++; continue; }
                    let type = "Corporate";
                    for (const [re, t] of TYPE_RULES) {
                      if (re.test(domain) || re.test(src)) { type = t; break; }
                    }
                    const promptObj = results.prompts.find(p => p.id === rd.prompt_id);
                    sourceMap.set(domain, { url: src, domain, prompt: promptObj?.prompt_text ?? "", type, count: 1 });
                  }
                }
                const sourceList = [...sourceMap.values()].sort((a, b) => b.count - a.count).slice(0, 12);
                if (!sourceList.length) return null;

                const TYPE_COLORS: Record<string, string> = {
                  Forum: "bg-orange-50 text-orange-700",
                  Avis: "bg-yellow-50 text-yellow-700",
                  "Blog/Media": "bg-blue-50 text-blue-700",
                  Encyclopédie: "bg-gray-100 text-gray-600",
                  Vidéo: "bg-red-50 text-red-600",
                  "E-commerce": "bg-purple-50 text-purple-700",
                  Officiel: "bg-green-50 text-green-700",
                  Corporate: "bg-slate-100 text-slate-600",
                };
                return (
                  <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-hairline flex items-center gap-4 flex-wrap">
                      <div>
                        <h2 className="font-semibold text-sm text-ink">Sources citées par les IA</h2>
                        <p className="text-xs text-ink-soft mt-0.5">Domaines qui apparaissent le plus souvent dans les réponses sur vos prompts.</p>
                      </div>
                      <div className="flex items-center gap-4 ml-auto text-xs">
                        <span className="text-ink-soft"><strong className="text-ink">{results.runDetails.reduce((a, r) => a + r.sources.length, 0)}</strong> sources totales</span>
                        <span className="text-ink-soft"><strong className="text-ink">{results.topPages?.length ?? 0}</strong> de vos pages</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-hairline bg-accent/30">
                            <th className="text-left px-6 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">Source</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">Prompt associé</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-right">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {sourceList.map(src => (
                            <tr key={src.domain} className="hover:bg-accent/10 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-2.5">
                                  <Image
                                    src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                                    alt="" width={18} height={18} unoptimized
                                    className="rounded shrink-0 w-[18px] h-[18px] object-contain"
                                  />
                                  <span className="text-sm font-medium text-ink truncate max-w-[200px]">{src.domain}</span>
                                  {src.count > 1 && <span className="text-xs text-ink-soft shrink-0">×{src.count}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <p className="text-xs text-ink-soft truncate">{src.prompt || "—"}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[src.type] ?? "bg-gray-100 text-gray-600"}`}>
                                  {src.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Run all button */}
              <div className="flex items-center gap-3 pt-1">
                <button onClick={runAll} disabled={runAllStatus?.loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-hairline px-4 py-2 text-sm font-medium text-ink-soft hover:text-brand hover:border-brand transition disabled:opacity-50">
                  {runAllStatus?.loading ? "Analyse en cours…" : "▶ Relancer l'analyse"}
                </button>
                {runAllStatus && !runAllStatus.loading && (
                  <p className={`text-xs ${(runAllStatus.errors ?? 0) > 0 ? "text-amber-600" : "text-green-700"}`}>
                    {runAllStatus.ran} analyse{(runAllStatus.ran ?? 0) !== 1 ? "s" : ""} terminée{(runAllStatus.ran ?? 0) !== 1 ? "s" : ""}
                    {(runAllStatus.errors ?? 0) > 0 && ` · ${runAllStatus.errors} erreur(s)`}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Prompts ──────────────────────────────────────────────────── */}
      {tab === "prompts" && (
        <div className="space-y-6 max-w-2xl">

          {/* Step 1: get suggestions */}
          {!generatedPrompts.length && !promptsSaved && (
            <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-sm text-ink mb-1">Obtenir des suggestions de prompts</h2>
                <p className="text-xs text-ink-soft">On génère des questions que de vraies personnes posent aux IA sur votre marque et votre marché.</p>
              </div>

              {userProfile?.site_url ? (
                /* Profile already filled */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-accent/40 px-4 py-3">
                    <Image
                      src={`https://www.google.com/s2/favicons?domain=${userProfile.site_url.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(/[/?#]/)[0]}&sz=32`}
                      alt="" width={18} height={18} unoptimized className="rounded shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{userProfile.site_url.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(/[/?#]/)[0]}</p>
                      {userProfile.market && <p className="text-xs text-ink-soft">{userProfile.market}</p>}
                    </div>
                    <a href="/account/site" className="text-xs text-brand hover:underline shrink-0">Modifier</a>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                  <button onClick={getSuggestions} disabled={generating}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-60">
                    {generating ? (
                      <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Analyse en cours…</>
                    ) : "✦ Obtenir des suggestions de prompts"}
                  </button>
                </div>
              ) : (
                /* No profile yet */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Nom de marque</label>
                      <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)}
                        placeholder="ex: Nomie Épices"
                        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">Domaine de marque</label>
                      <DomainAutocomplete
                        value={form.tracked_url}
                        onChange={v => setForm(f => ({ ...f, tracked_url: v }))}
                      />
                    </div>
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
                  <button onClick={getSuggestions} disabled={generating || (!brandName.trim() && !form.tracked_url.trim())}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-60">
                    {generating ? (
                      <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Analyse en cours…</>
                    ) : "✦ Obtenir des suggestions de prompts"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generated prompts with volume */}
          {generatedPrompts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">{generatedPrompts.length} prompts suggérés</p>
                <p className="text-xs text-ink-soft">Volume estimé sur les plateformes IA</p>
              </div>
              <div className="space-y-2">
                {generatedPrompts.map((gp, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-xl bg-white border border-hairline p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs text-brand font-medium">{gp.keyword}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/60 text-ink-soft">{gp.intent}</span>
                        {gp.estimated_volume && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            gp.estimated_volume === "élevé" ? "bg-green-50 text-green-700" :
                            gp.estimated_volume === "moyen" ? "bg-blue-50 text-blue-600" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {gp.estimated_volume === "élevé" ? "↑ " : gp.estimated_volume === "moyen" ? "→ " : "↓ "}
                            Volume {gp.estimated_volume}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ink">{gp.prompt_text}</p>
                    </div>
                    <button onClick={() => setGeneratedPrompts(g => g.filter((_, i) => i !== idx))}
                      className="shrink-0 text-xs text-ink-soft hover:text-red-500 transition mt-0.5">✕</button>
                  </div>
                ))}
              </div>

              {/* Domain + save */}
              {!form.tracked_url && !userProfile?.site_url && (
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                  <DomainAutocomplete value={form.tracked_url} onChange={v => setForm(f => ({ ...f, tracked_url: v }))} />
                </div>
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <button onClick={saveAllGenerated} disabled={savingAll}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-60">
                {savingAll ? "Sauvegarde…" : `Activer ces ${generatedPrompts.length} prompts`}
              </button>
            </div>
          )}

          {/* Post-save CTA */}
          {promptsSaved && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
              <div className="text-2xl mb-2">✓</div>
              <p className="font-semibold text-sm text-green-800 mb-1">Prompts activés</p>
              <p className="text-xs text-green-700 mb-4">Rendez-vous dans l&apos;onglet <strong>Visibilité</strong> pour consulter la visibilité de votre marque en termes de citations.</p>
              <button onClick={() => { setTab("visibilite"); setPromptsSaved(false); }}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition">
                Voir la Visibilité →
              </button>
            </div>
          )}

          {/* Manual add */}
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <h2 className="font-semibold text-sm text-ink mb-4">Ajouter un prompt manuellement</h2>
            <form onSubmit={createPrompt} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                  <DomainAutocomplete value={form.tracked_url} onChange={v => setForm(f => ({ ...f, tracked_url: v }))} />
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
                <textarea rows={3} placeholder="ex: Quels sont les meilleurs compléments alimentaires pour la récupération ?" value={form.prompt_text}
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
                  <input type="text" placeholder="ex: récupération sportive" value={form.topic}
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
        </div>
      )}

      {/* ── TAB: Citations ────────────────────────────────────────────────── */}
      {tab === "citations" && (
        <div className="space-y-5">
          {loading ? <p className="py-12 text-center text-sm text-ink-soft">Chargement…</p>
          : (
            <>
              {/* Pages citées */}
              <div className="rounded-2xl border border-hairline bg-white">
                <div className="px-6 py-4 border-b border-hairline">
                  <h2 className="font-semibold text-sm text-ink">Pages les plus citées</h2>
                  <p className="text-xs text-ink-soft mt-0.5">URLs de votre site apparaissant en source dans les réponses IA.</p>
                </div>
                {!results?.topPages?.length ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-ink-soft mb-2">Aucune citation de page enregistrée.</p>
                    <p className="text-xs text-ink-soft">Les citations apparaissent quand les LLMs incluent l&apos;URL de votre site dans leurs sources.</p>
                  </div>
                ) : (
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

              {/* Analyse par prompt */}
              {!results?.runDetails.length ? (
                <div className="rounded-2xl border border-dashed border-hairline p-12 text-center">
                  <p className="text-sm text-ink-soft">Aucun run enregistré sur cette période.</p>
                  <button onClick={() => setTab("prompts")} className="mt-3 text-xs text-brand hover:underline">
                    Configurer et lancer des prompts →
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
                  <div className="px-6 py-4 border-b border-hairline">
                    <h2 className="font-semibold text-sm text-ink">Détail par prompt</h2>
                    <p className="text-xs text-ink-soft mt-0.5">Réponse et statut de citation pour chaque prompt analysé.</p>
                  </div>
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

              {/* Gaps — prompts sans citation */}
              {results?.runDetails && results.runDetails.length > 0 && (() => {
                const gapPrompts = results.prompts.filter(p => {
                  const pRuns = byPrompt[p.id] ?? [];
                  return pRuns.length > 0 && !pRuns.some(r => r.cited) && !pRuns.some(r => r.mentioned);
                });
                if (!gapPrompts.length) return null;
                return (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <div className="px-6 py-4 border-b border-amber-200">
                      <h2 className="font-semibold text-sm text-amber-800">Opportunités — {gapPrompts.length} prompt{gapPrompts.length > 1 ? "s" : ""} sans visibilité</h2>
                      <p className="text-xs text-amber-700 mt-0.5">Ces prompts n&apos;ont généré aucune citation ni mention. Optimisez votre contenu pour ces requêtes.</p>
                    </div>
                    <div className="divide-y divide-amber-100">
                      {gapPrompts.map(p => (
                        <div key={p.id} className="flex items-start gap-4 px-6 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink">{p.prompt_text}</p>
                            <span className="text-xs text-amber-700">{p.tracked_url} · {p.intent}</span>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Absent
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
