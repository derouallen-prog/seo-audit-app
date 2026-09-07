"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
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
  const [revealStep, setRevealStep] = useState(0); // 0=idle 1=domain 2=sitemap 3=serp
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<string[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const competitorInputRef = useRef<HTMLInputElement>(null);

  // Progressive reveal + fetch competitor suggestions in background
  useEffect(() => {
    if (!detectResult) return;
    setRevealStep(1);
    const t1 = setTimeout(() => setRevealStep(2), 600);
    const t2 = setTimeout(() => setRevealStep(3), 1300);

    // Fetch suggestions in background — won't block reveal
    setSuggestedCompetitors([]);
    setLoadingCompetitors(true);
    const domain = (() => { try { return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname; } catch { return siteUrl; } })();
    fetch("/api/onboarding/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        metaTitle: detectResult.pageData?.title,
        metaDesc: detectResult.pageData?.metaDesc,
        h1: detectResult.pageData?.h1,
      }),
    })
      .then(r => r.json())
      .then((d: { competitors: string[] }) => setSuggestedCompetitors(d.competitors ?? []))
      .catch(() => {})
      .finally(() => setLoadingCompetitors(false));

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [detectResult, siteUrl]);

  // ── Step 0: URL ──────────────────────────────────────────────────────────────

  async function handleDetect() {
    const raw = urlInput.trim();
    if (!raw) return;
    const url = raw.startsWith("http") ? raw : `https://${raw}`;

    setDetecting(true);
    setDetectError("");
    setDetectResult(null);
    setRevealStep(0);

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
      // step stays at 0 — user clicks "Continuer" after the reveal
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
          {step === 0 && !detectResult && "Parlons de ton site"}
          {step === 0 && detectResult && "C'est bon."}
          {step === 1 && "Tes concurrents"}
          {step === 2 && "Ton positionnement"}
        </h1>
        <p className="mb-6 text-sm text-ink-soft">
          {step === 0 && !detectResult && "Search Mind analyse ton site pour personnaliser ton expérience."}
          {step === 0 && detectResult && "Voici ce que j'ai trouvé sur ton site."}
          {step === 1 && "Ajoute jusqu'à 5 concurrents. Tu pourras les modifier plus tard."}
          {step === 2 && "On a détecté ce positionnement. Confirme ou modifie-le."}
        </p>

        <StepDots current={step} total={3} />

        <div className="mt-8">

          {/* ─── Step 0: URL ─────────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Input — masqué une fois la détection terminée */}
              {!detectResult && (
                <>
                  <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
                    <span className="flex items-center border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none">
                      https://
                    </span>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={e => {
                        const v = e.target.value.replace(/^https?:\/\//, "").replace(/^\/\//, "");
                        setUrlInput(v);
                      }}
                      onKeyDown={e => e.key === "Enter" && handleDetect()}
                      placeholder="www.monsite.fr"
                      className="flex-1 bg-transparent px-3 py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/50"
                      autoFocus
                    />
                  </div>
                  {detectError && <p className="text-xs text-warning">{detectError}</p>}
                  <button
                    onClick={handleDetect}
                    disabled={detecting || !urlInput.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {detecting ? <><Spinner /> Analyse en cours…</> : "Analyser mon site →"}
                  </button>
                </>
              )}

              {/* Révélation progressive pendant / après détection */}
              {(detecting || detectResult) && (
                <div className="space-y-3 pt-1">

                  {/* Ligne 1 — domaine */}
                  <div className="flex items-center gap-2.5 text-sm">
                    {detecting && !detectResult
                      ? <Spinner />
                      : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shrink-0">
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                        </span>
                    }
                    <span className="font-medium text-ink">{(() => { try { return new URL(detecting ? `https://${urlInput}` : siteUrl).hostname; } catch { return urlInput; } })()}</span>
                  </div>

                  {/* Ligne 2 — sitemap */}
                  {revealStep >= 2 && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 8 6.5 11.5 13 4.5" /></svg>
                      </span>
                      <span className="text-ink-soft">
                        {detectResult?.sitemapCount
                          ? <><span className="font-semibold text-ink tabular-nums">{detectResult.sitemapCount.toLocaleString("fr-FR")}</span> pages dans le sitemap</>
                          : "Sitemap non détecté"
                        }
                      </span>
                    </div>
                  )}

                  {/* Aperçu SERP + chiffre + stack */}
                  {revealStep >= 3 && detectResult && (
                    <div className="space-y-3 pt-1">
                      {/* Carte SERP */}
                      {detectResult.pageData?.title && (
                        <div className="rounded-xl border border-hairline bg-background px-4 py-3 space-y-0.5 shadow-sm">
                          <p className="text-[11px] text-ink-soft truncate">{(() => { try { return new URL(siteUrl).hostname; } catch { return siteUrl; } })()}</p>
                          <p className="text-sm font-medium text-[#1a0dab] dark:text-[#8ab4f8] leading-snug line-clamp-1">{detectResult.pageData.title}</p>
                          {detectResult.pageData.metaDesc && (
                            <p className="text-xs text-ink-soft/80 leading-relaxed line-clamp-2">{detectResult.pageData.metaDesc}</p>
                          )}
                        </div>
                      )}

                      {/* Chiffre pages + stack */}
                      {(detectResult.sitemapCount > 0 || detectResult.techStack.length > 0) && (
                        <div className="flex items-end justify-between gap-4">
                          {detectResult.sitemapCount > 0 ? (
                            <div>
                              <p className="text-4xl font-bold text-ink tabular-nums">{detectResult.sitemapCount.toLocaleString("fr-FR")}</p>
                              <p className="text-xs text-ink-soft mt-0.5">pages indexables</p>
                            </div>
                          ) : <div />}
                          {detectResult.techStack.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              {detectResult.techStack.slice(0, 4).map(t => <TechBadge key={t.name} tech={t} />)}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => setStep(1)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90"
                      >
                        Continuer →
                      </button>
                    </div>
                  )}
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

              {/* Suggestions IA */}
              {(loadingCompetitors || suggestedCompetitors.length > 0) && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60 flex items-center gap-1.5">
                    Suggestions
                    {loadingCompetitors && <Spinner />}
                  </p>
                  {suggestedCompetitors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestedCompetitors.map(c => {
                        const added = competitors.includes(c);
                        const full = !added && competitors.length >= 5;
                        return (
                          <button
                            key={c}
                            disabled={full}
                            onClick={() => {
                              if (added) { removeCompetitor(c); }
                              else if (!full) { setCompetitors(prev => [...prev, c]); }
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                              added
                                ? "border-brand bg-brand/8 text-brand"
                                : full
                                ? "border-hairline bg-background text-ink-soft/40 cursor-not-allowed"
                                : "border-hairline bg-background text-ink-soft hover:border-brand/40 hover:text-ink"
                            }`}
                          >
                            {added && (
                              <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 8 6.5 11.5 13 4.5" />
                              </svg>
                            )}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Competitor chips — manually added ones not in suggestions */}
              {competitors.filter(c => !suggestedCompetitors.includes(c)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {competitors.filter(c => !suggestedCompetitors.includes(c)).map(c => (
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
