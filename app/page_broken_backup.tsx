"use client";
import { useState } from "react";
import { z } from "zod";

const schema = z.string().url();

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAnalyze() {
    setError(null);
    const parsed = schema.safeParse(url.trim());
    if (!parsed.success) {
      setError("Merci d’entrer une URL valide (https://…).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Erreur API ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Échec de l’analyse.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border p-6">
        <h2 className="text-lg font-medium mb-4">Analysez votre site</h2>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.exemple.com"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-60"
          >
            {loading ? "Analyse…" : "Analyser"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {data && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border p-6">
            <h3 className="font-semibold mb-2">Résumé</h3>
            <ul className="text-sm space-y-1">
              <li><strong>Statut:</strong> {data.status} ({data.statusText})</li>
              <li><strong>Titre:</strong> {data.title || "—"}</li>
              <li><strong>Meta description:</strong> {data.description || "—"}</li>
              <li><strong>H1:</strong> {data.h1Count}</li>
              <li><strong>Liens internes:</strong> {data.internalLinks}</li>
              <li><strong>Liens externes:</strong> {data.externalLinks}</li>
              <li><strong>JSON-LD détecté:</strong> {data.jsonLdDetected ? "Oui" : "Non"}</li>
              <li><strong>Images sans alt:</strong> {data.imagesMissingAlt}</li>
              <li><strong>Taille HTML (octets):</strong> {data.htmlSize}</li>
              <li><strong>Temps de réponse (ms):</strong> {data.responseTimeMs}</li>
              <li><strong>Canonical:</strong> {data.canonical || "—"}</li>
              <li><strong>Robots meta:</strong> {data.robotsMeta || "—"}</li>
              <li><strong>Sitemap link:</strong> {data.sitemapHref || "—"}</li>
            </ul>
          </div>

          <div className="rounded-xl border p-6">
            <h3 className="font-semibold mb-2">Recommandations</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {data.recommendations?.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>

            <hr className="my-4" />
            <h4 className="font-medium mb-2">Recevoir un audit complet</h4>
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                const res = await fetch("/api/lead", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    email: fd.get("email"),
                    company: fd.get("company"),
                    url,
                    note: fd.get("note"),
                    website: fd.get("website"), // honeypot
                  }),
                });
                if (res.ok) {
                  alert("Merci ! Nous revenons vers vous rapidement.");
                  (e.currentTarget as HTMLFormElement).reset();
                } else {
                  const j = await res.json().catch(() => ({}));
                  alert(j?.error || "Erreur, merci de réessayer.");
                }
              }}
            >
              {/* Champ caché anti-bot */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
              />
              <input
                name="email"
                required
                type="email"
                placeholder="Email pro"
                className="rounded-lg border px-3 py-2"
              />
              <input
                name="company"
                required
                placeholder="Société"
                className="rounded-lg border px-3 py-2"
              />
              <textarea
                name="note"
                placeholder="Besoin / contexte (optionnel)"
                className="rounded-lg border px-3 py-2"
              />
              <button className="rounded-lg bg-black text-white px-4 py-2">
                Améliorer ma stratégie SEO
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
