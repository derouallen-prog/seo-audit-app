const BASE_URL = "https://api.dataforseo.com";

const LOCATION_CODES: Record<string, number> = {
  fr: 2250,
  us: 2840,
  uk: 2826,
  gb: 2826,
  de: 2276,
  es: 2724,
  it: 2380,
  be: 2056,
  ch: 2756,
  ca: 2124,
};

const LANGUAGE_CODES: Record<string, string> = {
  fr: "fr",
  us: "en",
  uk: "en",
  gb: "en",
  de: "de",
  es: "es",
  it: "it",
  be: "fr",
  ch: "fr",
  ca: "fr",
};

function getLocationCode(country: string): number {
  return LOCATION_CODES[country.toLowerCase()] ?? 2250;
}

function getLanguageCode(country: string): string {
  return LANGUAGE_CODES[country.toLowerCase()] ?? "fr";
}

function getAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD non configurés dans .env.local");
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function dfsPost<T = unknown>(path: string, data: object[]): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DataForSEO ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as T;
}

// ─── SERP Analysis ──────────────────────────────────────────────────────────

export interface DfsSerpResult {
  position: number;
  domain: string;
  title: string;
  description: string;
  url: string;
  breadcrumb?: string;
}

export interface DfsSerpData {
  keyword: string;
  locationCode: number;
  languageCode: string;
  totalResults: number;
  itemTypes: string[];
  organic: DfsSerpResult[];
  featuredSnippet?: { title: string; description: string; url: string };
  relatedSearches: string[];
  peopleAlsoAsk: string[];
}

interface DfsSerpRaw {
  tasks?: Array<{
    status_code: number;
    result?: Array<{
      se_results_count?: number;
      item_types?: string[];
      items?: Array<{
        type: string;
        rank_absolute?: number;
        domain?: string;
        title?: string;
        description?: string;
        url?: string;
        breadcrumb?: string;
        items?: Array<{ type: string; title?: string }>;
      }>;
    }>;
  }>;
}

export async function getDataForSeoSerp(keyword: string, country = "fr"): Promise<DfsSerpData | null> {
  const locationCode = getLocationCode(country);
  const languageCode = getLanguageCode(country);

  const raw = await dfsPost<DfsSerpRaw>("/v3/serp/google/organic/live/regular", [
    {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      depth: 10,
      device: "desktop",
    },
  ]);

  const task = raw.tasks?.[0];
  if (!task || task.status_code !== 20000) return null;
  const result = task.result?.[0];
  if (!result) return null;

  const organic: DfsSerpResult[] = [];
  let featuredSnippet: DfsSerpData["featuredSnippet"];
  const relatedSearches: string[] = [];
  const peopleAlsoAsk: string[] = [];

  for (const item of result.items ?? []) {
    if (item.type === "organic" && item.rank_absolute) {
      organic.push({
        position: item.rank_absolute,
        domain: item.domain ?? "",
        title: item.title ?? "",
        description: item.description ?? "",
        url: item.url ?? "",
        breadcrumb: item.breadcrumb ?? undefined,
      });
    } else if (item.type === "featured_snippet") {
      featuredSnippet = {
        title: item.title ?? "",
        description: item.description ?? "",
        url: item.url ?? "",
      };
    } else if (item.type === "related_searches") {
      for (const sub of item.items ?? []) {
        if (sub.title) relatedSearches.push(sub.title);
      }
    } else if (item.type === "people_also_ask") {
      for (const sub of item.items ?? []) {
        if (sub.title) peopleAlsoAsk.push(sub.title);
      }
    }
  }

  return {
    keyword,
    locationCode,
    languageCode,
    totalResults: result.se_results_count ?? 0,
    itemTypes: result.item_types ?? [],
    organic: organic.sort((a, b) => a.position - b.position),
    featuredSnippet,
    relatedSearches,
    peopleAlsoAsk,
  };
}

// ─── Keyword Overview ────────────────────────────────────────────────────────

export interface DfsKeywordMetric {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: string;
  difficulty: number;
  mainIntent: string;
  foreignIntents: string[];
  monthlySearches: { year: number; month: number; volume: number }[];
  serpFeatures: string[];
}

interface DfsKwOverviewRaw {
  tasks?: Array<{
    status_code: number;
    result?: Array<{
      items?: Array<{
        keyword?: string;
        keyword_info?: {
          search_volume?: number;
          cpc?: number;
          competition?: number;
          competition_level?: string;
          monthly_searches?: Array<{ year: number; month: number; search_volume: number }>;
        };
        keyword_properties?: {
          keyword_difficulty?: number;
        };
        search_intent_info?: {
          main_intent?: string;
          foreign_intent?: string[];
        };
        serp_info?: {
          serp_item_types?: string[];
        };
      }>;
    }>;
  }>;
}

