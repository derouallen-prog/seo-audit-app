"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface SiteProfile {
  site_url?: string;
  positioning?: string;
  categories?: string[];
  market?: string;
  target_zones?: string[];
  competitors?: string[];
  tech_stack?: { name: string; category: string; color: string }[];
  sitemap_count?: number;
}

const CATEGORIES = ["E-commerce", "Blog & média", "Vente de services", "Formation", "SaaS", "Affiliation", "Forum", "Application mobile", "Vente de leads"];
const ZONES = ["France", "Belgique", "Suisse", "Canada", "Afrique francophone", "Europe", "International"];
const TABS = ["À propos", "Concurrents", "Sitemap & pages"] as const;
type Tab = typeof TABS[number];

type ClearbitSuggestion = { name: string; domain: string; logo: string };

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft/60 mb-2">{children}</p>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active ? "border-brand bg-brand/8 text-brand" : "border-hairline bg-background text-ink-soft hover:border-ink/20 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export default function SitePage() {
  const [tab, setTab] = useState<Tab>("À propos");
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [siteUrl, setSiteUrl] = useState("");
  const [positioning, setPositioning] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [market, setMarket] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");

  // Autocomplete Clearbit — champ Mon site
  const [siteUrlSuggestions, setSiteUrlSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [showSiteUrlSuggestions, setShowSiteUrlSuggestions] = useState(false);
  const siteUrlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete Clearbit — champ concurrent
  const [competitorSuggestions, setCompetitorSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [showCompetitorSuggestions, setShowCompetitorSuggestions] = useState(false);
  const competitorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestions IA de concurrents
  type AiSuggestion = { domain: string; name: string };
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestedMarket, setAiSuggestedMarket] = useState("");

  useEffect(() => {
    fetch("/api/account/profile").then(r => r.json()).then((d: { profile: SiteProfile | null }) => {
      const p = d.profile ?? {};
      setProfile(p);
      setSiteUrl(p.site_url ?? "");
      setPositioning(p.positioning ?? "");
      setCategories(p.categories ?? []);
      setMarket(p.market ?? "");
      setZones(p.target_zones ?? []);
      setCompetitors(p.competitors ?? []);
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ site_url: siteUrl, positioning, categories, market, target_zones: zones, competitors }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleCategory(c: string) {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  function toggleZone(z: string) {
    setZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]);
  }
  function onSiteUrlChange(v: string) {
    const stripped = v.replace(/^https?:\/\//i, "");
    setSiteUrl(stripped);
    if (siteUrlTimer.current) clearTimeout(siteUrlTimer.current);
    const q = stripped.trim();
    if (q.length < 2 || hasTLD(q)) {
      setSiteUrlSuggestions([]);
      setShowSiteUrlSuggestions(false);
      return;
    }
    siteUrlTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = (await res.json()) as ClearbitSuggestion[];
          if (!hasTLD(q)) { setSiteUrlSuggestions(list); setShowSiteUrlSuggestions(list.length > 0); }
        }
      } catch { /* réseau indisponible */ }
    }, 300);
  }

  function onCompetitorInputChange(v: string) {
    setCompetitorInput(v);
    if (competitorTimer.current) clearTimeout(competitorTimer.current);
    const q = v.trim();
    if (q.length < 2 || hasTLD(q)) {
      setCompetitorSuggestions([]);
      setShowCompetitorSuggestions(false);
      return;
    }
    competitorTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) {
          const list = (await res.json()) as ClearbitSuggestion[];
          if (!hasTLD(q)) { setCompetitorSuggestions(list); setShowCompetitorSuggestions(list.length > 0); }
        }
      } catch { /* réseau indisponible */ }
    }, 300);
  }

  function addCompetitor() {
    const raw = competitorInput.trim().replace(/^https?:\/\//, "");
    if (!raw || competitors.includes(raw) || competitors.length >= 10) return;
    setCompetitors(prev => [...prev, raw]);
    setCompetitorInput("");
    setCompetitorSuggestions([]);
    setShowCompetitorSuggestions(false);
  }
  function removeCompetitor(c: string) {
    setCompetitors(prev => prev.filter(x => x !== c));
  }

  async function suggestCompetitorsWithAI() {
    const domain = siteUrl.trim();
    if (!domain) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/account/suggest-competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site_url: domain, market: market.trim() || undefined }),
      });
      if (res.ok) {
        const data = (await res.json()) as { market?: string; competitors?: AiSuggestion[] };
        if (data.competitors) setAiSuggestions(data.competitors);
        if (data.market && !market.trim()) setAiSuggestedMarket(data.market);
      }
    } catch { /* non bloquant */ }
    finally { setAiLoading(false); }
  }

  function addAiSuggestion(domain: string) {
    if (!domain || competitors.includes(domain) || competitors.length >= 10) return;
    setCompetitors(prev => [...prev, domain]);
    setAiSuggestions(prev => prev.filter(s => s.domain !== domain));
  }

  const hostname = (() => { try { return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname; } catch { return siteUrl; } })();

  const siteDisplayVal = siteUrl.replace(/^https?:\/\//i, "");
  const siteDomain = siteDisplayVal.replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const siteFaviconUrl = hasTLD(siteDisplayVal) && siteDomain
    ? `https://www.google.com/s2/favicons?domain=${siteDomain}&sz=64` : null;

  const competitorDomain = competitorInput.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const competitorFaviconUrl = hasTLD(competitorInput.trim()) && competitorDomain
    ? `https://www.google.com/s2/favicons?domain=${competitorDomain}&sz=64` : null;

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-soft text-sm">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Mon site</h1>
          {hostname && <p className="text-sm text-ink-soft mt-0.5">{hostname}</p>}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-60 shrink-0"
        >
          {saving ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>

      {/* URL */}
      <div className="relative">
        <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
          <span className="flex items-center gap-2 border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none">
            {siteFaviconUrl && (
              <Image src={siteFaviconUrl} alt="" width={18} height={18} unoptimized className="h-[18px] w-[18px] rounded object-contain" />
            )}
            https://
          </span>
          <input
            value={siteDisplayVal}
            onChange={e => onSiteUrlChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSiteUrlSuggestions(false), 150)}
            onFocus={() => siteUrlSuggestions.length > 0 && setShowSiteUrlSuggestions(true)}
            placeholder="www.monsite.fr"
            className="flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
        {showSiteUrlSuggestions && siteUrlSuggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-2 rounded-xl border border-hairline bg-white shadow-xl overflow-hidden">
            {siteUrlSuggestions.map(s => (
              <button
                key={s.domain}
                type="button"
                onMouseDown={() => { setSiteUrl(s.domain); setSiteUrlSuggestions([]); setShowSiteUrlSuggestions(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
              >
                {s.logo
                  ? <Image src={s.logo} alt="" width={24} height={24} unoptimized className="w-6 h-6 rounded shrink-0 object-contain border border-hairline" />
                  : <div className="w-6 h-6 rounded bg-brand-soft shrink-0 flex items-center justify-center text-xs font-bold text-brand">{s.name[0]}</div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-soft">{s.domain}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-hairline flex gap-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: À propos */}
      {tab === "À propos" && (
        <div className="space-y-6">
          {/* Catégories */}
          <div>
            <SectionLabel>Contexte métier</SectionLabel>
            <p className="text-xs text-ink-soft mb-3">Quelles catégories définissent le mieux ton site ?</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <Chip key={c} label={c} active={categories.includes(c)} onClick={() => toggleCategory(c)} />
              ))}
            </div>
          </div>

          {/* Positionnement + Marché */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel>Positionnement</SectionLabel>
              <textarea
                value={positioning}
                onChange={e => setPositioning(e.target.value)}
                rows={4}
                placeholder="Décris en 1-3 phrases ce que ton site propose et à qui…"
                className="w-full rounded-xl border border-hairline bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all resize-none placeholder:text-ink-soft/50"
              />
            </div>
            <div>
              <SectionLabel>Marché</SectionLabel>
              <textarea
                value={market}
                onChange={e => setMarket(e.target.value)}
                rows={4}
                placeholder="Ex : Perruques et accessoires capillaires pour alopécie…"
                className="w-full rounded-xl border border-hairline bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all resize-none placeholder:text-ink-soft/50"
              />
            </div>
          </div>

          {/* Zone cible */}
          <div>
            <SectionLabel>Zone cible</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {ZONES.map(z => (
                <Chip key={z} label={z} active={zones.includes(z)} onClick={() => toggleZone(z)} />
              ))}
            </div>
          </div>

          {/* Stack tech */}
          {(profile.tech_stack?.length ?? 0) > 0 && (
            <div>
              <SectionLabel>Stack technique détectée</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {profile.tech_stack!.map(t => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-3 py-1.5 text-xs font-medium text-ink"
                    style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}
                  >
                    {t.name}
                    <span className="text-[10px] text-ink-soft">{t.category}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Concurrents */}
      {tab === "Concurrents" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-ink-soft">Ces domaines alimentent les analyses comparatives de l&apos;assistant SEO.</p>
            {siteFaviconUrl && competitors.length < 10 && (
              <button
                onClick={suggestCompetitorsWithAI}
                disabled={aiLoading}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 transition disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM6 8l1.5 1.5L10 6"/></svg>
                    Suggérer via IA
                  </>
                )}
              </button>
            )}
          </div>

          {/* Marché détecté par l'IA */}
          {aiSuggestedMarket && (
            <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 flex items-start gap-3">
              <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 mt-0.5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1"/></svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand mb-0.5">Marché détecté</p>
                <p className="text-sm text-ink">{aiSuggestedMarket}</p>
                {!market.trim() && (
                  <button
                    onClick={() => { setMarket(aiSuggestedMarket); setAiSuggestedMarket(""); }}
                    className="mt-1.5 text-xs text-brand hover:underline"
                  >
                    Utiliser comme description de marché →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Suggestions IA */}
          {aiSuggestions.length > 0 && (
            <div className="rounded-xl border border-hairline bg-background p-4 space-y-2">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">Concurrents suggérés par l&apos;IA</p>
              {aiSuggestions.map(s => (
                <div key={s.domain} className="flex items-center gap-3">
                  <Image
                    src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`}
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                    className="h-5 w-5 rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-soft">{s.domain}</p>
                  </div>
                  <button
                    onClick={() => addAiSuggestion(s.domain)}
                    disabled={competitors.includes(s.domain) || competitors.length >= 10}
                    className="shrink-0 rounded-lg border border-brand/40 bg-brand/5 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition disabled:opacity-40"
                  >
                    {competitors.includes(s.domain) ? "Ajouté" : "+ Ajouter"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {competitors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {competitors.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-3 py-1.5 text-xs font-medium text-ink">
                  {c}
                  <button onClick={() => removeCompetitor(c)} className="text-ink-soft hover:text-ink">
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="flex overflow-hidden rounded-xl border border-hairline bg-background focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                <span className="flex items-center pl-3 text-ink-soft/50">
                  {competitorFaviconUrl
                    ? <Image src={competitorFaviconUrl} alt="" width={18} height={18} unoptimized className="h-[18px] w-[18px] rounded object-contain" />
                    : <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
                  }
                </span>
                <input
                  value={competitorInput}
                  onChange={e => onCompetitorInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCompetitor(); } }}
                  onBlur={() => setTimeout(() => setShowCompetitorSuggestions(false), 150)}
                  onFocus={() => competitorSuggestions.length > 0 && setShowCompetitorSuggestions(true)}
                  placeholder="concurrent.fr + Entrée"
                  disabled={competitors.length >= 10}
                  className="flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50"
                />
              </div>
              {showCompetitorSuggestions && competitorSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-2 rounded-xl border border-hairline bg-white shadow-xl overflow-hidden">
                  {competitorSuggestions.map(s => (
                    <button
                      key={s.domain}
                      type="button"
                      onMouseDown={() => { setCompetitorInput(s.domain); setCompetitorSuggestions([]); setShowCompetitorSuggestions(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                    >
                      {s.logo
                        ? <Image src={s.logo} alt="" width={24} height={24} unoptimized className="w-6 h-6 rounded shrink-0 object-contain border border-hairline" />
                        : <div className="w-6 h-6 rounded bg-brand-soft shrink-0 flex items-center justify-center text-xs font-bold text-brand">{s.name[0]}</div>
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{s.name}</p>
                        <p className="text-xs text-ink-soft">{s.domain}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={addCompetitor}
              disabled={!competitorInput.trim() || competitors.length >= 10}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-brand/90 transition"
            >
              Ajouter
            </button>
          </div>
          <p className="text-xs text-ink-soft/60">{competitors.length}/10 concurrents</p>
        </div>
      )}

      {/* Tab: Sitemap & pages */}
      {tab === "Sitemap & pages" && (
        <div className="space-y-4">
          {profile.sitemap_count != null && profile.sitemap_count > 0 ? (
            <div className="rounded-xl border border-hairline bg-background px-5 py-5">
              <p className="text-4xl font-bold text-ink tabular-nums">{profile.sitemap_count.toLocaleString("fr-FR")}</p>
              <p className="text-sm text-ink-soft mt-1">pages détectées dans le sitemap</p>
              <p className="text-xs text-ink-soft/60 mt-3">Ces données ont été collectées lors de l&apos;onboarding. Pour les mettre à jour, relance une analyse depuis la page d&apos;audit.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-hairline bg-muted/30 px-5 py-5 text-center">
              <p className="text-sm text-ink-soft">Aucun sitemap détecté pour ce site.</p>
              <p className="text-xs text-ink-soft/60 mt-1">Assure-toi que ton sitemap est déclaré dans ton <code className="bg-muted px-1 py-0.5 rounded text-[11px]">robots.txt</code> ou accessible via <code className="bg-muted px-1 py-0.5 rounded text-[11px]">/sitemap.xml</code>.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
