"use client";

import { useState, useRef, useEffect, forwardRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { DetectedTech } from "@/lib/techDetect";
import type { OnboardingKeywordInsight } from "@/app/api/onboarding/keywords/route";

// ── Domain autocomplete ────────────────────────────────────────────────────────

interface ClearbitSuggestion { name: string; domain: string; logo: string }

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

function DomainInput({
  value, onChange, onSubmit, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanDomain = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const faviconUrl = hasTLD(value) && cleanDomain
    ? `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`
    : null;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2 || hasTLD(q)) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) setSuggestions((await res.json()) as ClearbitSuggestion[]);
      } catch { /* réseau */ }
      finally { setFetching(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  function select(domain: string) {
    onChange(domain);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
        <span className="flex items-center border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none shrink-0">
          https://
        </span>
        {faviconUrl && (
          <div className="pointer-events-none flex items-center pl-3">
            <Image src={faviconUrl} alt="" width={18} height={18} unoptimized className="h-[18px] w-[18px] rounded object-contain" />
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value.replace(/^https?:\/\//, "").replace(/^\/\//, "");
            onChange(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          placeholder="www.monsite.fr"
          disabled={disabled}
          className={`flex-1 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/50 ${faviconUrl ? "pl-2 pr-3" : "px-3"}`}
          autoFocus
        />
      </div>

      {open && (fetching || suggestions.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hairline bg-background shadow-lg overflow-hidden">
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

// ── Competitor input (favicon + autosuggest + ajout direct) ─────────────────────

const CompetitorInput = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onSelect: (domain: string) => void;
  disabled?: boolean;
  placeholder: string;
}>(function CompetitorInput({ value, onChange, onKeyDown, onBlur, onSelect, disabled, placeholder }, ref) {
  const [suggestions, setSuggestions] = useState<ClearbitSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanDomain = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const faviconUrl = hasTLD(value) && cleanDomain
    ? `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`
    : null;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2 || hasTLD(q)) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`);
        if (res.ok) setSuggestions((await res.json()) as ClearbitSuggestion[]);
      } catch { /* réseau */ }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
        <span className="flex items-center pl-3 text-ink-soft/50">
          {faviconUrl
            ? <Image src={faviconUrl} alt="" width={16} height={16} unoptimized className="h-4 w-4 rounded object-contain" />
            : <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10" /></svg>
          }
        </span>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { setTimeout(() => setOpen(false), 150); onBlur(); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent py-3.5 pl-2 pr-3 text-sm text-ink outline-none placeholder:text-ink-soft/50 disabled:opacity-40"
          autoFocus
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-hairline bg-background shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <button key={s.domain} type="button" onMouseDown={() => { onSelect(s.domain); setSuggestions([]); setOpen(false); }}
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
});

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

interface CrawlSignals {
  htmlLang: string | null;
  hreflangs: string[];
  hasCanonical: boolean;
  isHttps: boolean;
  wwwRedirect: boolean;
  robotsDisallowAll: boolean;
  robotsDisallowCount: number;
  detectedMarket: { code: string; label: string } | null;
}

interface DetectResult {
  techStack: DetectedTech[];
  positioning: string | null;
  sitemapCount: number;
  pageData: { title: string; h1: string; metaDesc: string } | null;
  crawlSignals: CrawlSignals | null;
}

const LANG_LABELS: Record<string, string> = { fr: "Français", en: "Anglais", de: "Allemand", es: "Espagnol", it: "Italien", nl: "Néerlandais", pt: "Portugais" };

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
  const [competitorsFetched, setCompetitorsFetched] = useState(false);
  const [keywordInsight, setKeywordInsight] = useState<OnboardingKeywordInsight | null>(null);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [marketCode, setMarketCode] = useState<string>("");
  const [writingLang, setWritingLang] = useState<string>("");
  const competitorInputRef = useRef<HTMLInputElement>(null);

  // Progressive reveal after detection
  useEffect(() => {
    if (!detectResult) return;
    setRevealStep(1);
    const t1 = setTimeout(() => setRevealStep(2), 600);
    const t2 = setTimeout(() => setRevealStep(3), 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [detectResult]);

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
      setMarketCode(data.crawlSignals?.detectedMarket?.code ?? "");
      setWritingLang(data.crawlSignals?.htmlLang ?? "fr");

      // Fetch competitor suggestions in background immediately
      setSuggestedCompetitors([]);
      setCompetitorsFetched(false);
      setLoadingCompetitors(true);
      const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
      fetch("/api/onboarding/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          country: data.crawlSignals?.detectedMarket?.code,
        }),
      })
        .then(r => r.json())
        .then((d: { competitors: string[] }) => setSuggestedCompetitors(d.competitors ?? []))
        .catch(() => {})
        .finally(() => { setLoadingCompetitors(false); setCompetitorsFetched(true); });

      // Mots-clés réels (DataForSEO) en arrière-plan, pour l'étape positionnement — jamais une estimation.
      setKeywordInsight(null);
      setLoadingKeywords(true);
      fetch("/api/onboarding/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      })
        .then(r => r.json())
        .then((d: OnboardingKeywordInsight) => setKeywordInsight(d))
        .catch(() => {})
        .finally(() => setLoadingKeywords(false));
    } catch {
      setDetectError("Impossible d'analyser ce site. Vérifie l'URL et réessaie.");
    } finally {
      setDetecting(false);
    }
  }

  // ── Step 1: Competitors ──────────────────────────────────────────────────────

  function addCompetitorValue(value: string) {
    const raw = value.trim().replace(/^https?:\/\//, "");
    if (!raw || competitors.includes(raw) || competitors.length >= 5) return;
    setCompetitors(prev => [...prev, raw]);
    setCompetitorInput("");
    competitorInputRef.current?.focus();
  }

  function addCompetitor() {
    addCompetitorValue(competitorInput);
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
      await Promise.race([
        fetch("/api/onboarding/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_url: siteUrl,
            competitors,
            tech_stack: detectResult?.techStack ?? [],
            positioning,
            market: marketCode || null,
            preferred_lang: writingLang || "fr",
            onboarding_completed: true,
          }),
        }),
        new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
    } catch {
      // Proceed anyway — profile may have saved partially
    }
    // Full reload so middleware re-reads the new session cookie (onboarding_completed: true)
    window.location.href = "/?welcome=1";
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
                  <DomainInput
                    value={urlInput}
                    onChange={setUrlInput}
                    onSubmit={handleDetect}
                    disabled={detecting}
                  />
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

                      {/* Signaux de crawlabilité — depuis le même fetch, zéro appel supplémentaire */}
                      {detectResult.crawlSignals && (
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { ok: detectResult.crawlSignals.isHttps, label: "HTTPS" },
                            { ok: detectResult.crawlSignals.hasCanonical, label: "Balise canonical" },
                            { ok: !detectResult.crawlSignals.robotsDisallowAll, label: detectResult.crawlSignals.robotsDisallowAll ? "robots.txt bloque tout" : "robots.txt OK" },
                          ].map(({ ok, label }) => (
                            <span key={label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                              <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                {ok ? <polyline points="3 8 6.5 11.5 13 4.5" /> : <path d="M8 4v5M8 11.5v.1" />}
                              </svg>
                              {label}
                            </span>
                          ))}
                          {detectResult.crawlSignals.hreflangs.length > 1 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-background px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                              {detectResult.crawlSignals.hreflangs.length} versions linguistiques (hreflang)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Marché cible + langue — détectés, modifiables */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60">
                            Marché cible
                            {detectResult.crawlSignals?.detectedMarket && <span className="normal-case font-normal text-ink-soft/50">· détecté</span>}
                          </label>
                          <select
                            value={marketCode}
                            onChange={e => setMarketCode(e.target.value)}
                            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                          >
                            <option value="">Non précisé</option>
                            {Object.entries({ fr: "France", be: "Belgique", ch: "Suisse", ca: "Canada", uk: "Royaume-Uni", de: "Allemagne", es: "Espagne", it: "Italie", us: "États-Unis" }).map(([code, label]) => (
                              <option key={code} value={code}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60">
                            Langue
                            {detectResult.crawlSignals?.htmlLang && <span className="normal-case font-normal text-ink-soft/50">· détectée</span>}
                          </label>
                          <select
                            value={writingLang}
                            onChange={e => setWritingLang(e.target.value)}
                            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                          >
                            {Object.entries(LANG_LABELS).map(([code, label]) => (
                              <option key={code} value={code}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

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

              {/* Liste unifiée : suggestions IA + concurrents ajoutés manuellement, mêmes pastilles */}
              {(loadingCompetitors || competitorsFetched || competitors.length > 0) && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60 flex items-center gap-1.5">
                    Concurrents
                    {loadingCompetitors && <Spinner />}
                  </p>
                  {loadingCompetitors && suggestedCompetitors.length === 0 && (
                    <p className="text-xs text-ink-soft/50">Analyse du marché en cours…</p>
                  )}
                  {(() => {
                    const manual = competitors.filter(c => !suggestedCompetitors.includes(c));
                    const allChips = [...suggestedCompetitors, ...manual];
                    if (allChips.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2">
                        {allChips.map(c => {
                          const added = competitors.includes(c);
                          const isManual = manual.includes(c);
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
                              <Image src={`https://www.google.com/s2/favicons?domain=${c}&sz=32`} alt="" width={14} height={14} unoptimized className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                              {added && (
                                <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 8 6.5 11.5 13 4.5" />
                                </svg>
                              )}
                              {c}
                              {added && isManual && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => { e.stopPropagation(); removeCompetitor(c); }}
                                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); removeCompetitor(c); } }}
                                  className="text-brand/60 hover:text-brand transition-colors"
                                  aria-label="Supprimer"
                                >
                                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M4 4l8 8M12 4l-8 8" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {competitorsFetched && !loadingCompetitors && suggestedCompetitors.length === 0 && competitors.length === 0 && (
                    <p className="text-xs text-ink-soft/50">Aucune suggestion disponible pour ce marché.</p>
                  )}
                </div>
              )}

              <CompetitorInput
                ref={competitorInputRef}
                value={competitorInput}
                onChange={setCompetitorInput}
                onKeyDown={handleCompetitorKey}
                onBlur={addCompetitor}
                onSelect={addCompetitorValue}
                disabled={competitors.length >= 5}
                placeholder={`Ajouter un concurrent + Entrée${competitors.length >= 5 ? " (max 5)" : ""}`}
              />
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

              {/* Puces factuelles — données déjà récupérées à l'étape 1, aucun nouvel appel */}
              {detectResult && (detectResult.techStack.length > 0 || detectResult.sitemapCount > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {detectResult.sitemapCount > 0 && (
                    <span className="inline-flex items-center rounded-full border border-hairline bg-background px-3 py-1 text-xs text-ink-soft">
                      <span className="font-semibold text-ink tabular-nums mr-1">{detectResult.sitemapCount.toLocaleString("fr-FR")}</span> pages
                    </span>
                  )}
                  {detectResult.techStack.slice(0, 4).map(t => <TechBadge key={t.name} tech={t} />)}
                </div>
              )}

              {/* Mots-clés réels (DataForSEO) — jamais une estimation */}
              {(loadingKeywords || keywordInsight) && (
                <div className="rounded-xl border border-hairline bg-background shadow-sm px-4 py-3 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft/60 flex items-center gap-1.5">
                    Positionnement réel détecté
                    {loadingKeywords && <Spinner />}
                  </p>
                  {loadingKeywords && !keywordInsight && (
                    <p className="text-xs text-ink-soft/50">Recherche de données de positionnement réelles…</p>
                  )}
                  {keywordInsight && !keywordInsight.hasHistory && (
                    <p className="text-xs text-ink-soft/60">Aucun historique de positionnement trouvé pour ce domaine — normal pour un site récent ou peu indexé. Rien n&apos;est estimé à la place.</p>
                  )}
                  {keywordInsight && keywordInsight.hasHistory && (
                    <>
                      {keywordInsight.topKeywords.length > 0 && (
                        <div className="space-y-1.5">
                          {keywordInsight.topKeywords.map(k => (
                            <div key={k.keyword} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-ink font-medium truncate">{k.keyword}</span>
                              <span className="text-ink-soft shrink-0">pos. {k.position} · {k.volume.toLocaleString("fr-FR")}/mois</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {keywordInsight.suggestedTopic && (
                        <div className="border-t border-hairline pt-2.5 text-xs text-ink-soft">
                          <span className="font-semibold text-ink">Thématique à travailler : </span>
                          développer la sémantique autour de « {keywordInsight.suggestedTopic.keyword} » (position {keywordInsight.suggestedTopic.position}, {keywordInsight.suggestedTopic.volume.toLocaleString("fr-FR")} recherches/mois) — un bon potentiel de gain visible à court terme.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

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
