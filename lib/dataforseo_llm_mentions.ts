// DataForSEO AI Optimization — LLM Mentions Search
// Searches DataForSEO's indexed database of LLM responses for domain/keyword mentions.
// Unlike the LLM Scraper (which makes live requests), this queries pre-indexed data.
// Docs: https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live/

export interface LLMMentionSource {
  rank: number;
  domain: string;
  url: string;
  title: string;
  publication_date?: string;
}

export interface MonthlySearch {
  year: number;
  month: number;
  search_volume: number;
}

export interface LLMMentionItem {
  platform: string;
  model_name: string;
  question: string;
  answer: string;
  sources: LLMMentionSource[];
  search_results?: { url: string; title: string; snippet?: string }[];
  ai_search_volume: number | null;
  monthly_searches: MonthlySearch[] | null;
  first_response_at: string | null;
  last_response_at: string | null;
  brand_entities?: string[];
  fan_out_queries?: string[];
}

export interface LLMMentionsResult {
  total_count: number;
  items_count: number;
  items: LLMMentionItem[];
}

export interface LLMMentionsParams {
  /** Domain to search for (e.g. "monsite.fr") */
  domain?: string;
  /** Keyword to search for */
  keyword?: string;
  /** "fr", "en", etc. — defaults to "fr" */
  language_code?: string;
  /** DataForSEO location code — defaults to 2250 (France) */
  location_code?: number;
  /** "chat_gpt" | "google" | undefined (both) */
  platform?: "chat_gpt" | "google";
  limit?: number;
  offset?: number;
}

function dfsAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured");
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export async function searchLLMMentions(params: LLMMentionsParams): Promise<LLMMentionsResult> {
  const { domain, keyword, language_code = "fr", location_code = 2250, platform, limit = 50, offset = 0 } = params;

  if (!domain && !keyword) throw new Error("domain or keyword is required");

  const target: Record<string, unknown>[] = [];
  if (domain) {
    target.push({
      domain,
      search_filter: "include",
      search_scope: "any",
      include_subdomains: true,
    });
  }
  if (keyword) {
    target.push({
      keyword,
      search_filter: "include",
      search_scope: "any",
      match_type: "partial_match",
    });
  }

  const body: Record<string, unknown> = {
    target,
    language_code,
    location_code,
    limit,
    offset,
    order_by: ["ai_search_volume,desc"],
  };
  if (platform) body.platform = platform;

  const res = await fetch("https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${dfsAuth()}`,
    },
    body: JSON.stringify([body]),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DataForSEO LLM Mentions error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json() as {
    tasks?: {
      status_code?: number;
      status_message?: string;
      result?: {
        total_count?: number;
        items_count?: number;
        items?: LLMMentionItem[];
      }[];
    }[];
  };

  const task = data.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message}`);
  }

  const result = task?.result?.[0];
  return {
    total_count: result?.total_count ?? 0,
    items_count: result?.items_count ?? 0,
    items: result?.items ?? [],
  };
}
