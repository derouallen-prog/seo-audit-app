"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

interface ClearbitSuggestion { name: string; domain: string; logo: string }

function DomainInput({
  value, onChange, onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
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

const POINTS = [
  {
    title: "Comprendre, pas juste scorer",
    body: "Chaque recommandation est expliquée : pourquoi ce point compte pour ton référencement, et comment le corriger.",
  },
  {
    title: "SEO et GEO réunis",
    body: "Search Mind suit ta visibilité dans Google comme dans les réponses des IA (ChatGPT, Perplexity, Gemini) — deux fronts, un seul tableau de bord.",
  },
  {
    title: "Basé sur de vraies données",
    body: "Positions, volumes de recherche et concurrents réels via Search Console et DataForSEO. Jamais d'estimation inventée.",
  },
];

export default function CommencerPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const raw = url.trim();
    if (!raw || !hasTLD(raw)) {
      setError("Indique un domaine valide (ex : monsite.fr).");
      return;
    }
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    router.push(`/onboarding?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* ─── Gauche : entrée dans l'onboarding ─────────────────────────────── */}
      <div className="flex items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl text-ink mb-1.5">Parlons de ton site</h1>
          <p className="mb-8 text-sm text-ink-soft">
            Lance une première analyse gratuite — sans créer de compte. Tu pourras garder le résultat à la fin si tu le souhaites.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <DomainInput
              value={url}
              onChange={v => { setUrl(v); setError(""); }}
              onSubmit={() => handleSubmit()}
            />
            {error && <p className="text-xs text-warning">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90"
            >
              Analyser mon site →
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-soft">
            Déjà un compte ? <Link href="/auth" className="font-medium text-brand hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>

      {/* ─── Droite : ce qu'est Search Mind ─────────────────────────────────── */}
      <div className="hidden flex-col justify-center bg-ink px-10 py-16 text-white lg:flex xl:px-16">
        <div className="max-w-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/50">L&apos;observatoire SEO/GEO</p>
          <h2 className="font-display text-3xl leading-tight mb-4">
            Un vrai assistant SEO/GEO, pas un simple scanner.
          </h2>
          <p className="text-sm text-white/70 mb-10">
            Search Mind ne se contente pas de lister des problèmes : il t&apos;aide à progresser, à apprendre les bons réflexes et à agir efficacement sur ton référencement — moteurs classiques et IA conversationnelles.
          </p>

          <div className="space-y-6">
            {POINTS.map(p => (
              <div key={p.title} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/20 text-brand">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{p.title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
