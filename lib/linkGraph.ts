import * as cheerio from "cheerio";
import { assertSafeUrl } from "./safeUrl";

export interface InternalLink {
  fromPage: string;
  toPage: string;
  anchorText: string;
}

export interface PageSignal {
  url: string;
  title: string;
  h1: string;
  metaDescription: string;
  wordCount: number;
  h2s: string[];
  schemaTypes: string[];
}

export interface LinkGraphResult {
  links: InternalLink[];
  pageSignals: PageSignal[];
}

function normalizeUrl(u: string): string {
  return u.split("#")[0]!.replace(/\/$/, "");
}

function extractSchemaTypes(html: string): string[] {
  const types: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]!);
      const extract = (o: unknown): void => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) { o.forEach(extract); return; }
        const rec = o as Record<string, unknown>;
        if (rec["@type"]) {
          const t = rec["@type"];
          if (Array.isArray(t)) t.forEach(v => typeof v === "string" && types.push(v));
          else if (typeof t === "string") types.push(t);
        }
        Object.values(rec).forEach(extract);
      };
      extract(obj);
    } catch { /* JSON-LD malformé, ignoré */ }
  }
  return [...new Set(types)];
}

interface PageData {
  links: InternalLink[];
  signal: PageSignal;
}

async function fetchPageData(pageUrl: string, knownPages: Set<string>): Promise<PageData> {
  const emptySignal: PageSignal = { url: pageUrl, title: "", h1: "", metaDescription: "", wordCount: 0, h2s: [], schemaTypes: [] };

  try {
    const safe = await assertSafeUrl(pageUrl);
    if (!safe.ok || !safe.url) return { links: [], signal: emptySignal };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(safe.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)" },
    });
    clearTimeout(t);
    if (!res.ok) return { links: [], signal: emptySignal };

    const html = await res.text();
    const $ = cheerio.load(html);
    const fromNormalized = normalizeUrl(pageUrl);

    // Liens internes vers les pages connues du cluster
    const links: InternalLink[] = [];
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const target = normalizeUrl(new URL(href, pageUrl).toString());
        if (target === fromNormalized || !knownPages.has(target)) return;
        const anchorText = $(el).text().trim().replace(/\s+/g, " ").slice(0, 80) || "(ancre vide ou image)";
        links.push({ fromPage: pageUrl, toPage: target, anchorText });
      } catch { /* href invalide */ }
    });

    // Signaux éditoriaux
    $("script, style, nav, header, footer, [role='navigation'], .menu, .sidebar").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const wordCount = bodyText.split(" ").filter(Boolean).length;

    const signal: PageSignal = {
      url: pageUrl,
      title: $("title").first().text().trim().slice(0, 120),
      h1: $("h1").first().text().trim().slice(0, 120),
      metaDescription: ($("meta[name='description']").attr("content") || "").trim().slice(0, 200),
      wordCount,
      h2s: $("h2").map((_, el) => $(el).text().trim().slice(0, 80)).get().slice(0, 6),
      schemaTypes: extractSchemaTypes(html),
    };

    return { links, signal };
  } catch {
    return { links: [], signal: emptySignal };
  }
}

/**
 * Construit le graphe de liens internes RÉELS (avec ancres) entre un ensemble
 * de pages données, en crawlant chacune d'elles. Ne détecte que les liens
 * ENTRE pages de cet ensemble — pas un audit exhaustif du maillage du site.
 */
export async function buildInternalLinkGraph(pageUrls: string[], maxPages = 20): Promise<InternalLink[]> {
  const uniquePages = [...new Set(pageUrls.map(normalizeUrl))].slice(0, maxPages);
  if (uniquePages.length === 0) return [];
  const knownPages = new Set(uniquePages);
  const results = await Promise.all(uniquePages.map(p => fetchPageData(p, knownPages)));
  return results.flatMap(r => r.links);
}

/**
 * Comme buildInternalLinkGraph, mais retourne en plus les signaux éditoriaux
 * de chaque page (title, H1, meta description, word count, H2s, schema types)
 * extraits dans le même fetch — aucun appel réseau supplémentaire.
 */
export async function buildLinkGraphWithSignals(pageUrls: string[], maxPages = 20): Promise<LinkGraphResult> {
  const uniquePages = [...new Set(pageUrls.map(normalizeUrl))].slice(0, maxPages);
  if (uniquePages.length === 0) return { links: [], pageSignals: [] };
  const knownPages = new Set(uniquePages);
  const results = await Promise.all(uniquePages.map(p => fetchPageData(p, knownPages)));
  return {
    links: results.flatMap(r => r.links),
    pageSignals: results.map(r => r.signal),
  };
}
