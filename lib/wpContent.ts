import { assertSafeUrl } from "./safeUrl";

export interface WpPageSummary {
  url: string;
  title: string;
  excerpt: string;
}

/**
 * Interroge l'API REST WordPress (posts + pages) et retourne le titre + extrait
 * des URLs qui correspondent aux pages GSC fournies. Aucune authentification
 * requise pour le contenu public (posts/pages publiés).
 */
export async function fetchWpContentForUrls(
  siteBaseUrl: string,
  targetUrls: string[]
): Promise<WpPageSummary[]> {
  if (targetUrls.length === 0) return [];

  let base: string;
  try {
    base = new URL(siteBaseUrl).origin;
  } catch {
    return [];
  }

  // Garde anti-SSRF sur la base WordPress fournie
  const safeBase = await assertSafeUrl(base);
  if (!safeBase.ok) return [];

  const normalize = (u: string) => u.split("#")[0]!.replace(/\/$/, "").toLowerCase();
  const targetSet = new Set(targetUrls.map(normalize));
  const results: WpPageSummary[] = [];

  for (const type of ["posts", "pages"] as const) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(
        `${base}/wp-json/wp/v2/${type}?per_page=100&_fields=link,title,excerpt`,
        { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)" } }
      );
      clearTimeout(t);
      if (!res.ok) continue;
      const items = await res.json() as Array<{
        link?: string;
        title?: { rendered?: string };
        excerpt?: { rendered?: string };
      }>;
      for (const item of items) {
        if (!item.link) continue;
        const itemUrl = normalize(item.link);
        if (targetSet.has(itemUrl)) {
          results.push({
            url: item.link,
            title: item.title?.rendered || "",
            excerpt: (item.excerpt?.rendered || "")
              .replace(/<[^>]+>/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 250),
          });
        }
      }
    } catch { /* API REST WP indisponible ou erreur réseau — on skip silencieusement */ }
  }

  return results;
}
