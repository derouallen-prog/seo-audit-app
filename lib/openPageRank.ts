// OpenPageRank by Keywords Everywhere — https://openpagerank.keywordseverywhere.com
// Free: 30,000 domains/month
// Auth: Authorization: Bearer <key>  |  POST /v1/domains/bulk

const OPR_BASE = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk";

export interface OprDomainResult {
  domain: string;
  pageRankInteger: number;
  pageRankDecimal: number;
  rank: number | null;
  referringDomains?: number;
}

interface OprApiResult {
  domain: string;
  found: boolean;
  open_page_rank: number;
  rank: number;
  referring_domains: number;
}

interface OprApiResponse {
  count: number;
  results: OprApiResult[];
  invalid: string[];
}

export async function getOpenPageRank(domains: string[]): Promise<OprDomainResult[]> {
  const apiKey = process.env.OPR_API_KEY;
  if (!apiKey || domains.length === 0) return [];

  const cleaned = domains
    .map(d => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase())
    .slice(0, 100);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);

  try {
    const res = await fetch(OPR_BASE, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domains: cleaned }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn("[opr] HTTP error:", res.status);
      return [];
    }
    const data = await res.json() as OprApiResponse;
    return data.results
      .filter(r => r.found)
      .map(r => ({
        domain: r.domain,
        pageRankInteger: Math.round(r.open_page_rank),
        pageRankDecimal: r.open_page_rank,
        rank: r.rank ?? null,
        referringDomains: r.referring_domains,
      }));
  } catch (err) {
    clearTimeout(t);
    console.warn("[opr] fetch error:", err);
    return [];
  }
}

export async function getOpenPageRankForDomain(domain: string): Promise<OprDomainResult | null> {
  const results = await getOpenPageRank([domain]);
  return results[0] ?? null;
}
