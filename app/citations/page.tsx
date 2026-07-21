"use client";

import { useState, useEffect, useCallback } from "react";
import type { PromptSet, Intent } from "@/lib/citations/types";
import { INTENTS, PLATFORMS } from "@/lib/citations/types";

// ── Types ──────────────────────────────────────────────────────────────────
interface CitationRun {
  id: string;
  prompt_id: string;
  platform: string;
  run_at: string;
  cited: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[] | null;
}

interface CitationShare {
  cited: number;
  total: number;
  share: number;
}

interface ResultsData {
  prompts: PromptSet[];
  runs: CitationRun[];
  citationShare: Record<string, CitationShare>;
  topCompetitors: { domain: string; count: number }[];
  topPages: { url: string; count: number }[];
  trend: { week: string; share: number; cited: number; total: number }[];
  meta: { days: number; totalRuns: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
  bing_copilot: "Bing Copilot",
};

const PLATFORM_COLORS: Record<string, string> = {
  perplexity: "#20808d",
  claude: "#5b21b6",
  openai: "#10a37f",
  gemini: "#4285f4",
  bing_copilot: "#0078d4",
};

function ShareBar({ share, platform }: { share: number; platform: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${share}%`, backgroundColor: PLATFORM_COLORS[platform] ?? "#6b7280" }}
        />
      </div>
      <span className="text-sm font-bold text-ink w-10 text-right">{share}%</span>
    </div>
  );
}

function MiniTrend({ data }: { data: ResultsData["trend"] }) {
  if (!data.length) return <p className="text-xs text-ink-soft">Pas encore de données historiques.</p>;
  const max = Math.max(...data.map(d => d.share), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-t-sm bg-brand/70 transition-all"
            style={{ height: `${(d.share / max) * 100}%`, minHeight: d.share > 0 ? 2 : 0 }}
            title={`Semaine du ${d.week} : ${d.share}% (${d.cited}/${d.total})`}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function CitationsPage() {
  const [tab, setTab] = useState<"setup" | "results" | "competitors" | "pages">("results");
  const [prompts, setPrompts] = useState<PromptSet[]>([]);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Form state
  const [form, setForm] = useState({ tracked_url: "", prompt_text: "", intent: "Informational" as Intent, topic: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/citations/prompts"),
        fetch(`/api/citations/results?days=${days}`),
      ]);
      if (pRes.ok) {
        const d = await pRes.json() as { prompts: PromptSet[] };
        setPrompts(d.prompts ?? []);
      }
      if (rRes.ok) {
        const d = await rRes.json() as ResultsData;
        setResults(d);
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.tracked_url || !form.prompt_text) {
      setFormError("L'URL et le prompt sont obligatoires.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/citations/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? "Erreur"); return; }
      setForm({ tracked_url: "", prompt_text: "", intent: "Informational", topic: "" });
      await loadData();
      setTab("results");
    } finally {
      setCreating(false);
    }
  }

  async function deletePrompt(id: string) {
    await fetch(`/api/citations/prompts?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function togglePrompt(id: string, active: boolean) {
    await fetch("/api/citations/prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    await loadData();
  }

  async function runNow(promptId: string) {
    setRunning(promptId);
    try {
      await fetch("/api/citations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId }),
      });
      await loadData();
    } finally {
      setRunning(null);
    }
  }

  const totalCitationShare = results
    ? Object.values(results.citationShare).reduce(
        (acc, v) => ({ cited: acc.cited + v.cited, total: acc.total + v.total }),
        { cited: 0, total: 0 }
      )
    : null;

  const globalShare = totalCitationShare && totalCitationShare.total > 0
    ? Math.round((totalCitationShare.cited / totalCitationShare.total) * 100)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-ink">Suivi des citations IA</h1>
            <p className="mt-1 text-sm text-ink-soft max-w-xl">
              Mesurez si votre site est cité par Perplexity et Claude quand des utilisateurs posent des questions sur votre secteur.
            </p>
          </div>
          <button
            onClick={() => setTab("setup")}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
          >
            + Nouveau prompt
          </button>
        </div>

        {/* Note méthodologique */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
          <strong>Note méthodologique :</strong> les réponses obtenues via API peuvent différer légèrement de l&apos;expérience grand public des plateformes (personnalisation, mémoire conversationnelle). Cette mesure est directionnelle et reproductible dans le temps — c&apos;est la même méthode utilisée par Profound, Peec AI et Otterly.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-accent/50 p-1 mb-6 w-fit">
        {[
          { key: "results", label: "Citation Share" },
          { key: "competitors", label: "Concurrents" },
          { key: "pages", label: "Pages citées" },
          { key: "setup", label: "Prompts" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      {tab !== "setup" && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-ink-soft">Période :</span>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                days === d ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Citation Share ── */}
      {tab === "results" && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-sm text-ink-soft py-8 text-center">Chargement…</div>
          ) : !results || results.meta.totalRuns === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline p-16 text-center">
              <p className="text-ink-soft text-sm mb-3">Aucun run effectué pour l&apos;instant.</p>
              <p className="text-xs text-ink-soft">Ajoutez des prompts et cliquez sur ▶ pour lancer votre premier suivi.</p>
              <button
                onClick={() => setTab("setup")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
              >
                + Ajouter un prompt
              </button>
            </div>
          ) : (
            <>
              {/* Global score */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-hairline bg-white p-5">
                  <p className="text-xs text-ink-soft mb-1">Citation Share global</p>
                  <p className="text-4xl font-bold text-ink">{globalShare ?? "—"}<span className="text-lg text-ink-soft">%</span></p>
                  <p className="text-xs text-ink-soft mt-1">{totalCitationShare?.cited ?? 0} citations / {totalCitationShare?.total ?? 0} runs</p>
                </div>
                <div className="rounded-2xl border border-hairline bg-white p-5">
                  <p className="text-xs text-ink-soft mb-1">Prompts actifs</p>
                  <p className="text-4xl font-bold text-ink">{prompts.filter(p => p.active).length}</p>
                  <p className="text-xs text-ink-soft mt-1">{PLATFORMS.join(" · ")}</p>
                </div>
                <div className="rounded-2xl border border-hairline bg-white p-5">
                  <p className="text-xs text-ink-soft mb-3">Évolution ({results.meta.days}j)</p>
                  <MiniTrend data={results.trend} />
                </div>
              </div>

              {/* Per-platform */}
              <div className="rounded-2xl border border-hairline bg-white p-6">
                <h2 className="font-semibold text-sm text-ink mb-4">Citation Share par plateforme</h2>
                <div className="space-y-4">
                  {PLATFORMS.map(p => {
                    const s = results.citationShare[p];
                    if (!s) return null;
                    return (
                      <div key={p}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ink">{PLATFORM_LABELS[p] ?? p}</span>
                          <span className="text-xs text-ink-soft">{s.cited}/{s.total} runs</span>
                        </div>
                        <ShareBar share={s.share} platform={p} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent runs */}
              <div className="rounded-2xl border border-hairline bg-white">
                <div className="px-6 py-4 border-b border-hairline">
                  <h2 className="font-semibold text-sm text-ink">Historique des runs récents</h2>
                </div>
                <div className="divide-y divide-hairline">
                  {results.runs.slice(0, 20).map(run => {
                    const prompt = results.prompts.find(p => p.id === run.prompt_id);
                    return (
                      <div key={run.id} className="flex items-start gap-4 px-6 py-3">
                        <div
                          className={`mt-0.5 shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            run.cited ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"
                          }`}
                        >
                          {run.cited ? "✓" : "✗"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink truncate">{prompt?.prompt_text ?? "—"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: (PLATFORM_COLORS[run.platform] ?? "#6b7280") + "22", color: PLATFORM_COLORS[run.platform] ?? "#6b7280" }}
                            >
                              {PLATFORM_LABELS[run.platform] ?? run.platform}
                            </span>
                            {run.cited && run.citation_position && (
                              <span className="text-xs text-ink-soft">Position #{run.citation_position}</span>
                            )}
                            <span className="text-xs text-ink-soft">{new Date(run.run_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                          {run.cited_url && (
                            <p className="text-xs text-green-700 mt-0.5 truncate">{run.cited_url}</p>
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

      {/* ── Tab: Competitors ── */}
      {tab === "competitors" && (
        <div className="rounded-2xl border border-hairline bg-white">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-semibold text-sm text-ink">Domaines concurrents cités sur les mêmes prompts</h2>
            <p className="text-xs text-ink-soft mt-0.5">Identifiés automatiquement depuis les sources retournées par les IA</p>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-ink-soft">Chargement…</p>
          ) : !results?.topCompetitors?.length ? (
            <p className="p-8 text-center text-sm text-ink-soft">Pas encore de données concurrentielles.</p>
          ) : (
            <div className="divide-y divide-hairline">
              {results.topCompetitors.map((c, i) => (
                <div key={c.domain} className="flex items-center gap-4 px-6 py-3">
                  <span className="text-xs font-mono text-ink-soft w-5">{i + 1}</span>
                  <span className="flex-1 text-sm text-ink font-medium">{c.domain}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${Math.min(100, (c.count / (results.topCompetitors[0]?.count ?? 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-soft w-16 text-right">{c.count} citations</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Pages citées ── */}
      {tab === "pages" && (
        <div className="rounded-2xl border border-hairline bg-white">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-semibold text-sm text-ink">Pages de votre site les plus citées par les IA</h2>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-ink-soft">Chargement…</p>
          ) : !results?.topPages?.length ? (
            <p className="p-8 text-center text-sm text-ink-soft">Aucune citation enregistrée pour l&apos;instant.</p>
          ) : (
            <div className="divide-y divide-hairline">
              {results.topPages.map((p, i) => (
                <div key={p.url} className="flex items-center gap-4 px-6 py-3">
                  <span className="text-xs font-mono text-ink-soft w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand truncate">{p.url}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                    {p.count} fois
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Prompts setup ── */}
      {tab === "setup" && (
        <div className="space-y-6">

          {/* Create form */}
          <div className="rounded-2xl border border-hairline bg-white p-6">
            <h2 className="font-semibold text-sm text-ink mb-4">Ajouter un prompt de tracking</h2>
            <form onSubmit={createPrompt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Domaine à tracker</label>
                <input
                  type="text"
                  placeholder="ex: monsite.fr ou blog.entreprise.com"
                  value={form.tracked_url}
                  onChange={e => setForm(f => ({ ...f, tracked_url: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Prompt (question à poser à l&apos;IA)</label>
                <textarea
                  rows={3}
                  placeholder="ex: Quels sont les meilleurs outils SEO en 2026 pour les PME françaises ?"
                  value={form.prompt_text}
                  onChange={e => setForm(f => ({ ...f, prompt_text: e.target.value }))}
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand resize-none"
                />
                <p className="text-xs text-ink-soft mt-1">{form.prompt_text.length}/500 caractères</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Intention</label>
                  <select
                    value={form.intent}
                    onChange={e => setForm(f => ({ ...f, intent: e.target.value as Intent }))}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
                  >
                    {INTENTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Thématique (optionnel)</label>
                  <input
                    type="text"
                    placeholder="ex: SEO technique, Contenu…"
                    value={form.topic}
                    onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition disabled:opacity-50"
              >
                {creating ? "Création…" : "Ajouter le prompt"}
              </button>
            </form>
          </div>

          {/* Prompt list */}
          {prompts.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-white">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
                <h2 className="font-semibold text-sm text-ink">Prompts configurés ({prompts.length})</h2>
                <p className="text-xs text-ink-soft">Exécution automatique chaque semaine</p>
              </div>
              <div className="divide-y divide-hairline">
                {prompts.map(p => (
                  <div key={p.id} className="flex items-start gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-ink-soft font-medium">{p.tracked_url}</span>
                        <span className="text-xs text-ink-soft">{p.intent}</span>
                        {p.topic && <span className="text-xs text-ink-soft">· {p.topic}</span>}
                        {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">Inactif</span>}
                      </div>
                      <p className="text-sm text-ink">{p.prompt_text}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => runNow(p.id)}
                        disabled={running === p.id}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-brand hover:border-brand transition disabled:opacity-50"
                        title="Exécuter maintenant"
                      >
                        {running === p.id ? "…" : "▶"}
                      </button>
                      <button
                        onClick={() => togglePrompt(p.id, !p.active)}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-ink transition"
                        title={p.active ? "Désactiver" : "Activer"}
                      >
                        {p.active ? "⏸" : "▶"}
                      </button>
                      <button
                        onClick={() => deletePrompt(p.id)}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-ink-soft hover:text-red-600 hover:border-red-300 transition"
                        title="Supprimer"
                      >
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
