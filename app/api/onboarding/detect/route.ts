import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { detectTechStack } from "@/lib/techDetect";
import { gunzip } from "zlib";
import { promisify } from "util";

const gunzipAsync = promisify(gunzip);

export const runtime = "nodejs";
export const maxDuration = 45;

// ccTLD → code pays DataForSEO (mêmes clés que lib/dataforseo.ts) + libellé affiché.
// Signal de repli uniquement : .com/.net/etc. ne donnent aucune indication fiable, on ne devine pas.
const TLD_MARKET: Record<string, { code: string; label: string }> = {
  fr: { code: "fr", label: "France" },
  be: { code: "be", label: "Belgique" },
  ch: { code: "ch", label: "Suisse" },
  ca: { code: "ca", label: "Canada" },
  de: { code: "de", label: "Allemagne" },
  es: { code: "es", label: "Espagne" },
  it: { code: "it", label: "Italie" },
  uk: { code: "uk", label: "Royaume-Uni" },
  co: { code: "uk", label: "Royaume-Uni" }, // .co.uk
};

export interface CrawlSignals {
  htmlLang: string | null;
  hreflangs: string[];
  hasCanonical: boolean;
  isHttps: boolean;
  wwwRedirect: boolean; // true si www./non-www redirige proprement vers une seule version canonique
  robotsDisallowAll: boolean;
  robotsDisallowCount: number;
  detectedMarket: { code: string; label: string } | null;
}

async function checkRobotsTxt(base: string): Promise<{ disallowAll: boolean; disallowCount: number }> {
  try {
    const res = await fetch(`${base}/robots.txt`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { disallowAll: false, disallowCount: 0 };
    const text = await res.text();
    const disallowLines = text.match(/^Disallow:\s*(.*)$/gim) ?? [];
    const disallowAll = disallowLines.some(l => l.replace(/^Disallow:\s*/i, "").trim() === "/");
    return { disallowAll, disallowCount: disallowLines.filter(l => l.replace(/^Disallow:\s*/i, "").trim() !== "").length };
  } catch {
    return { disallowAll: false, disallowCount: 0 };
  }
}

function detectMarketFromTld(hostname: string): { code: string; label: string } | null {
  const parts = hostname.toLowerCase().split(".");
  const last = parts[parts.length - 1] ?? "";
  const secondToLast = parts[parts.length - 2] ?? "";
  // .co.uk — vérifie la combinaison avant le simple dernier segment
  if (secondToLast === "co" && last === "uk") return TLD_MARKET.co ?? null;
  return TLD_MARKET[last] ?? null;
}

async function extractHomepageData(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const h1 = $("h1").first().text().trim();
    const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const ogDesc = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
    const firstP = $("p").first().text().trim().slice(0, 300);

    const htmlLang = $("html").attr("lang")?.trim().toLowerCase().slice(0, 2) || null;
    const hreflangs = [...new Set(
      $('link[rel="alternate"][hreflang]')
        .map((_, el) => $(el).attr("hreflang")?.trim().toLowerCase())
        .get()
        .filter((h): h is string => !!h && h !== "x-default")
    )];
    const hasCanonical = $('link[rel="canonical"]').length > 0;
    const isHttps = res.url.startsWith("https://");
    // redirected=true ET l'URL finale ne correspond plus exactement à ce qui a été demandé
    // (http→https, ajout/retrait de www) = une seule version canonique existe bien, c'est le signal positif.
    const wwwRedirect = res.redirected && res.url !== url;

    return { title, h1, metaDesc: metaDesc || ogDesc, firstP, htmlLang, hreflangs, hasCanonical, isHttps, wwwRedirect };
  } catch {
    return null;
  }
}

// Repli déterministe (pas d'IA) si l'appel échoue — le champ ne doit jamais rester vide
// silencieusement à cause d'une erreur réseau/API passagère : mieux vaut une phrase minimale
// que l'utilisateur peut corriger plutôt qu'un champ qui a l'air cassé.
function fallbackPositioning(pageData: { title: string; h1: string }): string | null {
  const base = pageData.h1 || pageData.title;
  return base ? base.slice(0, 120) : null;
}

async function generatePositioning(pageData: {
  title: string;
  h1: string;
  metaDesc: string;
  firstP: string;
  url: string;
}, market: { code: string; label: string } | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackPositioning(pageData);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `À partir de ces informations extraites d'un site web, génère UNE SEULE phrase (max 25 mots) décrivant le positionnement de ce site/entreprise. Tiens compte du marché cible s'il est fourni, sans l'inventer s'il est absent. Réponds uniquement avec la phrase, sans ponctuation finale ni guillemets.

URL: ${pageData.url}
Titre: ${pageData.title}
H1: ${pageData.h1}
Meta description: ${pageData.metaDesc}
Premier paragraphe: ${pageData.firstP}
Marché cible détecté: ${market ? market.label : "non détecté"}`,
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    return text || fallbackPositioning(pageData);
  } catch (e) {
    console.error("[onboarding/detect] generatePositioning failed:", e);
    return fallbackPositioning(pageData);
  }
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" };
const MAX_SITEMAPS = 20;   // max sub-sitemaps to follow
const MAX_PAGES   = 50_000; // stop counting above this

