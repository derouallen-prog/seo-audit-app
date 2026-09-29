"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { LLMMentionItem, LLMMentionSource } from "@/lib/dataforseo_llm_mentions";

// ── Types ──────────────────────────────────────────────────────────────────
interface MentionsResult {
  total_count: number;
  items_count: number;
  items: LLMMentionItem[];
}

interface UserProfile {
  site_url?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "fr", label: "🇫🇷 Français", location: 2250 },
  { code: "en", label: "🇬🇧 Anglais", location: 2840 },
  { code: "es", label: "🇪🇸 Espagnol", location: 2724 },
  { code: "de", label: "🇩🇪 Allemand", location: 2276 },
];

const PLATFORM_CFG: Record<string, { label: string; color: string; bg: string }> = {
  chat_gpt: { label: "ChatGPT", color: "#10a37f", bg: "#e6f6f2" },
  google:   { label: "Gemini",  color: "#4285f4", bg: "#eaf1fe" },
};

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

function extractDomain(v: string): string {
  return v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? v;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_CFG[platform] ?? { label: platform, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function VolumeBadge({ volume }: { volume: number | null }) {
  if (volume === null || volume === 0) return null;
  const color = volume >= 1000 ? "#10a37f" : volume >= 100 ? "#f59e0b" : "#9ca3af";
  const bg = volume >= 1000 ? "#e6f6f2" : volume >= 100 ? "#fef3c7" : "#f3f4f6";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: bg, color }}>
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
      </svg>
      {volume.toLocaleString("fr-FR")} / mois
    </span>
  );
}

function SourceChip({ source }: { source: LLMMentionSource }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-ink-soft border border-hairline bg-white hover:border-brand hover:text-brand transition-colors">
      <Image
        src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
        alt=""
        width={12}
        height={12}
        unoptimized
        className="h-3 w-3 rounded-sm"
      />
      <span className="max-w-[120px] truncate">{source.domain}</span>
      {source.rank && <span className="text-ink-soft/60">#{source.rank}</span>}
    </a>
  );
}