export async function getDataForSeoKeywordOverview(
  keywords: string[],
  country = "fr",
): Promise<DfsKeywordMetric[]> {
  const locationCode = getLocationCode(country);
  const languageCode = getLanguageCode(country);

  const raw = await dfsPost<DfsKwOverviewRaw>("/v3/dataforseo_labs/google/keyword_overview/live", [
    {
      keywords: keywords.slice(0, 10),
      location_code: locationCode,
      language_code: languageCode,
      include_serp_info: true,
    },
  ]);

  const task = raw.tasks?.[0];
  if (!task || task.status_code !== 20000) return [];
  const items = task.result?.[0]?.items ?? [];

  return items.map((item) => ({
    keyword: item.keyword ?? "",
    searchVolume: item.keyword_info?.search_volume ?? 0,
    cpc: item.keyword_info?.cpc ?? 0,
    competition: item.keyword_info?.competition ?? 0,
    competitionLevel: item.keyword_info?.competition_level ?? "UNKNOWN",
    difficulty: item.keyword_properties?.keyword_difficulty ?? 0,
    mainIntent: item.search_intent_info?.main_intent ?? "unknown",
    foreignIntents: item.search_intent_info?.foreign_intent ?? [],
    monthlySearches: (item.keyword_info?.monthly_searches ?? []).map((m) => ({
      year: m.year,
      month: m.month,
      volume: m.search_volume,
    })),
    serpFeatures: item.serp_info?.serp_item_types ?? [],
  }));
}

// ─── Backlinks Summary ───────────────────────────────────────────────────────

export interface DfsBacklinksSummary {
  target: string;
  rank: number;
  backlinks: number;
  referringDomains: number;
  referringMainDomains: number;
  referringIPs: number;
  brokenBacklinks: number;
  brokenPages: number;
  spamScore: number;
  targetSpamScore: number;
  tldDistribution: Record<string, number>;
  platformTypes: Record<string, number>;
  linkAttributes: Record<string, number>;
  country?: string;
  cms?: string;
}

interface DfsBacklinksRaw {
  tasks?: Array<{
    status_code: number;
    result?: Array<{
      target?: string;
      rank?: number;
      backlinks?: number;
      referring_domains?: number;
      referring_main_domains?: number;
      referring_ips?: number;
      broken_backlinks?: number;
      broken_pages?: number;
      backlinks_spam_score?: number;
      info?: { target_spam_score?: number; country?: string; cms?: string };
      referring_links_tld?: Record<string, number>;
      referring_links_platform_types?: Record<string, number>;
      referring_links_attributes?: Record<string, number>;
    }>;
  }>;
}

export async function getDataForSeoBacklinks(domain: string): Promise<DfsBacklinksSummary | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

  const raw = await dfsPost<DfsBacklinksRaw>("/v3/backlinks/summary/live", [
    {
      target: cleanDomain,
      include_subdomains: true,
      backlinks_status_type: "live",
      internal_list_limit: 10,
    },
  ]);

  const task = raw.tasks?.[0];
  if (!task || task.status_code !== 20000) return null;
  const result = task.result?.[0];
  if (!result) return null;

  return {
    target: result.target ?? cleanDomain,
    rank: result.rank ?? 0,
    backlinks: result.backlinks ?? 0,
    referringDomains: result.referring_domains ?? 0,
    referringMainDomains: result.referring_main_domains ?? 0,
    referringIPs: result.referring_ips ?? 0,
    brokenBacklinks: result.broken_backlinks ?? 0,
    brokenPages: result.broken_pages ?? 0,
    spamScore: result.backlinks_spam_score ?? 0,
    targetSpamScore: result.info?.target_spam_score ?? 0,
    tldDistribution: result.referring_links_tld ?? {},
    platformTypes: result.referring_links_platform_types ?? {},
    linkAttributes: result.referring_links_attributes ?? {},
    country: result.info?.country,
    cms: result.info?.cms,
  };
}

// ─── On-Page Instant Analysis ─────────────────────────────────────────────────

export interface DfsPageAnalysis {
  url: string;
  title: string;
  description: string;
  h1Tags: string[];
  h2Tags: string[];
  canonical?: string;
  robotsMeta?: string;
  contentWordCount: number;
  linksInternal: number;
  linksExternal: number;
  imageCount: number;
  imagesWithoutAlt: number;
  loadTimeMs?: number;
  ttfbMs?: number;
  checks: {
    title: boolean | null;
    description: boolean | null;
    h1: boolean | null;
    canonical: boolean | null;
    https: boolean | null;
    robotsMeta: boolean | null;
    largePageSize: boolean | null;
  };
  statusCode?: number;
}

