// FetchSERP API v1 — https://www.fetchserp.com/api/v1/
// Auth: api-key header
// Env: FETCHSERP_API_TOKEN

const FETCHSERP_BASE = "https://www.fetchserp.com/api/v1";

function apiHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.FETCHSERP_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
  };
}

// Le scraping SERP de FetchSERP peut être lent (30-45s) ; on borne pour ne pas
// laisser la fonction serverless pendre indéfiniment.
const FETCHSERP_TIMEOUT_MS = 40_000;

async function fetchSerpApi(endpoint: string, params: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`${FETCHSERP_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCHSERP_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { headers: apiHeaders(), signal: controller.signal });
    if (!res.ok) {
      console.warn(`[fetchserp] ${endpoint} failed:`, res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn(`[fetchserp] ${endpoint} timeout après ${FETCHSERP_TIMEOUT_MS}ms`);
    } else {
      console.warn(`[fetchserp] ${endpoint} error:`, e);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── SERP Results ────────────────────────────────────────────────────────────

export interface SerpResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string;
}

export interface SerpData {
  query: string;
  totalResults: string;
  results: SerpResult[];
  featuredSnippet?: { title: string; description: string; url: string };
  relatedSearches: string[];
}

export async function getSerpResults(
  query: string,
  country = "fr",
  searchEngine = "google"
): Promise<SerpData | null> {
  const raw = await fetchSerpApi("serp", {
    query,
    country,
    search_engine: searchEngine,
    pages_number: 1,
  }) as Record<string, unknown> | null;
  if (!raw) return null;

  const organic = (raw.organic_results ?? raw.results ?? []) as Record<string, unknown>[];

  return {
    query,
    totalResults: String(raw.total_results ?? "N/A"),
    results: organic.slice(0, 10).map((r, i) => {
      const href = String(r.url ?? r.link ?? "");
      let domain = String(r.domain ?? "");
      if (!domain && href) {
        try { domain = new URL(href).hostname.replace(/^www\./, ""); } catch { domain = ""; }
      }
      return {
        position: Number(r.position ?? i + 1),
        title: String(r.title ?? ""),
        url: href,
        domain,
        description: String(r.description ?? r.snippet ?? ""),
      };
    }),
    featuredSnippet: raw.featured_snippet
      ? {
          title: String((raw.featured_snippet as Record<string, unknown>).title ?? ""),
          description: String((raw.featured_snippet as Record<string, unknown>).description ?? ""),
          url: String((raw.featured_snippet as Record<string, unknown>).url ?? ""),
        }
      : undefined,
    relatedSearches: ((raw.related_searches ?? []) as unknown[]).map(r =>
      typeof r === "string" ? r : String((r as Record<string, unknown>).query ?? r)
    ),
  };
}

// ─── Long-tail Keywords ───────────────────────────────────────────────────────

export async function getLongTailKeywords(
  keyword: string,
  count = 20,
  searchIntent?: string,
  country = "fr"
): Promise<string[]> {
  const params: Record<string, string | number> = { keyword, count, country };
  if (searchIntent) params.search_intent = searchIntent;

  const raw = await fetchSerpApi("get_long_tail_keywords", params);
  if (!raw) return [];

  const keywords = Array.isArray(raw)
    ? raw
    : ((raw as Record<string, unknown>).keywords
      ?? (raw as Record<string, unknown>).long_tail_keywords
      ?? []) as unknown[];

  return keywords
    .map(k => (typeof k === "string" ? k : String((k as Record<string, unknown>).keyword ?? "")))
    .filter(Boolean);
}

// ─── Domain Ranking ───────────────────────────────────────────────────────────

export interface DomainRankingResult {
  keyword: string;
  domain: string;
  position: number | null;
  url?: string;
  title?: string;
}

export async function getDomainRanking(
  keyword: string,
  domain: string,
  country = "fr",
  searchEngine = "google",
  pagesNumber = 5
): Promise<DomainRankingResult | null> {
  const raw = await fetchSerpApi("domain_ranking", {
    keyword,
    domain,
    country,
    search_engine: searchEngine,
    pages_number: pagesNumber,
  }) as Record<string, unknown> | null;
  if (!raw) return null;

  return {
    keyword,
    domain,
    position: raw.position != null ? Number(raw.position) : null,
    url: raw.url != null ? String(raw.url) : undefined,
    title: raw.title != null ? String(raw.title) : undefined,
  };
}

// ─── Backlinks ────────────────────────────────────────────────────────────────

export interface BacklinkEntry {
  url: string;
  domain: string;
  anchor?: string;
  domainAuthority?: number;
}

export interface BacklinksResult {
  domain: string;
  totalBacklinks: number;
  backlinks: BacklinkEntry[];
}

export async function getBacklinks(
  domain: string,
  country = "fr",
  pagesNumber = 3
): Promise<BacklinksResult | null> {
  const raw = await fetchSerpApi("get_backlinks", {
    domain,
    country,
    search_engine: "google",
    pages_number: pagesNumber,
  }) as Record<string, unknown> | null;
  if (!raw) return null;

  const list = ((raw.backlinks ?? raw.results ?? []) as Record<string, unknown>[]).slice(0, 30);
  return {
    domain,
    totalBacklinks: Number(raw.total ?? raw.total_backlinks ?? list.length),
    backlinks: list.map(b => ({
      url: String(b.url ?? b.link ?? ""),
      domain: String(b.domain ?? ""),
      anchor: b.anchor != null ? String(b.anchor) : b.anchor_text != null ? String(b.anchor_text) : undefined,
      domainAuthority: b.domain_authority != null ? Number(b.domain_authority) : b.da != null ? Number(b.da) : undefined,
    })),
  };
}
