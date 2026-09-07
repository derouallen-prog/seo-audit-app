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

    return { title, h1, metaDesc: metaDesc || ogDesc, firstP };
  } catch {
    return null;
  }
}

async function generatePositioning(pageData: {
  title: string;
  h1: string;
  metaDesc: string;
  firstP: string;
  url: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `À partir de ces informations extraites d'un site web, génère UNE SEULE phrase (max 25 mots) décrivant le positionnement de ce site/entreprise. Réponds uniquement avec la phrase, sans ponctuation finale ni guillemets.

URL: ${pageData.url}
Titre: ${pageData.title}
H1: ${pageData.h1}
Meta description: ${pageData.metaDesc}
Premier paragraphe: ${pageData.firstP}`,
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    return text;
  } catch {
    return null;
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

  const [techStack, pageData, sitemapCount] = await Promise.all([
    detectTechStack(normalizedUrl),
    extractHomepageData(normalizedUrl),
    countSitemapUrls(normalizedUrl),
  ]);

  const positioning = pageData
    ? await generatePositioning({ ...pageData, url: normalizedUrl })
    : null;

  return NextResponse.json({
    techStack,
    positioning,
    sitemapCount,
    pageData: pageData ? { title: pageData.title, h1: pageData.h1, metaDesc: pageData.metaDesc } : null,
  });
}
