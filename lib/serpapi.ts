// SerpAPI — https://serpapi.com/search-api
// Auth: api_key query param
// Env: SERPAPI_API_KEY

const SERPAPI_BASE = "https://serpapi.com/search.json";
const SERPAPI_TIMEOUT_MS = 30_000;

async function serpApiFetch(params: Record<string, string | number>): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;

  const url = new URL(SERPAPI_BASE);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      console.warn("[serpapi] request failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.warn(`[serpapi] timeout après ${SERPAPI_TIMEOUT_MS}ms`);
    } else {
      console.warn("[serpapi] error:", e);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function domainOf(href: string): string {
  try { return new URL(href).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ─── Classic Google SERP ─────────────────────────────────────────────────────

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
  relatedQuestions: string[];
}

export async function getSerpResults(query: string, country = "fr", page = 0): Promise<SerpData | null> {
  const raw = await serpApiFetch({ engine: "google", q: query, gl: country, hl: country, start: page * 10 });
  if (!raw) return null;

  const organic = (raw.organic_results ?? []) as Record<string, unknown>[];
  const answerBox = raw.answer_box as Record<string, unknown> | undefined;
  const searchInfo = raw.search_information as Record<string, unknown> | undefined;

  return {
    query,
    totalResults: String(searchInfo?.total_results ?? "N/A"),
    results: organic.map((r, i) => {
      const href = String(r.link ?? "");
      return {
        position: Number(r.position ?? i + 1 + page * 10),
        title: String(r.title ?? ""),
        url: href,
        domain: domainOf(href),
        description: String(r.snippet ?? ""),
      };
    }),
    featuredSnippet: answerBox
      ? { title: String(answerBox.title ?? ""), description: String(answerBox.snippet ?? answerBox.answer ?? ""), url: String(answerBox.link ?? "") }
      : undefined,
    relatedSearches: ((raw.related_searches ?? []) as Record<string, unknown>[]).map(r => String(r.query ?? "")).filter(Boolean),
    relatedQuestions: ((raw.related_questions ?? []) as Record<string, unknown>[]).map(r => String(r.question ?? "")).filter(Boolean),
  };
}

// ─── Long-tail keywords (dérivé des requêtes associées + PAA, SerpAPI n'a pas d'endpoint dédié) ─────

export async function getLongTailKeywords(keyword: string, count = 20, country = "fr"): Promise<string[]> {
  const data = await getSerpResults(keyword, country);
  if (!data) return [];
  const suggestions = [...data.relatedQuestions, ...data.relatedSearches];
  return suggestions.slice(0, count);
}

// ─── Domain ranking (scan multi-pages des résultats organiques) ─────────────

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
  pagesNumber = 5
): Promise<DomainRankingResult | null> {
  const cleanTarget = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

  for (let page = 0; page < pagesNumber; page++) {
    const data = await getSerpResults(keyword, country, page);
    if (!data) return page === 0 ? null : { keyword, domain, position: null };
    const match = data.results.find(r => r.domain === cleanTarget || r.domain.endsWith(`.${cleanTarget}`));
    if (match) return { keyword, domain, position: match.position, url: match.url, title: match.title };
    if (data.results.length === 0) break; // plus de résultats, inutile de continuer à paginer
  }

  return { keyword, domain, position: null };
}

// ─── Local Pack (Google Maps / avis) ─────────────────────────────────────────

export interface LocalPackEntry {
  position: number;
  name: string;
  rating?: number;
  reviews?: number;
  type?: string;
  address?: string;
  phone?: string;
}

export interface LocalPackData {
  query: string;
  location: string;
  results: LocalPackEntry[];
}

export async function getLocalPack(query: string, location: string, country = "fr"): Promise<LocalPackData | null> {
  const raw = await serpApiFetch({ engine: "google_local", q: query, location, gl: country, hl: country });
  if (!raw) return null;

  const results = (raw.local_results ?? []) as Record<string, unknown>[];
  return {
    query,
    location,
    results: results.map((r, i) => ({
      position: Number(r.position ?? i + 1),
      name: String(r.title ?? ""),
      rating: r.rating != null ? Number(r.rating) : undefined,
      reviews: r.reviews != null ? Number(r.reviews) : undefined,
      type: r.type != null ? String(r.type) : undefined,
      address: r.address != null ? String(r.address) : undefined,
      phone: r.phone != null ? String(r.phone) : undefined,
    })),
  };
}

// ─── Google AI Overview (SGE) ────────────────────────────────────────────────

export interface AiOverviewData {
  present: boolean;
  textBlocks: string[];
  references: { title: string; link: string }[];
}

export async function getAiOverview(query: string, country = "fr"): Promise<AiOverviewData | null> {
  const raw = await serpApiFetch({ engine: "google", q: query, gl: country, hl: country });
  if (!raw) return null;

  const aiOverview = raw.ai_overview as Record<string, unknown> | undefined;
  if (!aiOverview) return { present: false, textBlocks: [], references: [] };

  // Réponse directe (text_blocks déjà présents) ou juste un page_token nécessitant un second appel.
  let blocksSource = aiOverview;
  if (!aiOverview.text_blocks && aiOverview.page_token) {
    const follow = await serpApiFetch({ engine: "google_ai_overview", page_token: String(aiOverview.page_token) });
    if (follow) blocksSource = follow;
  }

  const textBlocks = ((blocksSource.text_blocks ?? []) as Record<string, unknown>[])
    .map(b => String(b.snippet ?? b.text ?? ""))
    .filter(Boolean);
  const references = ((blocksSource.references ?? []) as Record<string, unknown>[])
    .map(r => ({ title: String(r.title ?? ""), link: String(r.link ?? "") }))
    .filter(r => r.link);

  return { present: textBlocks.length > 0, textBlocks, references };
}
