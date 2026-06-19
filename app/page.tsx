"use client";

import React, { useState } from "react";
import { z } from "zod";
import type { Analysis } from "@/lib/types";
import TagsGenerator from "@/app/components/TagsGenerator";
import KeywordsResearch from "@/app/components/KeywordsResearch";
import GscConnect from "@/app/components/GscConnect";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-black mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`py-2.5 px-3 font-semibold text-xs uppercase tracking-wide ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`py-2 px-3 text-gray-800 ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
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
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-black mb-4">Analysez votre site</h2>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && isValidUrl && !loading && onAnalyze()}
            placeholder="https://www.exemple.com"
            className="text-black placeholder:text-gray-400 bg-white flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
          />
          <button
            onClick={onAnalyze}
            disabled={loading || !isValidUrl}
            className="rounded-lg bg-brand hover:bg-brand-dark text-white px-4 py-2 font-medium transition disabled:opacity-50"
          >
            {loading ? "Analyse…" : "Analyser"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <GscConnect />

      {data && (
        <div className="space-y-6">

          {/* Résumé technique */}
          <Section title="Résumé technique">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-gray-500">Statut HTTP</span><span className="ml-2 font-medium text-black">{data.status} {data.statusText}</span></div>
              <div><span className="text-gray-500">Temps de réponse</span><span className="ml-2 font-medium text-black">{data.responseTimeMs} ms</span></div>
              <div><span className="text-gray-500">Taille HTML</span><span className="ml-2 font-medium text-black">{(data.htmlSize / 1024).toFixed(1)} Ko</span></div>
              <div><span className="text-gray-500">Canonical</span><span className="ml-2 font-medium text-black">{data.canonical || "—"}</span></div>
              <div><span className="text-gray-500">Robots meta</span><span className="ml-2 font-medium text-black">{data.robotsMeta || "—"}</span></div>
              <div><span className="text-gray-500">Sitemap (link)</span><span className="ml-2 font-medium text-black">{data.sitemapHref || "—"}</span></div>
            </div>
          </Section>

          {/* Balises SEO */}
          <Section title="Balises SEO">
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Title ({data.title?.length ?? 0} car.)</span>
                <span className="font-medium text-black">{data.title || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Meta description ({data.description?.length ?? 0} car.)</span>
                <span className="font-medium text-black">{data.description || "—"}</span>
              </div>
              <div className="flex flex-wrap gap-4">
                <div><span className="text-gray-500">H1</span><span className="ml-2 font-medium text-black">{data.h1Count}</span></div>
                <div><span className="text-gray-500">H2</span><span className="ml-2 font-medium text-black">{data.headings.h2}</span></div>
                <div><span className="text-gray-500">H3</span><span className="ml-2 font-medium text-black">{data.headings.h3}</span></div>
                <div><span className="text-gray-500">H4</span><span className="ml-2 font-medium text-black">{data.headings.h4}</span></div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div><span className="text-gray-500">Liens internes</span><span className="ml-2 font-medium text-black">{data.internalLinks}</span></div>
                <div><span className="text-gray-500">Liens externes</span><span className="ml-2 font-medium text-black">{data.externalLinks}</span></div>
                <div><span className="text-gray-500">Images sans alt</span><span className="ml-2 font-medium text-black">{data.imagesMissingAlt}</span></div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Badge ok={data.jsonLdDetected} label="JSON-LD" />
                <Badge ok={!!data.canonical} label="Canonical" />
                <Badge ok={!!data.robotsMeta} label="Robots meta" />
                <Badge ok={!!data.sitemapHref} label="Sitemap link" />
              </div>
            </div>
          </Section>

          {/* Robots.txt & Sitemap */}
          <Section title="Robots.txt & Sitemap">
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <h4 className="font-semibold text-black mb-2">robots.txt</h4>
                {data.robotsTxt ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge ok={data.robotsTxt.found} label={data.robotsTxt.found ? "Trouvé" : "Absent"} />
                      {data.robotsTxt.found && <Badge ok={!data.robotsTxt.blocksGooglebot} label={data.robotsTxt.blocksGooglebot ? "Bloque Googlebot ⚠️" : "Googlebot autorisé"} />}
                    </div>
                    {data.robotsTxt.found && (
                      <>
                        <div><span className="text-gray-500">Sitemaps référencés</span><span className="ml-2 font-medium text-black">{data.robotsTxt.sitemapUrls.length}</span></div>
                        {data.robotsTxt.crawlDelay !== null && (
                          <div><span className="text-gray-500">Crawl-delay</span><span className="ml-2 font-medium text-black">{data.robotsTxt.crawlDelay}s</span></div>
                        )}
                        {data.robotsTxt.disallowedPaths.length > 0 && (
                          <div>
                            <span className="text-gray-500 block mb-1">Paths bloqués ({data.robotsTxt.disallowedPaths.length})</span>
                            <ul className="text-xs text-gray-500 space-y-0.5 max-h-24 overflow-y-auto">
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
                <h4 className="font-semibold text-black mb-2">Sitemap XML</h4>
                {data.sitemap ? (
                  <div className="space-y-2">
                    <Badge ok={data.sitemap.found} label={data.sitemap.found ? "Trouvé" : "Absent"} />
                    {data.sitemap.found && (
                      <>
                        <div><span className="text-gray-500">URL</span><span className="ml-2 break-all text-xs text-black">{data.sitemap.url}</span></div>
                        <div><span className="text-gray-500">Entrées</span><span className="ml-2 font-medium text-black">{data.sitemap.urlCount ?? "—"}</span></div>
                        {data.sitemap.isIndex && <Badge ok={true} label="Sitemap Index" />}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Non analysé</p>
                )}
              </div>
            </div>
          </Section>

          {/* OpenGraph & Twitter */}
          <Section title="Réseaux sociaux">
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <h4 className="font-semibold text-black mb-2">OpenGraph</h4>
                <div className="space-y-1">
                  <div><span className="text-gray-500">og:title</span><span className="ml-2 text-black">{data.openGraph.title || "—"}</span></div>
                  <div><span className="text-gray-500">og:description</span><span className="ml-2 text-black">{data.openGraph.description || "—"}</span></div>
                  <div><span className="text-gray-500">og:image</span><span className="ml-2 break-all text-black">{data.openGraph.image || "—"}</span></div>
                  <div><span className="text-gray-500">og:type</span><span className="ml-2 text-black">{data.openGraph.type || "—"}</span></div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Badge ok={!!data.openGraph.title} label="og:title" />
                  <Badge ok={!!data.openGraph.image} label="og:image" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-black mb-2">Twitter Card</h4>
                <div className="space-y-1">
                  <div><span className="text-gray-500">twitter:card</span><span className="ml-2 text-black">{data.twitterCard.card || "—"}</span></div>
                  <div><span className="text-gray-500">twitter:title</span><span className="ml-2 text-black">{data.twitterCard.title || "—"}</span></div>
                  <div><span className="text-gray-500">twitter:image</span><span className="ml-2 break-all text-black">{data.twitterCard.image || "—"}</span></div>
                </div>
                <div className="mt-2">
                  <Badge ok={!!data.twitterCard.card} label="Twitter Card" />
                </div>
              </div>
            </div>
          </Section>

          {/* Sécurité HTTP */}
          <Section title="Sécurité HTTP">
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
          </Section>

          {/* PageSpeed */}
          {data.pagespeed && (
            <Section title="Performance (PageSpeed)">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="text-gray-500">Score perf.</span><span className="ml-2 font-medium text-black">{data.pagespeed.performanceScore ?? "—"} / 100</span></div>
                <div><span className="text-gray-500">FCP</span><span className="ml-2 font-medium text-black">{data.pagespeed.metrics?.fcpMs ? `${Math.round(data.pagespeed.metrics.fcpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">LCP</span><span className="ml-2 font-medium text-black">{data.pagespeed.metrics?.lcpMs ? `${Math.round(data.pagespeed.metrics.lcpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">INP</span><span className="ml-2 font-medium text-black">{data.pagespeed.metrics?.inpMs ? `${Math.round(data.pagespeed.metrics.inpMs)} ms` : "—"}</span></div>
                <div><span className="text-gray-500">CLS</span><span className="ml-2 font-medium text-black">{typeof data.pagespeed.metrics?.cls === "number" ? data.pagespeed.metrics.cls.toFixed(3) : "—"}</span></div>
              </div>
            </Section>
          )}

          {/* Mots-clés Semrush */}
          {data.keywords && data.keywords.keywords.length > 0 && (
            <Section title={`Mots-clés positionnés (${data.keywords.keywords.length}) — base ${data.keywords.database.toUpperCase()}`}>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand text-white">
                      <Th>Mot-clé</Th>
                      <Th right>Pos.</Th>
                      <Th right>Volume</Th>
                      <Th>URL</Th>
                      <Th right>Trafic %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.keywords.map((kw, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                        <Td className="font-medium">{kw.keyword}</Td>
                        <Td right className="font-medium">{kw.position}</Td>
                        <Td right>{kw.searchVolume.toLocaleString("fr-FR")}</Td>
                        <Td className="break-all text-xs text-gray-500">{kw.url || "—"}</Td>
                        <Td right>{kw.traffic.toFixed(2)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Top pages domaine */}
          {data.domainTopPages && data.domainTopPages.pages.length > 0 && (
            <Section title={`Top pages organiques du domaine — base ${data.domainTopPages.database.toUpperCase()}`}>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand text-white">
                      <Th>URL</Th>
                      <Th right>Mots-clés</Th>
                      <Th right>Trafic</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.domainTopPages.pages.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                        <Td className="break-all text-xs">{p.url}</Td>
                        <Td right>{p.keywords.toLocaleString("fr-FR")}</Td>
                        <Td right>{p.traffic.toLocaleString("fr-FR")}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Backlinks */}
          {data.backlinks && (
            <Section title="Backlinks">
              <div className="grid gap-3 text-sm sm:grid-cols-4 mb-6">
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Authority Score</span>
                  <span className="font-bold text-xl text-brand">{data.backlinks.overview.authorityScore ?? "—"}</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Backlinks</span>
                  <span className="font-bold text-xl text-brand">{data.backlinks.overview.total.toLocaleString("fr-FR")}</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Domaines référents</span>
                  <span className="font-bold text-xl text-brand">{data.backlinks.overview.referringDomains.toLocaleString("fr-FR")}</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">IPs référentes</span>
                  <span className="font-bold text-xl text-brand">{data.backlinks.overview.referringIps.toLocaleString("fr-FR")}</span>
                </div>
              </div>
              {data.backlinks.topReferringDomains.length > 0 && (
                <>
                  <h4 className="font-semibold text-black mb-2 text-sm">Top domaines référents</h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-brand text-white">
                          <Th>Domaine</Th>
                          <Th right>AS</Th>
                          <Th right>Backlinks</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.backlinks.topReferringDomains.map((d, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                            <Td className="font-medium">{d.domain}</Td>
                            <Td right>{d.authorityScore ?? "—"}</Td>
                            <Td right>{d.backlinksCount.toLocaleString("fr-FR")}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>
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
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-black mb-3">Recommandations ({data.recommendations.length})</h3>
              <ul className="list-disc pl-5 text-sm space-y-1.5 text-gray-800">
                {data.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-brand p-6 text-white shadow-sm">
              <h4 className="text-lg font-bold mb-3">Recevoir un audit complet</h4>
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
                <input name="email" required type="email" placeholder="Email pro" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                <input name="company" required placeholder="Société" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                <textarea name="note" placeholder="Besoin / contexte (optionnel)" className="rounded-lg border border-white/30 bg-white px-3 py-2 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white" />
                <button className="rounded-lg bg-black text-white px-4 py-2 font-medium hover:bg-gray-900 transition">Améliorer ma stratégie SEO</button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
