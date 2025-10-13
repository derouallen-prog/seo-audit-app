import type { Analysis } from "./types";
import { extractBasic } from "./extractors";
import { makeRecommendations } from "./reco";

export async function analyzeUrl(rawUrl: string): Promise<Analysis> {
  const start = Date.now();
  const target = new URL(rawUrl).toString();

  const res = await fetch(target, { redirect: "follow" });
  const end = Date.now();
  const responseTimeMs = end - start;

  const status = res.status;
  const statusText = res.statusText || "";

  const html = await res.text();
  const htmlSize = Buffer.from(html, "utf8").byteLength;

  const basic = extractBasic(html, target);

  const analysis: Analysis = {
    status, statusText,
    title: basic.title,
    description: basic.description,
    canonical: basic.canonical,
    robotsMeta: basic.robotsMeta,
    jsonLdDetected: basic.jsonLdDetected,
    h1Count: basic.h1Count,
    internalLinks: basic.internalLinks,
    externalLinks: basic.externalLinks,
    imagesMissingAlt: basic.imagesMissingAlt,
    htmlSize,
    responseTimeMs,
    sitemapHref: basic.sitemapHref,
    recommendations: []
  };

  analysis.recommendations = makeRecommendations(analysis);

  // Connecteurs optionnels — NE DOIVENT PAS FAIRE ÉCHOUER S’ILS SONT ABSENTS
  // (Placeholders: à implémenter si les clés existent)
  if (process.env.SEMRUSH_API_KEY) {
    // TODO: appeler l’API Semrush (audit/authority/keywords) et enrichir analysis
    // Laisser en no-op si non configuré.
  }
  if (process.env.AHREFS_API_KEY) {
    // TODO: appeler l’API Ahrefs (backlinks/domain rating) et enrichir analysis
  }
  if (process.env.PAGESPEED_API_KEY) {
    // TODO: appeler l’API PageSpeed Insights and enrichir performance
  }

  return analysis;
}