async function fetchXml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: UA, redirect: "follow" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const isGzip =
      ct.includes("application/x-gzip") ||
      ct.includes("application/gzip") ||
      ct.includes("application/octet-stream") ||
      url.endsWith(".gz");

    if (isGzip) {
      const buf = Buffer.from(await res.arrayBuffer());
      try {
        const decompressed = await gunzipAsync(buf);
        return decompressed.toString("utf-8");
      } catch {
        return null;
      }
    }

    return await res.text();
  } catch {
    return null;
  }
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function extractSitemapLocs(xml: string): string[] {
  const matches = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) ?? [];
  return matches.map(block => {
    const m = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i);
    return m?.[1] ?? "";
  }).filter(Boolean);
}

function countUrlLocs(xml: string): number {
  return (xml.match(/<url>[\s\S]*?<\/url>/gi) ?? []).length;
}

async function discoverSitemapUrls(base: string): Promise<string[]> {
  const candidates: string[] = [];

  // 1. Check robots.txt for Sitemap: directives
  const robotsTxt = await fetchXml(`${base}/robots.txt`, 5000);
  if (robotsTxt) {
    const sitelines = robotsTxt.match(/^Sitemap:\s*(.+)$/gim) ?? [];
    for (const line of sitelines) {
      const url = line.replace(/^Sitemap:\s*/i, "").trim();
      if (url) candidates.push(url);
    }
  }

  // 2. Parse homepage <link rel="sitemap"> and <a href="*sitemap*"> hints
  try {
    const homepageRes = await fetch(base, {
      signal: AbortSignal.timeout(8000),
      headers: UA,
      redirect: "follow",
    });
    if (homepageRes.ok) {
      const html = await homepageRes.text();
      // <link rel="sitemap" type="application/xml" href="...">
      const linkMatches = html.matchAll(/<link[^>]+rel=["']sitemap["'][^>]*href=["']([^"']+)["']/gi);
      for (const m of linkMatches) {
        const href = m[1] ?? "";
        if (href) candidates.push(href.startsWith("http") ? href : `${base}/${href.replace(/^\//, "")}`);
      }
      // also scan any <a> whose href contains "sitemap" (useful for some CMS)
      const aMatches = html.matchAll(/href=["']([^"']*sitemap[^"']*\.xml[^"']*?)["']/gi);
      for (const m of aMatches) {
        const href = m[1] ?? "";
        if (href.length < 200) {
          candidates.push(href.startsWith("http") ? href : `${base}/${href.replace(/^\//, "")}`);
        }
      }
    }
  } catch { /* ignore */ }

  // 3. Common standard + CMS-specific paths (tried only if nothing found yet)
  const COMMON_PATHS = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap/sitemap.xml",
    // PrestaShop — index lists subs like 1_fr_0_sitemap.xml
    "/index.php?controller=SitemapAjax",
    // WordPress + Yoast
    "/wp-sitemap.xml",
    "/sitemap_index.xml",
    // Shopify
    "/sitemap.xml",
    // Magento
    "/sitemap/",
  ];
  for (const p of COMMON_PATHS) {
    candidates.push(`${base}${p}`);
  }

  return [...new Set(candidates)];
}

function resolveUrl(href: string, base: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return base + href;
  return base + "/" + href;
}

async function countSitemapUrls(siteUrl: string): Promise<number> {
  const base = siteUrl.replace(/\/$/, "");
  const roots = await discoverSitemapUrls(base);

  const visited = new Set<string>();
  const queue: string[] = [...roots];
  let total = 0;

  while (queue.length > 0 && visited.size < MAX_SITEMAPS && total < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const xml = await fetchXml(url);
    if (!xml) continue;

    if (isSitemapIndex(xml)) {
      const children = extractSitemapLocs(xml).map(loc => resolveUrl(loc, base));
      for (const child of children) {
        if (!visited.has(child)) queue.push(child);
      }
    } else {
      total += countUrlLocs(xml);
    }
  }

  return Math.min(total, MAX_PAGES);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ error: "URL requise" }, { status: 400 });

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const base = normalizedUrl.replace(/\/$/, "");

  const [techStack, pageData, sitemapCount, robots] = await Promise.all([
    detectTechStack(normalizedUrl),
    extractHomepageData(normalizedUrl),
    countSitemapUrls(normalizedUrl),
    checkRobotsTxt(base),
  ]);

  const hostname = (() => { try { return new URL(normalizedUrl).hostname; } catch { return ""; } })();
  const detectedMarket = detectMarketFromTld(hostname);

  const positioning = pageData
    ? await generatePositioning({ ...pageData, url: normalizedUrl }, detectedMarket)
    : null;

  const crawlSignals: CrawlSignals = {
    htmlLang: pageData?.htmlLang ?? null,
    hreflangs: pageData?.hreflangs ?? [],
    hasCanonical: pageData?.hasCanonical ?? false,
    isHttps: pageData?.isHttps ?? normalizedUrl.startsWith("https://"),
    wwwRedirect: pageData?.wwwRedirect ?? false,
    robotsDisallowAll: robots.disallowAll,
    robotsDisallowCount: robots.disallowCount,
    detectedMarket,
  };

  return NextResponse.json({
    techStack,
    positioning,
    sitemapCount,
    pageData: pageData ? { title: pageData.title, h1: pageData.h1, metaDesc: pageData.metaDesc } : null,
    crawlSignals,
  });
}
