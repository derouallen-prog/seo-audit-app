"use client";

import React, { useState } from "react";
import { z } from "zod";
import type { Analysis } from "@/lib/types";
import TagsGenerator from "@/app/components/TagsGenerator";
import KeywordsResearch from "@/app/components/KeywordsResearch";

const schema = z.string().url();

function ensureProtocol(u: string): string {
  if (!u) return u;
  return /^(https?:)?\/\//i.test(u) ? u : `https://${u}`;
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | undefined>(undefined);

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
    try {
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        let message = `Erreur API ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) message = j.error;
        } catch {}
        setError(message);
        return;
      }
      const json = (await res.json()) as Analysis;
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'analyse.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Formulaire */}
      <section className="rounded-xl border p-6">
        <h2 className="text-lg font-medium mb-4">Analysez votre site</h2>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isValidUrl && !loading && onAnalyze()}
            placeholder="https://www.exemple.com"
            className="text-white placeholder:text-gray-400 bg-neutral-900 flex-1 rounded-lg border border-gray-700 px-3 py-2"
          />
          <button
            onClick={onAnalyze}
            disabled={loading || !isValidUrl}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-60"
          >
            {loading ? "Analyse…" : "Analyser"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      {data && (
        <div className="space-y-6">

          {/* Résumé technique */}
          <section className="rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Résumé technique</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-gray-500">Statut HTTP</span><span className="ml-2 font-medium">{data.status} {data.statusText}</span></div>
              <div><span className="text-gray-500">Temps de réponse</span><span className="ml-2 font-medium">{data.responseTimeMs} ms</span></div>
              <div><span className="text-gray-500">Taille HTML</span><span className="ml-2 font-medium">{(data.htmlSize / 1024).toFixed(1)} Ko</span></div>
              <div><span className="text-gray-500">Canonical</span><span className="ml-2 font-medium">{data.canonical || "—"}</span></div>
              <div><span className="text-gray-500">Robots meta</span><span className="ml-2 font-medium">{data.robotsMeta || "—"}</span></div>
              <div><span className="text-gray-500">Sitemap (link)</span><span className="ml-2 font-medium">{data.sitemapHref || "—"}</span></div>
            </div>
          </section>

          {/* Balises SEO */}
          <section className="rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Balises SEO</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Title ({data.title?.length ?? 0} car.)</span>
                <span className="font-medium">{data.title || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Meta description ({data.description?.length ?? 0} car.)</span>
                <span className="font-medium">{data.description || "—"}</span>
              </div>
              <div className="flex flex-wrap gap-4">
                <div><span className="text-gray-500">H1</span><span className="ml-2 font-medium">{data.h1Count}</span></div>
                <div><span className="text-gray-500">H2</span><span className="ml-2 font-medium">{data.headings.h2}</span></div>
                <div><span className="text-gray-500">H3</span><span className="ml-2 font-medium">{data.headings.h3}</span></div>
                <div><span className="text-gray-500">H4</span><span className="ml-2 font-medium">{data.headings.h4}</span></div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div><span className="text-gray-500">Liens internes</span><span className="ml-2 font-medium">{data.internalLinks}</span></div>
                <div><span className="text-gray-500">Liens externes</span><span className="ml-2 font-medium">{data.externalLinks}</span></div>
                <div><span className="text-gray-500">Images sans alt</span><span className="ml-2 font-medium">{data.imagesMissingAlt}</span></div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Badge ok={data.jsonLdDetected} label="JSON-LD" />
                <Badge ok={!!data.canonical} label="Canonical" />
                <Badge ok={!!data.robotsMeta} label="Robots meta" />
                <Badge ok={!!data.sitemapHref} label="Sitemap link" />
              </div>
            </div>
          </section>

          {/* Robots.txt & Sitemap */}
          <section className="rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Robots.txt & Sitemap</h3>
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <h4 className="font-medium mb-2">robots.txt</h4>
                {data.robotsTxt ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge ok={data.robotsTxt.found} label={data.robotsTxt.found ? "Trouvé" : "Absent"} />
                      {data.robotsTxt.found && <Badge ok={!data.robotsTxt.blocksGooglebot} label={data.robotsTxt.blocksGooglebot ? "Bloque Googlebot ⚠️" : "Googlebot autorisé"} />}
                    </div>
                    {data.robotsTxt.found && (
                      <>
                        <div><span className="text-gray-500">Sitemaps référencés</span><span className="ml-2 font-medium">{data.robotsTxt.sitemapUrls.length}</span></div>
                        {data.robotsTxt.crawlDelay !== null && (
                          <div><span className="text-gray-500">Crawl-delay</span><span className="ml-2 font-medium">{data.robotsTxt.crawlDelay}s</span></div>
                        )}
                        {data.robotsTxt.disallowedPaths.length > 0 && (
                          <div>
                            <span className="text-gray-500 block mb-1">Paths bloqués ({data.robotsTxt.disallowedPaths.length})</span>
                            <ul className="text-xs text-gray-400 space-y-0.5 max-h-24 overflow-y-auto">
                              {data.robotsTxt.disallowedPaths.slice(0, 10).map((p, i) => <li key={i} className="font-mono">{p}</li>)}
                              {data.robotsTxt.disallowedPaths.length > 10 && <li className="text-gray-500">+{data.robotsTxt.disallowedPaths.length - 10} autres…</li>}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Non analysé</p>
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">Sitemap XML</h4>
                {data.sitemap ? (
                  <div className="space-y-2">
                    <Badge ok={data.sitemap.found} label={data.sitemap.found ? "Trouvé" : "Absent"} />
                    {data.sitemap.found && (
                      <>
                        <div><span className="text-gray-500">URL</span><span className="ml-2 break-all text-xs">{data.sitemap.url}</span></div>
                        <div><span className="text-gray-500">Entrées</span><span className="ml-2 font-medium">{data.sitemap.urlCount ?? "—"}</span></div>
                        {data.sitemap.isIndex && <Badge ok={true} label="Sitemap Index" />}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Non analysé</p>
                )}
              </div>
            </div>
          </section>

          {/* OpenGraph & Twitter */}
          <section className="rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Réseaux sociaux</h3>
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <h4 className="font-medium mb-2">OpenGraph</h4>
                <div className="space-y-1">
                  <div><span className="text-gray-500">og:title</span><span className="ml-2">{data.openGraph.title || "—"}</span></div>
                  <div><span className="text-gray-500">og:description</span><span className="ml-2">{data.openGraph.description || "—"}</span></div>
                  <div><span className="text-gray-500">og:image</span><span className="ml-2 break-all">{data.openGraph.image || "—"}</span></div>
                  <div><span className="text-gray-500">og:type</span><span className="ml-2">{data.openGraph.type || "—"}</span></div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Badge ok={!!data.openGraph.title} label="og:title" />
                  <Badge ok={!!data.openGraph.image} label="og:image" />
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Twitter Card</h4>
                <div className="space-y-1">
                  <div><span className="text-gray-500">twitter:card</span><span className="ml-2">{data.twitterCard.card || "—"}</span></div>
                  <div><span className="text-gray-500">twitter:title</span><span className="ml-2">{data.twitterCard.title || "—"}</span></div>
                  <div><span className="text-gray-500">twitter:image</span><span className="ml-2 break-all">{data.twitterCard.image || "—"}</span></div>
                </div>
                <div className="mt-2">
                  <Badge ok={!!data.twitterCard.card} label="Twitter Card" />
                </div>
              </div>
            </div>
          </section>

          {/* Sécurité HTTP */}
          <section className="rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Sécurité HTTP</h3>
            <div className="flex flex-wrap gap-3">
              <Badge ok={data.security.https} label="HTTPS" />
              <Badge ok={data.security.hsts} label="HSTS" />
              <Badge ok={!!data.security.xFrameOptions} label="X-Frame-Options" />
              <Badge ok={!!data.security.xContentTypeOptions} label="X-Content-Type-Options" />
              <Badge ok={data.security.csp} label="CSP" />
            </div>
            {data.security.xFrameOptions && (
              <p className="mt-2 text-xs text-gray-500">X-Frame-Options: {data.security.xFrameOptions}</p>
            )}
            {data.security.xContentTypeOptions && (
              <p className="text-xs text-gray-500">X-Content-Type-Options: {data.security.xContentTypeOptions}</p>
            )}
          </section>

          {/* PageSpeed */}
          {data.pagespeed && (
            <section className="rounded-xl border p-6">
              <h3 className="font-semibold mb-4">Performance (PageSpeed)</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-gray-500">Score perf.</span><span className="ml-2 font-medium">{data.pagespeed.performanceScore ?? "—"} / 100</span></div>
                <div><span className="text-gray-500">FCP</span><span className="ml-2 font-medium">{data.pagespeed.metrics?.fcpMs ? `${Math.round(data.pagespeed.metrics.fcpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">LCP</span><span className="ml-2 font-medium">{data.pagespeed.metrics?.lcpMs ? `${Math.round(data.pagespeed.metrics.lcpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">INP</span><span className="ml-2 font-medium">{data.pagespeed.metrics?.inpMs ? `${Math.round(data.pagespeed.metrics.inpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">CLS</span><span className="ml-2 font-medium">{typeof data.pagespeed.metrics?.cls === "number" ? data.pagespeed.metrics.cls.toFixed(3) : "—"}</span></div>
              </div>
            </section>
          )}

          {/* Mots-clés Semrush */}
          {data.keywords && data.keywords.keywords.length > 0 && (
            <section className="rounded-xl border p-6">
              <h3 className="font-semibold mb-4">Mots-clés positionnés ({data.keywords.keywords.length}) — base {data.keywords.database.toUpperCase()}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-700">
                      <th className="pb-2 pr-4 font-medium">Mot-clé</th>
                      <th className="pb-2 pr-4 font-medium text-right">Pos.</th>
                      <th className="pb-2 pr-4 font-medium text-right">Volume</th>
                      <th className="pb-2 pr-4 font-medium">URL</th>
                      <th className="pb-2 font-medium text-right">Trafic %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.keywords.map((kw, i) => (
                      <tr key={i} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 pr-4">{kw.keyword}</td>
                        <td className="py-1.5 pr-4 text-right font-medium">{kw.position}</td>
                        <td className="py-1.5 pr-4 text-right">{kw.searchVolume.toLocaleString("fr-FR")}</td>
                        <td className="py-1.5 pr-4 break-all text-xs text-gray-400">{kw.url || "—"}</td>
                        <td className="py-1.5 text-right">{kw.traffic.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Top pages domaine */}
          {data.domainTopPages && data.domainTopPages.pages.length > 0 && (
            <section className="rounded-xl border p-6">
              <h3 className="font-semibold mb-4">Top pages organiques du domaine — base {data.domainTopPages.database.toUpperCase()}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-700">
                      <th className="pb-2 pr-4 font-medium">URL</th>
                      <th className="pb-2 pr-4 font-medium text-right">Mots-clés</th>
                      <th className="pb-2 font-medium text-right">Trafic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.domainTopPages.pages.map((p, i) => (
                      <tr key={i} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 pr-4 break-all text-xs">{p.url}</td>
                        <td className="py-1.5 pr-4 text-right">{p.keywords.toLocaleString("fr-FR")}</td>
                        <td className="py-1.5 text-right">{p.traffic.toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Backlinks */}
          {data.backlinks && (
            <section className="rounded-xl border p-6">
              <h3 className="font-semibold mb-4">Backlinks</h3>
              <div className="grid gap-3 text-sm sm:grid-cols-4 mb-6">
                <div><span className="text-gray-500 block">Authority Score</span><span className="font-medium text-lg">{data.backlinks.overview.authorityScore ?? "—"}</span></div>
                <div><span className="text-gray-500 block">Backlinks</span><span className="font-medium text-lg">{data.backlinks.overview.total.toLocaleString("fr-FR")}</span></div>
                <div><span className="text-gray-500 block">Domaines référents</span><span className="font-medium text-lg">{data.backlinks.overview.referringDomains.toLocaleString("fr-FR")}</span></div>
                <div><span className="text-gray-500 block">IPs référentes</span><span className="font-medium text-lg">{data.backlinks.overview.referringIps.toLocaleString("fr-FR")}</span></div>
              </div>
              {data.backlinks.topReferringDomains.length > 0 && (
                <>
                  <h4 className="font-medium mb-2 text-sm">Top domaines référents</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-700">
                          <th className="pb-2 pr-4 font-medium">Domaine</th>
                          <th className="pb-2 pr-4 font-medium text-right">AS</th>
                          <th className="pb-2 font-medium text-right">Backlinks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.backlinks.topReferringDomains.map((d, i) => (
                          <tr key={i} className="border-b border-gray-800 last:border-0">
                            <td className="py-1.5 pr-4">{d.domain}</td>
                            <td className="py-1.5 pr-4 text-right">{d.authorityScore ?? "—"}</td>
                            <td className="py-1.5 text-right">{d.backlinksCount.toLocaleString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Recherche de mots-clés */}
          <KeywordsResearch
            url={normalized}
            onSelectKeyword={setSelectedKeyword}
          />

          {/* Optimisation Title & Meta */}
          <TagsGenerator
            url={normalized}
            currentTitle={data.title ?? undefined}
            currentMeta={data.description ?? undefined}
            initialKeyword={selectedKeyword}
          />

          {/* Recommandations + Lead */}
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Recommandations ({data.recommendations.length})</h3>
              <ul className="list-disc pl-5 text-sm space-y-1.5">
                {data.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border p-6">
              <h4 className="font-medium mb-3">Recevoir un audit complet</h4>
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
                      body: JSON.stringify({
                        email: fd.get("email"),
                        company: fd.get("company"),
                        url,
                        note: fd.get("note"),
                        website: fd.get("website"),
                      }),
                    });
                    if (res.ok) {
                      alert("Merci ! Nous revenons vers vous rapidement.");
                      form.reset();
                    } else {
                      const j = await res.json().catch(() => ({}));
                      alert(j?.error || "Erreur, merci de réessayer.");
                    }
                  } catch {
                    alert("Erreur réseau, merci de réessayer.");
                  }
                }}
              >
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
                <input name="email" required type="email" placeholder="Email pro" className="rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400" />
                <input name="company" required placeholder="Société" className="rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400" />
                <textarea name="note" placeholder="Besoin / contexte (optionnel)" className="rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-white placeholder:text-gray-400" />
                <button className="rounded-lg bg-black text-white px-4 py-2 hover:bg-gray-800 transition">Améliorer ma stratégie SEO</button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
