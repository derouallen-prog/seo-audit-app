"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { z } from "zod";
import type { Analysis } from "@/lib/types";
import { computeScore, gradeFromScore } from "@/lib/score";
import type { Grade } from "@/lib/score";
import TagsGenerator from "@/app/components/TagsGenerator";
import KeywordsResearch from "@/app/components/KeywordsResearch";
import GscConnect from "@/app/components/GscConnect";
import ExportMenu from "@/app/components/ExportMenu";

const schema = z.string().url();

function ensureProtocol(u: string): string {
  if (!u) return u;
  return /^(https?:)?\/\//i.test(u) ? u : `https://${u}`;
}

type BadgeTone = "ok" | "warn" | "error";

function Badge({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const tone: BadgeTone = ok ? "ok" : warn ? "warn" : "error";
  const cls =
    tone === "ok" ? "bg-green-100 text-green-800" :
    tone === "warn" ? "bg-orange-100 text-orange-800" :
    "bg-red-100 text-red-800";
  const icon = tone === "ok" ? "✓" : tone === "warn" ? "⚠" : "✗";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-ink mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`py-1.5 px-2 sm:px-3 text-ink ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}

// ── Score global ────────────────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: Grade }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    grade === "A" ? "#22c55e" :
    grade === "B" ? "#f59e0b" :
    grade === "C" ? "#f97316" : "#ef4444";
  const label =
    grade === "A" ? "Très bon" :
    grade === "B" ? "Bon" :
    grade === "C" ? "À améliorer" : "Critique";

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
          <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--hairline))" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="9"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-ink leading-none">{score}</span>
          <span className="text-xs font-bold mt-0.5" style={{ color }}>{grade}</span>
        </div>
      </div>
      <div>
        <p className="text-base font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-soft mt-1">Score SEO global /100<br />Technique, contenu, balises &amp; performance</p>
        <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color }}>
          Grade {grade}
        </span>
      </div>
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "technique", label: "Technique" },
  { id: "contenu", label: "Contenu & Balises" },
  { id: "performance", label: "Performance" },
  { id: "autorite", label: "Autorité & SEO" },
  { id: "geo", label: "GEO / LLMs" },
  { id: "recommandations", label: "Recommandations" },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Stats hero ──────────────────────────────────────────────────────────────

const STATS = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
    value: "120+",
    label: "Signaux analysés par audit",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    ),
    value: "42k+",
    label: "Sites déjà passés au crible",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
      </svg>
    ),
    value: "48h",
    label: "Pour un audit humain approfondi",
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [loadedFromDashboard, setLoadedFromDashboard] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabId>("technique");
  const resultsRef = React.useRef<HTMLDivElement>(null);

  // Autosuggest domaine via Clearbit (sans clé API)
  const [urlSuggestions, setUrlSuggestions] = useState<{ name: string; domain: string; logo: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function onUrlChange(v: string) {
    setUrl(v);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = v.trim();
    if (q.length < 2 || /^https?:\/\//i.test(q)) {
      setUrlSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = (await res.json()) as { name: string; domain: string; logo: string }[];
          setUrlSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch { /* réseau indisponible */ }
    }, 300);
  }

  function selectSuggestion(domain: string) {
    setUrl(`https://${domain}`);
    setUrlSuggestions([]);
    setShowSuggestions(false);
  }

  // Charge un audit existant si ?auditId= est dans l'URL (lien depuis le dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("auditId");
    if (!id) return;
    setLoading(true);
    fetch(`/api/audit?id=${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setData(json.data);
          setUrl(json.url ?? "");
          setAuditId(json.id);
          setLoadedFromDashboard(true);
          // Scroll vers les résultats après le rendu
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
      })
      .catch(() => setError("Impossible de charger cet audit."))
      .finally(() => setLoading(false));
  }, []);

  const normalized = ensureProtocol(url.trim());
  const isValidUrl = schema.safeParse(normalized).success;

  async function onAnalyze() {
    setError(null);
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
      setError("Merci d'entrer une URL valide (https://…).");
      return;
    }
    setLoading(true);
    setData(null);
    setAuditId(null);
    setActiveTab("technique");
    try {
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        let message = `Erreur API ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) message = j.error;
        } catch { /* ignore */ }
        setError(message);
        return;
      }
      const json = (await res.json()) as Analysis;
      setData(json);
      const id = res.headers.get("x-audit-id");
      if (id) setAuditId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'analyse.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(93,52,255,0.12),transparent_60%)]" />

        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 sm:pt-24 sm:pb-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">

            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Nouveau — assistant SEO IA en accès libre
            </div>

            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-7xl">
              L&apos;observatoire SEO qui traduit vos données en{" "}
              <span className="italic text-brand">actions.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft sm:text-lg">
              Audit technique, Core Web Vitals, mots-clés, backlinks et un assistant IA — dans une seule interface, pensée pour les experts comme pour les débutants.
            </p>

            {/* Audit bar */}
            <div className="mt-9">
              <div className="relative">
                <form
                  onSubmit={(e) => { e.preventDefault(); onAnalyze(); }}
                  className="flex w-full items-center gap-2 rounded-2xl border border-hairline bg-background p-2 shadow-sm transition-shadow focus-within:border-brand/40 focus-within:shadow-lg"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-ink-soft">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                      <path d="M2 12h20"/>
                    </svg>
                  </div>
                  <input
                    value={url}
                    onChange={(e) => onUrlChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && onAnalyze()}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => urlSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="https://votre-site.com ou nom de marque…"
                    className="min-w-0 flex-1 bg-transparent px-1 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !isValidUrl}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white shadow glow-brand transition hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Analyse…" : "Lancer l'audit"}
                    {!loading && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                </form>

                {/* Dropdown suggestions */}
                {showSuggestions && urlSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-2 rounded-2xl border border-hairline bg-white shadow-xl overflow-hidden">
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Résultats</p>
                    {urlSuggestions.map(s => (
                      <button
                        key={s.domain}
                        type="button"
                        onMouseDown={() => selectSuggestion(s.domain)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                      >
                        {s.logo
                          ? <img src={s.logo} alt="" width={28} height={28} className="w-7 h-7 rounded-lg shrink-0 object-contain border border-hairline" />
                          : <div className="w-7 h-7 rounded-lg bg-brand-soft shrink-0 flex items-center justify-center text-xs font-bold text-brand">{s.name[0]}</div>
                        }
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{s.name}</p>
                          <p className="text-xs text-ink-soft">{s.domain}</p>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-hairline px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-ink-soft">Vous ne trouvez pas votre site ?</span>
                      <span className="text-xs text-ink-soft">Saisissez l&apos;URL directement</span>
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-soft">
                {["Sans inscription", "Résultats en ~30s", "Compatible Search Console"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-good" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                    </svg>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/api/gsc/auth">
                <button className="inline-flex items-center gap-2 rounded-md border border-hairline bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                  Connecter Google Search Console
                </button>
              </Link>
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-accent hover:text-ink"
                onClick={() => { setUrl("https://www.laplantation.com"); }}
              >
                Voir un exemple
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {STATS.map(({ icon, value, label }) => (
              <div key={label} className="card-elevated flex items-center gap-4 p-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  {icon}
                </div>
                <div>
                  <div className="font-display text-2xl text-ink">{value}</div>
                  <div className="text-xs text-ink-soft">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Résultats d'audit ── */}
      {(data || loading) && (
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <GscConnect />

          {loading && !data && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-soft">
              <svg className="h-8 w-8 animate-spin text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-sm">Analyse en cours, cela peut prendre 30–40 secondes…</p>
            </div>
          )}

          {data && (() => {
            const { score, grade } = computeScore(data);
            let displayHost = "";
            try { displayHost = new URL(url.startsWith("http") ? url : `https://${url}`).hostname; } catch { displayHost = url; }

            return (
              <div ref={resultsRef} className="mt-8 space-y-6">

                {/* ── Bannière audit chargé depuis dashboard ── */}
                {loadedFromDashboard && (
                  <div className="flex items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p className="text-sm text-ink">
                      Résultats de l&apos;audit pour <span className="font-semibold text-brand">{displayHost}</span>
                    </p>
                    <button
                      onClick={() => { setData(null); setUrl(""); setAuditId(null); setLoadedFromDashboard(false); window.history.replaceState({}, "", "/"); }}
                      className="ml-auto text-xs text-ink-soft hover:text-ink transition"
                    >
                      Nouvel audit →
                    </button>
                  </div>
                )}

                {/* ── Score header ── */}
                <div className="card-elevated p-6">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-3">Score SEO global</p>
                      <ScoreRing score={score} grade={grade} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-2">
                      {/* Signaux rapides */}
                      <Badge ok={data.security.https} label="HTTPS" />
                      <Badge
                        ok={data.status >= 200 && data.status < 300}
                        label={`HTTP ${data.status}`}
                      />
                      <Badge ok={!!data.title && (data.title.length >= 30 && data.title.length <= 65)} warn={!!data.title && (data.title.length < 30 || data.title.length > 65)} label="Title" />
                      <Badge ok={!!data.description && (data.description.length >= 70 && data.description.length <= 155)} warn={!!data.description && (data.description.length < 70 || data.description.length > 155)} label="Meta description" />
                      <Badge ok={data.h1Count === 1} warn={data.h1Count > 1} label={`H1 (${data.h1Count})`} />
                      <Badge ok={data.jsonLdDetected} label="JSON-LD" />
                      <Badge ok={data.robotsTxt?.found ?? false} label="robots.txt" />
                      <Badge ok={data.sitemap?.found ?? false} label="Sitemap" />
                    </div>
                  </div>
                  {/* CTA vers assistant + export */}
                  <div className="mt-5 pt-4 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs text-ink-soft">
                        Analysez ces résultats en profondeur avec l&apos;assistant IA
                        {auditId && <span className="ml-2 text-green-600 font-medium">· Audit chargé ✓</span>}
                      </p>
                      <ExportMenu url={url} data={data} />
                    </div>
                    <Link href={auditId ? `/assistant?auditId=${auditId}` : "/assistant"}>
                      <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white glow-brand transition hover:bg-brand-dark">
                        Ouvrir l&apos;assistant
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                        </svg>
                      </button>
                    </Link>
                  </div>
                </div>

                {/* ── Tab navigation ── */}
                <div className="overflow-x-auto">
                  <div className="flex gap-0.5 border-b border-hairline min-w-max">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                          activeTab === t.id
                            ? "border-brand text-brand"
                            : "border-transparent text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Tab panels ── */}

                {/* TECHNIQUE */}
                {activeTab === "technique" && (
                  <div className="space-y-6">
                    <Section title="Résumé technique">
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">Statut HTTP</span>
                          <span className="font-semibold text-ink">{data.status} {data.statusText}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">Temps de réponse</span>
                          <span className={`font-semibold ${data.responseTimeMs <= 500 ? "text-green-700" : data.responseTimeMs <= 1500 ? "text-orange-600" : "text-red-600"}`}>{data.responseTimeMs} ms</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">Taille HTML</span>
                          <span className="font-semibold text-ink">{(data.htmlSize / 1024).toFixed(1)} Ko</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">HTTPS</span>
                          <Badge ok={data.security.https} label={data.security.https ? "Activé" : "Non activé"} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">Canonical</span>
                          <span className="font-medium text-ink text-xs truncate max-w-[180px]">{data.canonical || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                          <span className="text-ink-soft">Robots meta</span>
                          <span className="font-medium text-ink">{data.robotsMeta || "—"}</span>
                        </div>
                      </div>
                    </Section>

                    <Section title="Robots.txt & Sitemap">
                      <div className="grid gap-6 sm:grid-cols-2 text-sm">
                        <div>
                          <h4 className="font-semibold text-ink mb-2">robots.txt</h4>
                          {data.robotsTxt ? (
                            <div className="space-y-2">
                              <div className="flex gap-2 flex-wrap">
                                <Badge ok={data.robotsTxt.found} label={data.robotsTxt.found ? "Trouvé" : "Absent"} />
                                {data.robotsTxt.found && (
                                  <Badge
                                    ok={!data.robotsTxt.blocksGooglebot}
                                    label={data.robotsTxt.blocksGooglebot ? "Bloque Googlebot" : "Googlebot autorisé"}
                                  />
                                )}
                              </div>
                              {data.robotsTxt.found && (
                                <>
                                  <div><span className="text-ink-soft">Sitemaps référencés</span><span className="ml-2 font-medium text-ink">{data.robotsTxt.sitemapUrls.length}</span></div>
                                  {data.robotsTxt.crawlDelay !== null && (
                                    <div><span className="text-ink-soft">Crawl-delay</span><span className="ml-2 font-medium text-ink">{data.robotsTxt.crawlDelay}s</span></div>
                                  )}
                                  {data.robotsTxt.disallowedPaths.length > 0 && (
                                    <div>
                                      <span className="text-ink-soft block mb-1">Paths bloqués ({data.robotsTxt.disallowedPaths.length})</span>
                                      <ul className="text-xs text-ink-soft space-y-0.5 max-h-24 overflow-y-auto">
                                        {data.robotsTxt.disallowedPaths.slice(0, 10).map((p, i) => <li key={i} className="font-mono">{p}</li>)}
                                        {data.robotsTxt.disallowedPaths.length > 10 && <li>+{data.robotsTxt.disallowedPaths.length - 10} autres…</li>}
                                      </ul>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : <p className="text-ink-soft text-xs">Non analysé</p>}
                        </div>
                        <div>
                          <h4 className="font-semibold text-ink mb-2">Sitemap XML</h4>
                          {data.sitemap ? (
                            <div className="space-y-2">
                              <Badge ok={data.sitemap.found} label={data.sitemap.found ? "Trouvé" : "Absent"} />
                              {data.sitemap.found && (
                                <>
                                  <div><span className="text-ink-soft">URL</span><span className="ml-2 break-all text-xs text-ink">{data.sitemap.url}</span></div>
                                  <div><span className="text-ink-soft">Entrées</span><span className="ml-2 font-medium text-ink">{data.sitemap.urlCount ?? "—"}</span></div>
                                  {data.sitemap.isIndex && <Badge ok label="Sitemap Index" />}
                                </>
                              )}
                            </div>
                          ) : <p className="text-ink-soft text-xs">Non analysé</p>}
                        </div>
                      </div>
                    </Section>
                  </div>
                )}

                {/* CONTENU & BALISES */}
                {activeTab === "contenu" && (
                  <div className="space-y-6">
                    <Section title="Balises SEO">
                      <div className="space-y-4 text-sm">
                        {/* Title */}
                        <div className="rounded-lg border border-hairline p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Title</span>
                            <Badge
                              ok={!!data.title && data.title.length >= 30 && data.title.length <= 65}
                              warn={!!data.title && (data.title.length < 30 || data.title.length > 65)}
                              label={`${data.title?.length ?? 0} car. (cible 30–65)`}
                            />
                          </div>
                          <p className="font-medium text-ink">{data.title || "—"}</p>
                        </div>
                        {/* Meta description */}
                        <div className="rounded-lg border border-hairline p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Meta description</span>
                            <Badge
                              ok={!!data.description && data.description.length >= 70 && data.description.length <= 155}
                              warn={!!data.description && (data.description.length < 70 || data.description.length > 155)}
                              label={`${data.description?.length ?? 0} car. (cible 70–155)`}
                            />
                          </div>
                          <p className="font-medium text-ink">{data.description || "—"}</p>
                        </div>
                        {/* Structure Hn */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Structure des titres</p>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { label: "H1", value: data.h1Count, ok: data.h1Count === 1, warn: data.h1Count > 1 },
                              { label: "H2", value: data.headings.h2 },
                              { label: "H3", value: data.headings.h3 },
                              { label: "H4", value: data.headings.h4 },
                            ].map(({ label, value, ok, warn }) => (
                              <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ok ? "border-green-200 bg-green-50" : warn ? "border-orange-200 bg-orange-50" : "border-hairline"}`}>
                                <span className="text-xs font-bold text-ink-soft">{label}</span>
                                <span className="text-lg font-bold text-ink">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Liens & Images */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Liens & Images</p>
                          <div className="flex flex-wrap gap-3">
                            <div className="rounded-lg border border-hairline px-3 py-2 text-center">
                              <span className="block text-xl font-bold text-ink">{data.internalLinks}</span>
                              <span className="text-xs text-ink-soft">Liens internes</span>
                            </div>
                            <div className="rounded-lg border border-hairline px-3 py-2 text-center">
                              <span className="block text-xl font-bold text-ink">{data.externalLinks}</span>
                              <span className="text-xs text-ink-soft">Liens externes</span>
                            </div>
                            <div className={`rounded-lg border px-3 py-2 text-center ${data.imagesMissingAlt === 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                              <span className={`block text-xl font-bold ${data.imagesMissingAlt === 0 ? "text-green-700" : "text-red-700"}`}>{data.imagesMissingAlt}</span>
                              <span className="text-xs text-ink-soft">Images sans alt</span>
                            </div>
                          </div>
                        </div>
                        {/* Signaux techniques */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Signaux techniques</p>
                          <div className="flex gap-3 flex-wrap">
                            <Badge ok={data.jsonLdDetected} label="JSON-LD" />
                            <Badge ok={!!data.canonical} label="Canonical" />
                            <Badge ok={!!data.robotsMeta} label="Robots meta" />
                            <Badge ok={!!data.sitemapHref} label="Sitemap link" />
                          </div>
                        </div>
                      </div>
                    </Section>

                    <KeywordsResearch url={normalized} onSelectKeyword={setSelectedKeyword} />

                    <TagsGenerator
                      url={normalized}
                      currentTitle={data.title ?? undefined}
                      currentMeta={data.description ?? undefined}
                      initialKeyword={selectedKeyword}
                    />
                  </div>
                )}

                {/* PERFORMANCE */}
                {activeTab === "performance" && (
                  <div className="space-y-6">
                    {data.pagespeed ? (() => {
                      const score = data.pagespeed!.performanceScore;
                      const m = data.pagespeed!.metrics;
                      type Tier = "good" | "mid" | "bad" | "na";
                      const scoreColor = score == null ? "bg-gray-100 text-gray-400" : score >= 90 ? "bg-green-500 text-white" : score >= 50 ? "bg-orange-400 text-white" : "bg-red-500 text-white";
                      const tierOf = (t: Tier) => t === "good" ? "bg-green-100 text-green-800" : t === "mid" ? "bg-orange-100 text-orange-800" : t === "bad" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500";
                      const labelOf = (t: Tier) => t === "good" ? "Bon" : t === "mid" ? "À améliorer" : t === "bad" ? "Mauvais" : "—";
                      const lcpTier: Tier = !m?.lcpMs ? "na" : m.lcpMs <= 2500 ? "good" : m.lcpMs <= 4000 ? "mid" : "bad";
                      const inpTier: Tier = !m?.inpMs ? "na" : m.inpMs <= 200 ? "good" : m.inpMs <= 500 ? "mid" : "bad";
                      const clsTier: Tier = m?.cls == null ? "na" : m.cls <= 0.1 ? "good" : m.cls <= 0.25 ? "mid" : "bad";
                      const fcpTier: Tier = !m?.fcpMs ? "na" : m.fcpMs <= 1800 ? "good" : m.fcpMs <= 3000 ? "mid" : "bad";
                      const fmtMs = (v?: number) => v ? (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`) : "—";
                      const CwvCard = ({ label, value, tier, hint }: { label: string; value: string; tier: Tier; hint: string }) => (
                        <div className="rounded-lg border border-hairline bg-white p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierOf(tier)}`}>{labelOf(tier)}</span>
                          </div>
                          <span className="text-2xl font-bold text-ink">{value}</span>
                          <span className="text-xs text-ink-soft">{hint}</span>
                        </div>
                      );
                      return (
                        <Section title="Core Web Vitals (mobile)">
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${scoreColor}`}>{score ?? "—"}</div>
                              <div>
                                <p className="font-semibold text-ink text-sm">Score de performance</p>
                                <p className="text-xs text-ink-soft">≥ 90 : Bon · 50–89 : À améliorer · &lt; 50 : Mauvais</p>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <CwvCard label="LCP" value={fmtMs(m?.lcpMs)} tier={lcpTier} hint="Seuil Bon : ≤ 2,5 s" />
                              <CwvCard label="INP" value={fmtMs(m?.inpMs)} tier={inpTier} hint="Seuil Bon : ≤ 200 ms" />
                              <CwvCard label="CLS" value={m?.cls != null ? m.cls.toFixed(3) : "—"} tier={clsTier} hint="Seuil Bon : ≤ 0,1" />
                              <CwvCard label="FCP" value={fmtMs(m?.fcpMs)} tier={fcpTier} hint="Seuil Bon : ≤ 1,8 s" />
                            </div>
                            {data.pagespeedAnalysis && (
                              <div className="pt-4 border-t border-hairline space-y-3">
                                <p className="text-sm text-ink-soft leading-relaxed">{data.pagespeedAnalysis.summary}</p>
                                <div className="space-y-2">
                                  {data.pagespeedAnalysis.recommendations.map((rec, i) => {
                                    const badge = rec.priority === "haute" ? "bg-red-100 text-red-700" : rec.priority === "moyenne" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500";
                                    const lbl = rec.priority === "haute" ? "Priorité haute" : rec.priority === "moyenne" ? "Priorité moyenne" : "Priorité faible";
                                    return (
                                      <div key={i} className="rounded-lg border border-hairline bg-muted/40 p-3 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>{lbl}</span>
                                          <span className="text-sm font-semibold text-ink">{rec.titre}</span>
                                        </div>
                                        <p className="text-xs text-ink-soft leading-relaxed">{rec.detail}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </Section>
                      );
                    })() : (
                      <div className="rounded-xl border border-hairline bg-white p-10 text-center text-ink-soft text-sm">
                        Données PageSpeed non disponibles pour cet audit.
                      </div>
                    )}
                  </div>
                )}

                {/* AUTORITÉ & SEO */}
                {activeTab === "autorite" && (
                  <div className="space-y-6">
                    {/* Open PageRank */}
                    {data.openPageRank && (
                      <Section title="Open PageRank">
                        <div className="grid gap-3 text-sm sm:grid-cols-4">
                          <div className="rounded-lg bg-brand-soft border border-brand/20 p-4 text-center">
                            <span className="block text-xs text-ink-soft mb-1">Page Rank</span>
                            <span className="text-4xl font-bold text-brand">{data.openPageRank.pageRankInteger}</span>
                            <span className="text-xs text-ink-soft block mt-0.5">/10</span>
                          </div>
                          <div className="rounded-lg bg-brand-soft border border-brand/20 p-4 text-center">
                            <span className="block text-xs text-ink-soft mb-1">Score précis</span>
                            <span className="text-2xl font-bold text-brand">{data.openPageRank.pageRankDecimal.toFixed(2)}</span>
                          </div>
                          <div className="rounded-lg bg-brand-soft border border-brand/20 p-4 text-center">
                            <span className="block text-xs text-ink-soft mb-1">Rang mondial</span>
                            <span className="text-2xl font-bold text-brand">
                              {data.openPageRank.rank ? `#${data.openPageRank.rank.toLocaleString("fr-FR")}` : "Non classé"}
                            </span>
                          </div>
                          {data.openPageRank.referringDomains != null && (
                            <div className="rounded-lg bg-brand-soft border border-brand/20 p-4 text-center">
                              <span className="block text-xs text-ink-soft mb-1">Domaines référents</span>
                              <span className="text-2xl font-bold text-brand">{data.openPageRank.referringDomains.toLocaleString("fr-FR")}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-ink-soft mt-3">Source : Open PageRank — mesure l&apos;autorité du domaine d&apos;après l&apos;analyse des liens entrants (Common Crawl).</p>
                      </Section>
                    )}

                    {data.keywords && data.keywords.keywords.length > 0 ? (
                      <Section title={`Mots-clés positionnés (${data.keywords.keywords.length}) — base ${data.keywords.database.toUpperCase()}`}>
                        <div className="overflow-x-auto rounded-lg border border-hairline">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-brand text-white"><Th>Mot-clé</Th><Th right>Pos.</Th><Th right>Volume</Th><Th>URL</Th><Th right>Trafic %</Th></tr></thead>
                            <tbody>
                              {data.keywords.keywords.map((kw, i) => (
                                <tr key={i} className="border-b border-hairline last:border-0 odd:bg-white even:bg-muted/30">
                                  <Td className="font-medium">{kw.keyword}</Td>
                                  <Td right className={`font-semibold ${kw.position <= 3 ? "text-green-700" : kw.position <= 10 ? "text-orange-600" : "text-ink"}`}>{kw.position}</Td>
                                  <Td right>{kw.searchVolume.toLocaleString("fr-FR")}</Td>
                                  <Td className="text-xs text-ink-soft"><span title={kw.url} className="block truncate max-w-[140px] sm:max-w-xs">{kw.url || "—"}</span></Td>
                                  <Td right>{kw.traffic.toFixed(2)}%</Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    ) : null}

                    {data.domainTopPages && data.domainTopPages.pages.length > 0 && (
                      <Section title={`Top pages organiques — base ${data.domainTopPages.database.toUpperCase()}`}>
                        <div className="overflow-x-auto rounded-lg border border-hairline">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-brand text-white"><Th>URL</Th><Th right>Mots-clés</Th><Th right>Trafic</Th></tr></thead>
                            <tbody>
                              {data.domainTopPages.pages.map((p, i) => (
                                <tr key={i} className="border-b border-hairline last:border-0 odd:bg-white even:bg-muted/30">
                                  <Td className="text-xs"><span title={p.url} className="block truncate max-w-[160px] sm:max-w-sm">{p.url}</span></Td>
                                  <Td right>{p.keywords.toLocaleString("fr-FR")}</Td>
                                  <Td right>{p.traffic.toLocaleString("fr-FR")}</Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}

                    {data.backlinks && (
                      <Section title="Backlinks">
                        <div className="grid gap-3 text-sm sm:grid-cols-4 mb-6">
                          {[
                            { label: "Authority Score", value: data.backlinks.overview.authorityScore ?? "—" },
                            { label: "Backlinks", value: data.backlinks.overview.total.toLocaleString("fr-FR") },
                            { label: "Domaines référents", value: data.backlinks.overview.referringDomains.toLocaleString("fr-FR") },
                            { label: "IPs référentes", value: data.backlinks.overview.referringIps.toLocaleString("fr-FR") },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg bg-brand-soft border border-brand/20 p-3">
                              <span className="text-ink-soft block text-xs">{label}</span>
                              <span className="font-bold text-xl text-brand">{value}</span>
                            </div>
                          ))}
                        </div>
                        {data.backlinks.topReferringDomains.length > 0 && (
                          <>
                            <h4 className="font-semibold text-ink mb-2 text-sm">Top domaines référents</h4>
                            <div className="overflow-x-auto rounded-lg border border-hairline">
                              <table className="w-full text-sm">
                                <thead><tr className="bg-brand text-white"><Th>Domaine</Th><Th right>AS</Th><Th right>Backlinks</Th></tr></thead>
                                <tbody>
                                  {data.backlinks.topReferringDomains.map((d, i) => (
                                    <tr key={i} className="border-b border-hairline last:border-0 odd:bg-white even:bg-muted/30">
                                      <Td className="font-medium">{d.domain}</Td>
                                      <Td right>{d.authorityScore ?? "—"}</Td>
                                      <Td right>{d.backlinksCount.toLocaleString("fr-FR")}</Td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </Section>
                    )}

                    {(!data.keywords || data.keywords.keywords.length === 0) && !data.backlinks && (
                      <div className="rounded-xl border border-hairline bg-white p-10 text-center text-ink-soft text-sm">
                        Données Semrush non disponibles pour ce domaine.
                      </div>
                    )}
                  </div>
                )}

                {/* GEO / LLMs */}
                {activeTab === "geo" && (() => {
                  const types = data.jsonLdTypes ?? [];
                  const hasOrg = types.some(t => ["Organization", "LocalBusiness", "Store", "Restaurant", "ProfessionalService"].includes(t));
                  const hasPerson = types.some(t => ["Person", "Author"].includes(t));
                  const hasFaq = types.some(t => t === "FAQPage");
                  const hasArticle = types.some(t => ["Article", "BlogPosting", "NewsArticle", "WebPage"].includes(t));
                  const hasBreadcrumb = types.some(t => t === "BreadcrumbList");
                  const hasProduct = types.some(t => t === "Product");
                  const hasReview = types.some(t => ["Review", "AggregateRating"].includes(t));

                  const technicalOk = data.security.https && (data.robotsTxt?.found ?? false) && (data.sitemap?.found ?? false) && !!data.canonical;
                  const technicalWarn = !technicalOk && (data.security.https || (data.robotsTxt?.found ?? false));

                  const contentDepth = data.htmlSize > 50000 ? "ok" : data.htmlSize > 20000 ? "warn" : "error";
                  const headingStructure = data.headings.h2 >= 3 ? "ok" : data.headings.h2 >= 1 ? "warn" : "error";

                  // GEO score /100
                  let geoPts = 0;
                  if (data.jsonLdDetected) geoPts += 15;
                  if (hasOrg) geoPts += 10;
                  if (hasPerson) geoPts += 5;
                  if (data.hasAboutPage) geoPts += 10;
                  if (data.hasContactPage) geoPts += 10;
                  if (hasFaq) geoPts += 15;
                  if (hasBreadcrumb) geoPts += 5;
                  if (technicalOk) geoPts += 15;
                  else if (technicalWarn) geoPts += 7;
                  if (contentDepth === "ok") geoPts += 10;
                  else if (contentDepth === "warn") geoPts += 5;
                  if (headingStructure === "ok") geoPts += 5;
                  const geoScore = Math.min(100, geoPts);
                  const geoColor = geoScore >= 70 ? "#22c55e" : geoScore >= 40 ? "#f59e0b" : "#ef4444";
                  const geoLabel = geoScore >= 70 ? "Bon" : geoScore >= 40 ? "À renforcer" : "Insuffisant";

                  const GeoRow = ({ ok, warn, label, hint }: { ok?: boolean; warn?: boolean; label: string; hint?: string }) => (
                    <div className="flex items-start gap-3 py-2.5 border-b border-hairline last:border-0">
                      <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${ok ? "bg-green-100 text-green-700" : warn ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-600"}`}>
                        {ok ? "✓" : warn ? "~" : "✗"}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-ink">{label}</span>
                        {hint && <p className="text-xs text-ink-soft mt-0.5">{hint}</p>}
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-6">
                      {/* Score GEO */}
                      <div className="card-elevated p-6 flex items-center gap-6">
                        <div className="relative w-20 h-20 shrink-0">
                          <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--hairline))" strokeWidth="9" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke={geoColor} strokeWidth="9"
                              strokeDasharray={`${(geoScore / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                              strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-ink leading-none">{geoScore}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Score GEO / LLMs</p>
                          <p className="text-lg font-bold text-ink mt-0.5">{geoLabel}</p>
                          <p className="text-xs text-ink-soft mt-1">Prérequis pour être visible sur les plateformes génératives (ChatGPT, Perplexity, Gemini…)</p>
                        </div>
                      </div>

                      {/* Signaux EEAT */}
                      <Section title="Signaux E-E-A-T">
                        <div className="divide-y divide-hairline">
                          <GeoRow ok={data.jsonLdDetected} label="Données structurées (JSON-LD) présentes"
                            hint="Incontournables pour les extraits enrichis et la compréhension par les LLMs." />
                          <GeoRow ok={hasOrg}
                            label="Schéma Organization / LocalBusiness"
                            hint="Identifie la marque, l'adresse, le secteur — signal Autorité fort." />
                          <GeoRow ok={hasPerson}
                            label="Schéma Person / Author"
                            hint="Indique une expertise identifiable (Experience, Expertise)." />
                          <GeoRow ok={data.hasAboutPage ?? false}
                            label="Page À propos détectée"
                            hint="Signal de confiance (Trustworthiness) pour Google et les LLMs." />
                          <GeoRow ok={data.hasContactPage ?? false}
                            label="Page Contact détectée"
                            hint="Accessibilité de la marque — signal de légitimité." />
                          <GeoRow ok={hasBreadcrumb}
                            label="Fil d'Ariane (BreadcrumbList)"
                            hint="Structure la hiérarchie du site pour les crawlers et les IA." />
                          {types.length > 0 && (
                            <div className="py-2.5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">Types JSON-LD détectés</p>
                              <div className="flex flex-wrap gap-1.5">
                                {[...new Set(types)].map(t => (
                                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-brand-soft text-brand font-medium">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Section>

                      {/* Prérequis LLM */}
                      <Section title="Prérequis pour les plateformes génératives">
                        <div className="divide-y divide-hairline">
                          <GeoRow
                            ok={hasFaq}
                            label="Contenu FAQ (FAQPage schema)"
                            hint="Format conversationnel privilégié par les LLMs pour générer des réponses." />
                          <GeoRow
                            ok={hasArticle}
                            label="Contenu éditorial structuré (Article / BlogPosting)"
                            hint="Signale un contenu de référence citable par les modèles." />
                          <GeoRow
                            ok={hasProduct}
                            label="Données produit (Product schema)"
                            hint="Essentiel pour la visibilité dans les résultats d'achat IA." />
                          <GeoRow
                            ok={hasReview}
                            label="Avis / notes structurés (AggregateRating)"
                            hint="Renforce la crédibilité et peut déclencher des rich results." />
                          <GeoRow
                            ok={contentDepth === "ok"}
                            warn={contentDepth === "warn"}
                            label={`Densité du contenu (${(data.htmlSize / 1024).toFixed(0)} Ko HTML)`}
                            hint="≥ 50 Ko : riche · 20–50 Ko : moyen · < 20 Ko : trop court pour les LLMs." />
                          <GeoRow
                            ok={headingStructure === "ok"}
                            warn={headingStructure === "warn"}
                            label={`Structure de titres (${data.headings.h2} H2, ${data.headings.h3} H3)`}
                            hint="≥ 3 H2 bien nommés facilitent l'extraction de passages par les IA." />
                          <GeoRow
                            ok={data.hasLlmsTxt ?? false}
                            label="/llms.txt présent"
                            hint="Fichier d'instructions pour les LLMs — équivalent robots.txt pour l'IA." />
                        </div>
                      </Section>

                      {/* Socle SEO technique */}
                      <Section title="Socle SEO technique">
                        <div className="divide-y divide-hairline">
                          <GeoRow ok={data.security.https} label="HTTPS activé" hint="Prérequis absolu de confiance." />
                          <GeoRow ok={data.robotsTxt?.found ?? false} label="robots.txt présent" hint="Guide les crawlers des moteurs et des IA." />
                          <GeoRow ok={data.sitemap?.found ?? false} label="Sitemap XML disponible" hint="Facilite l'indexation de l'ensemble du contenu." />
                          <GeoRow ok={!!data.canonical} label="URL canonique définie" hint="Évite la dilution de l'autorité sur les contenus dupliqués." />
                          <GeoRow ok={!!data.title && data.title.length >= 30 && data.title.length <= 65}
                            warn={!!data.title && (data.title.length < 30 || data.title.length > 65)}
                            label="Balise title optimisée" hint="Longueur cible : 30–65 caractères." />
                        </div>
                      </Section>

                      {/* Visibilité IA */}
                      <div className="rounded-xl border border-brand/30 bg-brand-soft p-5">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-xl bg-brand/10 flex items-center justify-center text-brand text-base">✦</div>
                          <div className="flex-1">
                            <p className="font-semibold text-ink">Tester la visibilité de la marque dans les LLMs</p>
                            <p className="text-xs text-ink-soft mt-1 mb-3">
                              Posez la question à l&apos;assistant : &quot;Quand on cherche [activité] sur ChatGPT ou Perplexity, le site est-il cité ?&quot; —
                              l&apos;assistant peut simuler ce test et vous proposer un plan d&apos;action.
                            </p>
                            <Link href={auditId ? `/assistant?auditId=${auditId}` : "/assistant"}>
                              <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
                                Analyser avec l&apos;assistant IA
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                                </svg>
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* RECOMMANDATIONS */}
                {activeTab === "recommandations" && (
                  <div className="space-y-6">
                    <Section title={`Recommandations (${data.recommendations.length})`}>
                      <ul className="space-y-2">
                        {data.recommendations.map((r, i) => (
                          <li key={i} className="flex gap-3 rounded-lg border border-hairline px-4 py-3 text-sm text-ink">
                            <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-brand-soft text-brand text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <div className="rounded-xl bg-brand p-6 text-white shadow-sm">
                      <h4 className="text-lg font-bold mb-1">Recevoir un audit complet</h4>
                      <p className="text-sm text-white/70 mb-4">Un expert analyse votre site et vous envoie un plan d&apos;action personnalisé.</p>
                      <form
                        className="grid gap-2"
                        onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const fd = new FormData(form);
                          try {
                            const res = await fetch("/api/lead", {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ email: fd.get("email"), company: fd.get("company"), url, note: fd.get("note"), website: fd.get("website") }),
                            });
                            if (res.ok) { alert("Merci ! Nous revenons vers vous rapidement."); form.reset(); }
                            else { const j = await res.json().catch(() => ({})); alert((j as { error?: string })?.error || "Erreur, merci de réessayer."); }
                          } catch { alert("Erreur réseau, merci de réessayer."); }
                        }}
                      >
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
                        <input name="email" required type="email" placeholder="Email pro" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                        <input name="company" required placeholder="Société" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                        <textarea name="note" placeholder="Besoin / contexte (optionnel)" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                        <button className="rounded-lg bg-black text-white px-4 py-2 font-medium hover:bg-gray-900 transition">Améliorer ma stratégie SEO</button>
                      </form>
                    </div>

                    <GscConnect />
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      )}

      {/* GscConnect visible en dehors des résultats aussi */}
      {!data && !loading && (
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
          <GscConnect />
        </div>
      )}
    </>
  );
}
