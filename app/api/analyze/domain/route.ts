import { NextRequest } from "next/server";
import { analyzeUrl } from "../../../../lib/analyzers";
import { computeScore } from "../../../../lib/score";
import { gunzip } from "zlib";
import { promisify } from "util";

export const runtime = "nodejs";
export const maxDuration = 60;

const gunzipAsync = promisify(gunzip);
const UA = { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" };

// ── Sitemap utilities (mirrors detect route) ─────────────────────────────────

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: UA, redirect: "follow" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const isGzip = ct.includes("gzip") || ct.includes("octet-stream") || url.endsWith(".gz");
    if (isGzip) {
      const buf = Buffer.from(await res.arrayBuffer());
      try { return (await gunzipAsync(buf)).toString("utf-8"); } catch { return null; }
    }
    return await res.text();
  } catch { return null; }
}

function isSitemapIndex(xml: string) { return /<sitemapindex[\s>]/i.test(xml); }

function extractSitemapLocs(xml: string): string[] {
  return (xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) ?? [])
    .map(b => b.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1] ?? "")
    .filter(Boolean);
}

function extractUrlLocs(xml: string): string[] {
  return (xml.match(/<url>[\s\S]*?<\/url>/gi) ?? [])
    .map(b => b.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

function resolveUrl(href: string, base: string) {
  if (href.startsWith("http")) return href;
  return base + (href.startsWith("/") ? href : "/" + href);
}

async function collectUrls(siteUrl: string, limit: number): Promise<string[]> {
  const base = siteUrl.replace(/\/$/, "");
  const roots: string[] = [];

  // robots.txt
  const robots = await fetchText(`${base}/robots.txt`, 5000);
  if (robots) {
    for (const m of robots.matchAll(/^Sitemap:\s*(.+)$/gim)) {
      const u = m[1]?.trim(); if (u) roots.push(u);
    }
  }
  // Homepage <link rel="sitemap">
  try {
    const html = await fetchText(base, 6000);
    if (html) {
      for (const m of html.matchAll(/<link[^>]+rel=["']sitemap["'][^>]*href=["']([^"']+)["']/gi)) {
        const h = m[1] ?? ""; if (h) roots.push(resolveUrl(h, base));
      }
    }
  } catch { /* ignore */ }
  // Fallback
  if (roots.length === 0) roots.push(`${base}/sitemap.xml`, `${base}/wp-sitemap.xml`);

  const visited = new Set<string>();
  const queue = [...new Set(roots)];
  const collected: string[] = [];

  while (queue.length > 0 && collected.length < limit) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const xml = await fetchText(url);
    if (!xml) continue;
    if (isSitemapIndex(xml)) {
      for (const loc of extractSitemapLocs(xml)) {
        const resolved = resolveUrl(loc, base);
        if (!visited.has(resolved)) queue.push(resolved);
      }
    } else {
      for (const loc of extractUrlLocs(xml)) {
        if (collected.length >= limit) break;
        collected.push(loc);
      }
    }
  }

  // Fallback: if sitemap empty, use root URL only
  if (collected.length === 0) collected.push(siteUrl);

  return collected.slice(0, limit);
}

// ── SSE stream helper ─────────────────────────────────────────────────────────

function sseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { url, limit = 50 } = await req.json() as { url: string; limit?: number };
  if (!url) return new Response(JSON.stringify({ error: "URL requise" }), { status: 400 });

  const clampedLimit = Math.min(Math.max(Number(limit), 1), 500);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Collect URLs from sitemap
        const urls = await collectUrls(url, clampedLimit);

        controller.enqueue(encoder.encode(sseEvent({ type: "progress", done: 0, total: urls.length })));

        // 2. Analyse in parallel batches of 5
        const CONCURRENCY = 5;
        type PageResult = { url: string; analysis: Awaited<ReturnType<typeof analyzeUrl>>; score: number; grade: string };
        const results: PageResult[] = [];

        for (let i = 0; i < urls.length; i += CONCURRENCY) {
          const batch = urls.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.allSettled(batch.map(async (u) => {
            const analysis = await analyzeUrl(u);
            const { score, grade } = computeScore(analysis);
            return { url: u, analysis, score, grade };
          }));
          for (const r of batchResults) {
            if (r.status === "fulfilled") results.push(r.value);
          }
          controller.enqueue(encoder.encode(sseEvent({
            type: "progress",
            done: Math.min(i + CONCURRENCY, urls.length),
            total: urls.length,
          })));
        }

        if (results.length === 0) {
          controller.enqueue(encoder.encode(sseEvent({ type: "error", message: "Aucune page analysée" })));
          controller.close();
          return;
        }

        // 3. Aggregate: use the first result as base, augment with domain-level stats
        const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
        const firstResult = results[0]!;
        const aggregate = {
          ...firstResult.analysis,
          domainAnalysis: {
            pagesAnalyzed: results.length,
            pagesTotal: urls.length,
            limit: clampedLimit,
            avgScore,
            pages: results.map(r => ({
              url: r.url,
              score: r.score,
              grade: r.grade,
              title: r.analysis.title,
              titleLen: r.analysis.title?.length ?? 0,
              description: r.analysis.description,
              descLen: r.analysis.description?.length ?? 0,
              h1Count: r.analysis.h1Count,
              jsonLdDetected: r.analysis.jsonLdDetected,
              jsonLdTypes: r.analysis.jsonLdTypes ?? [],
              robotsMeta: r.analysis.robotsMeta,
              imagesMissingAlt: r.analysis.imagesMissingAlt,
            })),
          },
        };

        controller.enqueue(encoder.encode(sseEvent({ type: "result", result: aggregate })));
      } catch (e) {
        controller.enqueue(encoder.encode(sseEvent({ type: "error", message: String(e) })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
