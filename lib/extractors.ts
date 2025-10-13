import * as cheerio from "cheerio";

export function extractBasic(html: string, baseUrl: string) {
  const $ = cheerio.load(html);

  const title = $("title").first().text() || null;
  const description = $('meta[name="description"]').attr("content") || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robotsMeta = $('meta[name="robots"]').attr("content") || null;

  const h1Count = $("h1").length;
  const jsonLdDetected = $('script[type="application/ld+json"]').length > 0;

  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const u = new URL(href, baseUrl);
      if (u.origin === new URL(baseUrl).origin) internalLinks++;
      else externalLinks++;
    } catch { /* ignore */ }
  });

  let imagesMissingAlt = 0;
  $("img").each((_, el) => {
    const alt = ($(el).attr("alt") || "").trim();
    if (!alt) imagesMissingAlt++;
  });

  // sitemap via <link rel="sitemap">
  const sitemapHref = $('link[rel="sitemap"]').attr("href") || null;

  return { title, description, canonical, robotsMeta, h1Count, jsonLdDetected, internalLinks, externalLinks, imagesMissingAlt, sitemapHref };
}