interface DfsOnPageRaw {
  tasks?: Array<{
    status_code: number;
    result?: Array<{
      items?: Array<{
        url?: string;
        status_code?: number;
        meta?: {
          title?: string;
          description?: string;
          htags?: { h1?: string[]; h2?: string[] };
          canonical?: string;
          robots?: string;
          content?: { words_count?: number };
          images_count?: number;
          images_without_alt_count?: number;
          internal_links_count?: number;
          external_links_count?: number;
        };
        page_timing?: {
          time_to_interactive?: number;
          time_to_first_byte?: number;
          dom_complete?: number;
        };
        checks?: Record<string, boolean | null>;
      }>;
    }>;
  }>;
}

export async function getDataForSeoPageAnalysis(url: string): Promise<DfsPageAnalysis | null> {
  const raw = await dfsPost<DfsOnPageRaw>("/v3/on_page/instant_pages", [
    {
      url,
      load_resources: false,
      enable_javascript: false,
      custom_js: null,
    },
  ]);

  const task = raw.tasks?.[0];
  if (!task || task.status_code !== 20000) return null;
  const item = task.result?.[0]?.items?.[0];
  if (!item) return null;

  const meta = item.meta ?? {};
  const timing = item.page_timing ?? {};
  const checks = item.checks ?? {};

  return {
    url: item.url ?? url,
    statusCode: item.status_code,
    title: meta.title ?? "",
    description: meta.description ?? "",
    h1Tags: meta.htags?.h1 ?? [],
    h2Tags: meta.htags?.h2 ?? [],
    canonical: meta.canonical,
    robotsMeta: meta.robots,
    contentWordCount: meta.content?.words_count ?? 0,
    linksInternal: meta.internal_links_count ?? 0,
    linksExternal: meta.external_links_count ?? 0,
    imageCount: meta.images_count ?? 0,
    imagesWithoutAlt: meta.images_without_alt_count ?? 0,
    loadTimeMs: timing.dom_complete ?? timing.time_to_interactive,
    ttfbMs: timing.time_to_first_byte,
    checks: {
      title: checks["title"] ?? null,
      description: checks["description"] ?? null,
      h1: checks["h1"] ?? null,
      canonical: checks["canonical"] ?? null,
      https: checks["https"] ?? null,
      robotsMeta: checks["no_index"] != null ? !checks["no_index"] : null,
      largePageSize: checks["large_page_size"] ?? null,
    },
  };
}

// ─── Domain Rank Overview (Labs) ─────────────────────────────────────────────

export interface DfsDomainOverview {
  domain: string;
  organicKeywords: number;
  organicTraffic: number;
  organicEtv: number;
  paidKeywords: number;
  backlinks: number;
  referringDomains: number;
  rank: number;
}

interface DfsDomainRankRaw {
  tasks?: Array<{
    status_code: number;
    result?: Array<{
      items?: Array<{
        target?: string;
        metrics?: {
          organic?: {
            count?: number;
            estimated_paid_traffic_cost?: number;
            etv?: number;
            pos_1?: number;
            pos_2_3?: number;
            pos_4_10?: number;
          };
          paid?: { count?: number };
        };
      }>;
    }>;
  }>;
}

export async function getDataForSeoDomainOverview(
  domain: string,
  country = "fr",
): Promise<DfsDomainOverview | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const locationCode = getLocationCode(country);
  const languageCode = getLanguageCode(country);

  const raw = await dfsPost<DfsDomainRankRaw>("/v3/dataforseo_labs/google/domain_rank_overview/live", [
    {
      target: cleanDomain,
      location_code: locationCode,
      language_code: languageCode,
    },
  ]);

  const task = raw.tasks?.[0];
  if (!task || task.status_code !== 20000) return null;
  const item = task.result?.[0]?.items?.[0];
  if (!item) return null;

  const organic = item.metrics?.organic ?? {};
  const paid = item.metrics?.paid ?? {};

  return {
    domain: item.target ?? cleanDomain,
    organicKeywords: organic.count ?? 0,
    organicTraffic: organic.estimated_paid_traffic_cost ?? 0,
    organicEtv: organic.etv ?? 0,
    paidKeywords: paid.count ?? 0,
    backlinks: 0,
    referringDomains: 0,
    rank: 0,
  };
}
