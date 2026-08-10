"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { DetectedTech } from "@/lib/techDetect";

// ── Icons ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-brand text-white glow-brand shrink-0">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m20 20-4.5-4.5" />
          <circle cx="10.5" cy="10.5" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex items-baseline gap-1 leading-none">
        <span className="font-display text-xl text-ink">Search</span>
        <span className="font-display text-xl italic text-brand">Mind</span>
      </span>
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-brand" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-6 bg-brand" : i < current ? "w-1.5 bg-brand/40" : "w-1.5 bg-ink/15"
          }`}
        />
      ))}
    </div>
  );
}

// ── Tech badge ────────────────────────────────────────────────────────────────

function TechBadge({ tech }: { tech: DetectedTech }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-3 py-1.5 text-xs font-medium text-ink"
      style={{ borderLeftColor: tech.color, borderLeftWidth: 3 }}
    >
      {tech.name}
      <span className="text-[10px] text-ink-soft">{tech.category}</span>
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectResult {
  techStack: DetectedTech[];
  positioning: string | null;
  sitemapCount: number;
  pageData: { title: string; h1: string; metaDesc: string } | null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [detectError, setDetectError] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [positioning, setPositioning] = useState("");
  const [saving, setSaving] = useState(false);
  const competitorInputRef = useRef<HTMLInputElement>(null);

  // ── Step 0: URL ──────────────────────────────────────────────────────────────

  async function handleDetect() {
    const raw = urlInput.trim();
    if (!raw) return;
    const url = raw.startsWith("http") ? raw : `https://${raw}`;

    setDetecting(true);
    setDetectError("");

    try {
      const res = await fetch("/api/onboarding/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'analyse");

      const data = await res.json() as DetectResult;
      setSiteUrl(url);
      setDetectResult(data);
      if (data.positioning) setPositioning(data.positioning);
      setStep(1);
    } catch {
      setDetectError("Impossible d'analyser ce site. Vérifie l'URL et réessaie.");
    } finally {
      setDetecting(false);
    }
  }

  // ── Step 1: Competitors ──────────────────────────────────────────────────────

  function addCompetitor() {
    const raw = competitorInput.trim().replace(/^https?:\/\//, "");
    if (!raw || competitors.includes(raw) || competitors.length >= 5) return;
    setCompetitors(prev => [...prev, raw]);
    setCompetitorInput("");
    competitorInputRef.current?.focus();
  }

  function removeCompetitor(c: string) {
    setCompetitors(prev => prev.filter(x => x !== c));
  }

  function handleCompetitorKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCompetitor(); }
  }

  // ── Step 2: Confirm & save ───────────────────────────────────────────────────

  async function handleFinish() {
    setSaving(true);
    try {
      await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: siteUrl,
          competitors,
          tech_stack: detectResult?.techStack ?? [],
          positioning,
          onboarding_completed: true,
        }),
      });
      router.push("/");
    } catch {
      setSaving(false);
    }
  }

  async function handleSkip() {
    await fetch("/api/onboarding/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_url: siteUrl || "", onboarding_completed: true }),
    });
    router.push("/");
  }

  // ── Hostname display ──────────────────────────────────────────────────────────

  const displayHost = siteUrl
    ? (() => { try { return new URL(siteUrl).hostname; } catch { return siteUrl; } })()
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <button
          onClick={handleSkip}
          className="text-xs text-ink-soft hover:text-ink transition-colors underline underline-offset-2"
        >
          Passer pour l&apos;instant
        </button>
      </header>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-16">

        {/* Site breadcrumb */}
        {displayHost && (
          <p className="mb-2 text-xs font-medium text-ink-soft/70 tracking-wide">{displayHost}</p>
        )}

        <h1 className="font-display text-2xl font-semibold text-ink mb-1">
          {step === 0 && "Parlons de ton site"}
          {step === 1 && "Tes concurrents"}
          {step === 2 && "Ton positionnement"}
        </h1>
        <p className="mb-6 text-sm text-ink-soft">
          {step === 0 && "Search Mind analyse ton site pour personnaliser ton expérience."}
          {step === 1 && "Ajoute jusqu'à 5 concurrents. Tu pourras les modifier plus tard."}
          {step === 2 && "On a détecté ce positionnement. Confirme ou modifie-le."}
        </p>

        <StepDots current={step} total={3} />

        <div className="mt-8">

          {/* ─── Step 0: URL ─────────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                <span className="flex items-center border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none">
                  https://
                </span>
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleDetect()}
                  placeholder="monsite.fr"
                  className="flex-1 bg-transparent px-3 py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/50"
                  autoFocus
                />
              </div>

              {detectError && (
                <p className="text-xs text-warning">{detectError}</p>
              )}

              <button
                onClick={handleDetect}
                disabled={detecting || !urlInput.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {detecting ? <><Spinner /> Analyse en cours…</> : "Analyser mon site →"}
              </button>

              {detecting && (
                <div className="rounded-xl border border-hairline bg-muted/40 px-4 py-4 text-xs text-ink-soft space-y-1.5">
                  <p className="flex items-center gap-2"><Spinner /> Détection de la stack technique…</p>
                  <p className="text-ink-soft/60 pl-6">Lecture du sitemap et de la homepage…</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 1: Competitors ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {detectResult && (detectResult.techStack.length > 0 || detectResult.sitemapCount > 0) && (
                <div className="rounded-xl border border-hairline bg-muted/30 px-4 py-3 text-xs text-ink-soft space-y-2">
                  {detectResult.sitemapCount > 0 && (
                    <p><span className="font-semibold text-ink tabular-nums">{detectResult.sitemapCount.toLocaleString("fr-FR")}</span> pages dans le sitemap</p>
                  )}
                  {detectResult.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {detectResult.techStack.map(t => <TechBadge key={t.name} tech={t} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Competitor chips */}
              {competitors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {competitors.map(c => (
                    <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-background px-3 py-1.5 text-xs font-medium text-ink">
                      {c}
                      <button onClick={() => removeCompetitor(c)} className="text-ink-soft hover:text-ink transition-colors" aria-label="Supprimer">
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                <span className="flex items-center pl-3 text-ink-soft/50">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
                </span>
                <input
                  ref={competitorInputRef}
                  type="text"
                  value={competitorInput}
                  onChange={e => setCompetitorInput(e.target.value)}
                  onKeyDown={handleCompetitorKey}
                  onBlur={addCompetitor}
                  placeholder={`Ajouter un concurrent + Entrée${competitors.length >= 5 ? " (max 5)" : ""}`}
                  disabled={competitors.length >= 5}
                  className="flex-1 bg-transparent px-3 py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/50 disabled:opacity-40"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-ink-soft/60">Exemples : duck-shop.fr, parisduckstore.fr</p>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep(0)} className="text-xs text-ink-soft hover:text-ink transition-colors">← Retour</button>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90"
                >
                  C&apos;est bon
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 8 7 11 12 5" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Positioning ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-hairline bg-background shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60 mb-2">Positionnement détecté</p>
                  <textarea
                    value={positioning}
                    onChange={e => setPositioning(e.target.value)}
                    rows={3}
                    placeholder="Décris en une phrase l'activité et la proposition de valeur de ce site…"
                    className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/40 leading-relaxed"
                  />
                </div>
                <div className="border-t border-hairline bg-muted/30 px-4 py-2.5 text-[11px] text-ink-soft/60">
                  Tu pourras modifier ce positionnement dans Gérer mes sites.
                </div>
              </div>

              {competitors.length > 0 && (
                <div className="rounded-xl border border-hairline bg-muted/30 px-4 py-3 text-xs text-ink-soft">
                  <span className="font-semibold text-ink">{competitors.length} concurrent{competitors.length > 1 ? "s" : ""} ajouté{competitors.length > 1 ? "s" : ""}</span>
                  {" · "}{competitors.join(", ")}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-xs text-ink-soft hover:text-ink transition-colors">← Retour</button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-60"
                >
                  {saving ? <><Spinner /> Enregistrement…</> : <>Accéder à Search Mind →</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
