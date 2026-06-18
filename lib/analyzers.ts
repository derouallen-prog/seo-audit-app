import type { Analysis } from "./types";
import { extractBasic } from "./extractors";
import { makeRecommendations } from "./reco";
import { getGscPageMetrics } from "./gsc";
import { runPageSpeed } from "./pagespeed";
import { analyzeRobotsTxt, analyzeSitemap } from "./robots";
import { getSemrushDomainKeywords, getSemrushDomainTopPages, getSemrushBacklinks } from "./semrush";

export async function analyzeUrl(rawUrl: string): Promise<Analysis> {
  const start = Date.now();
  const target = new URL(rawUrl).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(target, {
      redirect: "follow",
      headers: {
        "user-agent": "SEO-Audit-App/0.1 (+https://example.com)"
      },
      signal: controller.signal
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    throw new Error(`Échec de la requête HTTP: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }
  const end = Date.now();
  const responseTimeMs = end - start;

  const status = res.status;
  const statusText = res.statusText || "";

  // Extract security headers from HTTP response
  const https = target.startsWith("https://");
  const hsts = !!res.headers.get("strict-transport-security");
  const xFrameOptions = res.headers.get("x-frame-options");
  const xContentTypeOptions = res.headers.get("x-content-type-options");
  const csp = !!res.headers.get("content-security-policy");

  const html = await res.text();
  const htmlSize = new TextEncoder().encode(html).length;

  const basic = extractBasic(html, target);

  const analysis: Analysis = {
    status, statusText,
    title: basic.title,
    description: basic.description,
    canonical: basic.canonical,
    robotsMeta: basic.robotsMeta,
    jsonLdDetected: basic.jsonLdDetected,
    h1Count: basic.h1Count,
    headings: basic.headings,
    internalLinks: basic.internalLinks,
    externalLinks: basic.externalLinks,
    imagesMissingAlt: basic.imagesMissingAlt,
    htmlSize,
    responseTimeMs,
    sitemapHref: basic.sitemapHref,
    openGraph: basic.openGraph,
    twitterCard: basic.twitterCard,
    security: { https, hsts, xFrameOptions, xContentTypeOptions, csp },
    recommendations: []
  };

  const origin = new URL(target).origin;
  const psKey = process.env.PAGESPEED_API_KEY;
  const gscProperty = process.env.GSC_PROPERTY;
  const semrushKey = process.env.SEMRUSH_API_KEY;

  const domain = new URL(target).hostname.replace(/^www\./, "");

  // Étape 1 : robots.txt + PageSpeed + GSC + Semrush en parallèle (PSI est le plus lent ~15s)
  const psPromise = psKey ? runPageSpeed(target, psKey) : Promise.resolve(null);
  const gscPromise = gscProperty ? getGscPageMetrics(gscProperty, target, 28) : Promise.resolve(null);
  const semrushPromise = semrushKey ? getSemrushDomainKeywords(domain, semrushKey) : Promise.resolve(null);
  const topPagesPromise = semrushKey ? getSemrushDomainTopPages(domain, semrushKey) : Promise.resolve(null);
  const backlinksPromise = semrushKey ? getSemrushBacklinks(domain, semrushKey) : Promise.resolve(null);
  const robotsPromise = analyzeRobotsTxt(origin);

  // robots.txt est rapide (~<1s), on démarre sitemap dès qu'il est prêt
  const robotsResult = await robotsPromise;
  analysis.robotsTxt = {
    found: robotsResult.found,
    sitemapUrls: robotsResult.sitemapUrls,
    disallowedPaths: robotsResult.disallowedPaths,
    crawlDelay: robotsResult.crawlDelay,
    blocksGooglebot: robotsResult.blocksGooglebot,
  };

  // Étape 2 : sitemap + attente de PSI, GSC et Semrush en parallèle
  const sitemapPromise = analyzeSitemap(origin, robotsResult.sitemapUrls);
  const [sitemapResult, psResult, gscResult, semrushResult, topPagesResult, backlinksResult] = await Promise.allSettled([
    sitemapPromise,
    psPromise,
    gscPromise,
    semrushPromise,
    topPagesPromise,
    backlinksPromise,
  ]);

  if (sitemapResult.status === "fulfilled") {
    const s = sitemapResult.value;
    analysis.sitemap = { found: s.found, url: s.url, urlCount: s.urlCount, isIndex: s.isIndex };
  }
  if (psResult.status === "fulfilled" && psResult.value) {
    analysis.pagespeed = psResult.value;
  }
  if (gscResult.status === "fulfilled" && gscResult.value) {
    analysis.gsc = { ...gscResult.value, lastDays: 28 };
  }
  if (semrushResult.status === "fulfilled" && semrushResult.value) {
    analysis.keywords = semrushResult.value;
  }
  if (topPagesResult.status === "fulfilled" && topPagesResult.value) {
    analysis.domainTopPages = topPagesResult.value;
  }
  if (backlinksResult.status === "fulfilled" && backlinksResult.value) {
    analysis.backlinks = backlinksResult.value;
  }

  analysis.recommendations = makeRecommendations(analysis);

  return analysis;
}
