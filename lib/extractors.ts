import * as cheerio from "cheerio";

export function extractBasic(html: string, baseUrl: string) {
  const $ = cheerio.load(html);

  const title = $("title").first().text() || null;
  const description = $('meta[name="description"]').attr("content") || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robotsMeta = $('meta[name="robots"]').attr("content") || null;

  const h1Count = $("h1").length;
  const jsonLdDetected = $('script[type="application/ld+json"]').length > 0;

  // Extract @type values from all JSON-LD scripts
  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || "");
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const t = node["@type"];
        if (t) (Array.isArray(t) ? t : [t]).forEach((v: string) => jsonLdTypes.push(v));
        // Also handle @graph
        if (node["@graph"]) {
          for (const g of node["@graph"]) {
            const gt = g["@type"];
            if (gt) (Array.isArray(gt) ? gt : [gt]).forEach((v: string) => jsonLdTypes.push(v));
          }
        }
      }
    } catch { /* ignore */ }
  });

  // Heuristics: About / Contact pages from link hrefs+text
  let hasAboutPage = false;
  let hasContactPage = false;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").toLowerCase();
    const text = ($(el).text() || "").toLowerCase();
    if (/a-propos|about|qui-sommes|notre-equipe|qui-nous|l-equipe/.test(href + " " + text)) hasAboutPage = true;
    if (/contact|nous-contacter|get-in-touch|joindre/.test(href + " " + text)) hasContactPage = true;
  });

  // Heading structure
  const headings = {
    h2: $("h2").length,
    h3: $("h3").length,
    h4: $("h4").length,
  };

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

  // OpenGraph
  const openGraph = {
    title: $('meta[property="og:title"]').attr("content") || null,
    description: $('meta[property="og:description"]').attr("content") || null,
    image: $('meta[property="og:image"]').attr("content") || null,
    type: $('meta[property="og:type"]').attr("content") || null,
    url: $('meta[property="og:url"]').attr("content") || null,
  };

  // Twitter Card
  const twitterCard = {
    card: $('meta[name="twitter:card"]').attr("content") || null,
    title: $('meta[name="twitter:title"]').attr("content") || null,
    description: $('meta[name="twitter:description"]').attr("content") || null,
    image: $('meta[name="twitter:image"]').attr("content") || null,
  };

  return {
    title, description, canonical, robotsMeta,
    h1Count, headings,
    jsonLdDetected, jsonLdTypes,
    internalLinks, externalLinks,
    imagesMissingAlt,
    sitemapHref,
    openGraph,
    twitterCard,
    hasAboutPage,
    hasContactPage,
  };
}