function MentionCard({ item }: { item: LLMMentionItem }) {
  const [expanded, setExpanded] = useState(false);
  const answerPreview = item.answer.replace(/[*_#`]/g, "").slice(0, 200);
  const truncated = item.answer.replace(/[*_#`]/g, "").length > 200;

  return (
    <div className="rounded-2xl border border-hairline bg-white p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink leading-snug">{item.question}</p>
        <div className="flex items-center gap-2 shrink-0">
          <PlatformBadge platform={item.platform} />
          <VolumeBadge volume={item.ai_search_volume} />
        </div>
      </div>

      {/* Answer excerpt */}
      <div className="rounded-xl bg-accent/40 px-4 py-3">
        <p className="text-sm text-ink-soft leading-relaxed">
          {expanded ? item.answer.replace(/[*_#`]/g, "") : answerPreview}
          {truncated && !expanded && "…"}
        </p>
        {truncated && (
          <button onClick={() => setExpanded(v => !v)}
            className="mt-1.5 text-xs text-brand hover:underline">
            {expanded ? "Réduire" : "Voir tout"}
          </button>
        )}
      </div>

      {/* Sources */}
      {item.sources.length > 0 && (
        <div>
          <p className="text-xs text-ink-soft mb-1.5 font-medium">Sources citées</p>
          <div className="flex flex-wrap gap-1.5">
            {item.sources.slice(0, 8).map((s, i) => <SourceChip key={i} source={s} />)}
          </div>
        </div>
      )}

      {/* Fan-out queries */}
      {item.fan_out_queries && item.fan_out_queries.length > 0 && (
        <div>
          <p className="text-xs text-ink-soft mb-1.5 font-medium">Requêtes associées</p>
          <div className="flex flex-wrap gap-1.5">
            {item.fan_out_queries.slice(0, 5).map((q, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs border border-hairline text-ink-soft bg-accent/30">
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      {item.last_response_at && (
        <p className="text-xs text-ink-soft/60">
          Dernière réponse : {new Date(item.last_response_at).toLocaleDateString("fr-FR")}
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MentionsIAPage() {
  const [domain, setDomain] = useState("");
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("fr");
  const [platform, setPlatform] = useState<"" | "chat_gpt" | "google">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MentionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Load user profile to pre-fill domain
  useEffect(() => {
    fetch("/api/account/profile")
      .then(r => r.ok ? r.json() : null)
      .then((data: UserProfile | null) => {
        if (data?.site_url) {
          setProfile(data);
          setDomain(extractDomain(data.site_url));
        }
      })
      .catch(() => null);
  }, []);

  const locationCode = LANGUAGES.find(l => l.code === language)?.location ?? 2250;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() && !keyword.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        language_code: language,
        location_code: locationCode,
        limit: 50,
      };
      if (domain.trim()) body.domain = extractDomain(domain.trim());
      if (keyword.trim()) body.keyword = keyword.trim();
      if (platform) body.platform = platform;

      const res = await fetch("/api/llm-mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as MentionsResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur serveur");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const chatgptCount = result?.items.filter(i => i.platform === "chat_gpt").length ?? 0;
  const geminiCount = result?.items.filter(i => i.platform === "google").length ?? 0;
  const totalVolume = result?.items.reduce((s, i) => s + (i.ai_search_volume ?? 0), 0) ?? 0;
  const avgVolume = result && result.items.length > 0 ? Math.round(totalVolume / result.items.length) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-accent/30 px-3 py-1 text-xs text-ink-soft mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Données DataForSEO · Base indexée ChatGPT &amp; Gemini
        </div>
        <h1 className="font-display text-3xl font-bold text-ink">Mentions IA</h1>
        <p className="mt-2 text-sm text-ink-soft max-w-xl">
          Explorez les questions que ChatGPT et Gemini répondent en mentionnant votre domaine ou un mot-clé. Données issues de la base indexée DataForSEO.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="rounded-2xl border border-hairline bg-white p-6 mb-8 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Domain */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">
              Domaine
            </label>
            <div className="relative">
              {domain && hasTLD(domain) && (
                <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
                  <Image
                    src={`https://www.google.com/s2/favicons?domain=${extractDomain(domain)}&sz=32`}
                    alt="" width={16} height={16} unoptimized
                    className="h-4 w-4 rounded"
                  />
                </div>
              )}
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="ex: monsite.fr"
                className={`w-full rounded-lg border border-hairline bg-white py-2 text-sm focus:outline-none focus:border-brand ${domain && hasTLD(domain) ? "pl-8 pr-3" : "px-3"}`}
              />
            </div>
          </div>

          {/* Keyword */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">
              Mot-clé <span className="font-normal text-ink-soft">(optionnel)</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="ex: logiciel comptabilité TPE"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Language */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">Langue :</span>
            <div className="flex gap-1">
              {LANGUAGES.map(l => (
                <button key={l.code} type="button" onClick={() => setLanguage(l.code)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${language === l.code ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">Plateforme :</span>
            <div className="flex gap-1">
              {(["", "chat_gpt", "google"] as const).map(p => (
                <button key={p} type="button" onClick={() => setPlatform(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${platform === p ? "border-brand bg-brand/10 text-brand" : "border-hairline text-ink-soft hover:text-ink"}`}>
                  {p === "" ? "Toutes" : p === "chat_gpt" ? "ChatGPT" : "Gemini"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || (!domain.trim() && !keyword.trim())}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow glow-brand transition hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Recherche…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                Rechercher les mentions
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border border-hairline bg-white p-4">
              <p className="text-xs text-ink-soft mb-0.5">Total mentions</p>
              <p className="text-2xl font-bold text-ink">{result.total_count.toLocaleString("fr-FR")}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-4">
              <p className="text-xs text-ink-soft mb-0.5">ChatGPT</p>
              <p className="text-2xl font-bold text-ink" style={{ color: "#10a37f" }}>{chatgptCount}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-4">
              <p className="text-xs text-ink-soft mb-0.5">Gemini</p>
              <p className="text-2xl font-bold text-ink" style={{ color: "#4285f4" }}>{geminiCount}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-4">
              <p className="text-xs text-ink-soft mb-0.5">Volume moy.</p>
              <p className="text-2xl font-bold text-ink">{avgVolume.toLocaleString("fr-FR")}</p>
            </div>
          </div>

          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline bg-white p-12 text-center">
              <p className="text-sm text-ink-soft">Aucune mention trouvée dans la base DataForSEO pour ces paramètres.</p>
              <p className="text-xs text-ink-soft/60 mt-2">Essayez un domaine plus connu, un mot-clé plus large, ou changez de langue.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-ink-soft">
                {result.items_count} résultat{result.items_count > 1 ? "s" : ""} affichés
                {result.total_count > result.items_count ? ` sur ${result.total_count.toLocaleString("fr-FR")} au total` : ""}
              </p>
              {result.items.map((item, i) => <MentionCard key={i} item={item} />)}
            </div>
          )}
        </>
      )}

      {/* Empty state — before search */}
      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-hairline bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink mb-1.5">Trouvez vos mentions dans les IA</h2>
          <p className="text-sm text-ink-soft max-w-sm mx-auto">
            Entrez votre domaine pour découvrir toutes les questions auxquelles ChatGPT et Gemini répondent en vous mentionnant.
          </p>
          {profile?.site_url && (
            <p className="mt-3 text-xs text-ink-soft/60">
              Domaine pré-rempli depuis votre profil : <strong>{extractDomain(profile.site_url)}</strong>
            </p>
          )}
        </div>
      )}

    </div>
  );
}
