// Keywords Everywhere API — https://api.keywordseverywhere.com
// Free credits on sign-up; usage-based billing thereafter.
// API key: https://keywordseverywhere.com/api.html
//
// Endpoints used:
//   POST /v1/get_keyword_data  — volume, CPC, competition per keyword
//   GET  /v1/get_keyword_trends — monthly trend data for a keyword

const KE_BASE = "https://api.keywordseverywhere.com/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KeKeywordMetrics {
  keyword: string;
  volume: number;          // monthly search volume
  cpc: number;             // avg CPC in currency
  competition: number;     // 0–1 (AdWords competition)
  trend: KeMonthlyTrend[]; // 12-month trend (may be empty)
}

export interface KeMonthlyTrend {
  month: string; // "Jan 2025"
  value: number; // relative search volume
}

export interface KeTrendResult {
  keyword: string;
  country: string;
  trend: KeMonthlyTrend[];
}

// ─── API client ──────────────────────────────────────────────────────────────

async function keFetch(path: string, options: RequestInit): Promise<unknown> {
  const apiKey = process.env.KE_API_KEY;
  if (!apiKey) return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${KE_BASE}${path}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        ...(options.headers ?? {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn("[ke] HTTP error:", res.status, path);
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(t);
    console.warn("[ke] fetch error:", err);
    return null;
  }
}

// ─── Keyword volume + trend ───────────────────────────────────────────────────

export async function getKeKeywordData(
  keywords: string[],
  country = "fr",
  currency = "EUR"
): Promise<KeKeywordMetrics[]> {
  if (!keywords.length || !process.env.KE_API_KEY) return [];

  const body = new URLSearchParams();
  body.append("country", country);
  body.append("currency", currency);
  body.append("dataSource", "gkp");
  for (const kw of keywords.slice(0, 100)) body.append("kw[]", kw);

  const data = await keFetch("/get_keyword_data", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }) as { data?: { keyword: string; vol: number; cpc: { value: number }; competition: number; trend?: { month: string; value: number }[] }[] } | null;

  if (!data?.data) return [];

  return data.data.map(k => ({
    keyword: k.keyword,
    volume: k.vol ?? 0,
    cpc: k.cpc?.value ?? 0,
    competition: k.competition ?? 0,
    trend: (k.trend ?? []).map(t => ({ month: t.month, value: t.value })),
  }));
}

// ─── Keyword trends ───────────────────────────────────────────────────────────

export async function getKeKeywordTrends(
  keyword: string,
  country = "fr"
): Promise<KeTrendResult | null> {
  if (!process.env.KE_API_KEY) return null;

  const params = new URLSearchParams({ keyword, country });
  const data = await keFetch(`/get_keyword_trends?${params}`, { method: "GET" }) as {
    data?: { month: string; value: number }[];
  } | null;

  if (!data?.data?.length) return null;

  return {
    keyword,
    country,
    trend: data.data.map(t => ({ month: t.month, value: t.value })),
  };
}
