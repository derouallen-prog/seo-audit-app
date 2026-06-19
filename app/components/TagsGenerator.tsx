"use client";

import { useState, useEffect } from "react";

interface TagsResult {
  title_axe_a: string;
  title_axe_a_chars: number;
  title_axe_b: string;
  title_axe_b_chars: number;
  meta_axe_a: string;
  meta_axe_a_chars: number;
  meta_axe_b: string;
  meta_axe_b_chars: number;
  mot_cle_detecte: string;
  type_page_detecte: string;
  problemes: string[];
}

interface Props {
  url: string;
  currentTitle?: string;
  currentMeta?: string;
  pageContent?: string;
  initialKeyword?: string;
}

function CharBadge({ count, min, max }: { count: number; min: number; max: number }) {
  const ok = count >= min && count <= max;
  const warn = count > max;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      ok ? "bg-green-100 text-green-800" :
      warn ? "bg-red-100 text-red-800" :
      "bg-yellow-100 text-yellow-800"
    }`}>
      {count} car. {ok ? "✓" : warn ? "✗ trop long" : "⚠ trop court"}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs text-gray-500 hover:text-brand transition ml-2"
    >
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

export default function TagsGenerator({ url, currentTitle, currentMeta, pageContent, initialKeyword }: Props) {
  const [keyword, setKeyword] = useState(initialKeyword || "");
  const [pageType, setPageType] = useState("");

  useEffect(() => {
    if (initialKeyword) setKeyword(initialKeyword);
  }, [initialKeyword]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TagsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, currentTitle, currentMeta, pageContent, keyword, pageType }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || "Erreur lors de la génération");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-black">Optimisation Title & Meta</h3>
        <span className="text-xs text-brand bg-brand/10 px-2 py-1 rounded font-medium">IA Claude</span>
      </div>

      {/* Paramètres optionnels */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mot-clé principal (optionnel)</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ex: signature électronique"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Type de page (optionnel)</label>
          <select
            value={pageType}
            onChange={(e) => setPageType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
          >
            <option value="">Détection automatique</option>
            <option value="produit">Page produit</option>
            <option value="blog_guide">Article / Guide</option>
            <option value="cas_usage">Cas d&apos;usage</option>
            <option value="evenement">Événement</option>
            <option value="contact_conversion">Contact / Conversion</option>
            <option value="legal">Page légale</option>
          </select>
        </div>
      </div>

      {/* Balises actuelles */}
      {(currentTitle || currentMeta) && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2 text-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Balises actuelles</p>
          {currentTitle && (
            <div>
              <span className="text-gray-500">Title ({currentTitle.length} car.) </span>
              <span className={currentTitle.length > 60 ? "text-red-600" : "text-black"}>{currentTitle}</span>
            </div>
          )}
          {currentMeta && (
            <div>
              <span className="text-gray-500">Meta ({currentMeta.length} car.) </span>
              <span className={currentMeta.length > 160 ? "text-red-600" : "text-black"}>{currentMeta}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="w-full rounded-lg bg-brand hover:bg-brand-dark text-white px-4 py-2.5 font-medium transition disabled:opacity-50"
      >
        {loading ? "Génération en cours…" : "✨ Générer les balises optimisées"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Type détecté : <span className="text-black font-medium">{result.type_page_detecte}</span>
            {result.mot_cle_detecte && <> · Mot-clé : <span className="text-black font-medium">{result.mot_cle_detecte}</span></>}
          </p>

          {/* Axe A */}
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-brand uppercase tracking-wide">Axe A — SEO-first</p>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Title</span>
                <CharBadge count={result.title_axe_a_chars || result.title_axe_a.length} min={0} max={60} />
                <CopyButton text={result.title_axe_a} />
              </div>
              <p className="text-sm font-medium text-black">{result.title_axe_a}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Meta</span>
                <CharBadge count={result.meta_axe_a_chars || result.meta_axe_a.length} min={120} max={140} />
                <CopyButton text={result.meta_axe_a} />
              </div>
              <p className="text-sm text-gray-700">{result.meta_axe_a}</p>
            </div>
          </div>

          {/* Axe B */}
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Axe B — Brand-forward</p>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Title</span>
                <CharBadge count={result.title_axe_b_chars || result.title_axe_b.length} min={0} max={60} />
                <CopyButton text={result.title_axe_b} />
              </div>
              <p className="text-sm font-medium text-black">{result.title_axe_b}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">Meta</span>
                <CharBadge count={result.meta_axe_b_chars || result.meta_axe_b.length} min={120} max={140} />
                <CopyButton text={result.meta_axe_b} />
              </div>
              <p className="text-sm text-gray-700">{result.meta_axe_b}</p>
            </div>
          </div>

          {/* Problèmes détectés */}
          {result.problemes?.length > 0 && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠️ Problèmes détectés</p>
              <ul className="text-xs text-yellow-800 space-y-0.5">
                {result.problemes.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
