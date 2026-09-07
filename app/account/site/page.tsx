"use client";

import { useState, useEffect } from "react";

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
  function addCompetitor() {
    const raw = competitorInput.trim().replace(/^https?:\/\//, "");
    if (!raw || competitors.includes(raw) || competitors.length >= 10) return;
    setCompetitors(prev => [...prev, raw]);
    setCompetitorInput("");
  }
  function removeCompetitor(c: string) {
    setCompetitors(prev => prev.filter(x => x !== c));
  }

  const hostname = (() => { try { return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname; } catch { return siteUrl; } })();

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
      <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
        <span className="flex items-center border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none">https://</span>
        <input
          value={siteUrl.replace(/^https?:\/\//, "")}
          onChange={e => setSiteUrl(e.target.value.replace(/^https?:\/\//, ""))}
          placeholder="www.monsite.fr"
          className="flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50"
        />
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
          <p className="text-sm text-ink-soft">Ces domaines alimentent les analyses comparatives de l&apos;assistant SEO.</p>

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
            <div className="flex-1 flex overflow-hidden rounded-xl border border-hairline bg-background focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
              <span className="flex items-center pl-3 text-ink-soft/50">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
              </span>
              <input
                value={competitorInput}
                onChange={e => setCompetitorInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCompetitor(); } }}
                placeholder="concurrent.fr + Entrée"
                disabled={competitors.length >= 10}
                className="flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50"
              />
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
