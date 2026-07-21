// Google Business Profile API client
// APIs required in Google Cloud Console:
//   - My Business Account Management API
//   - My Business Business Information API
//   - Business Profile Performance API
// OAuth scope required: https://www.googleapis.com/auth/business.manage

const ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const PERF_API = "https://businessprofileperformance.googleapis.com/v1";

async function gbpFetch<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn("[gbp] fetch failed:", res.status, url, err.slice(0, 200));
      return null;
    }
    return await res.json() as T;
  } catch (e) {
    console.warn("[gbp] fetch error:", e);
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GbpLocation {
  name: string;           // e.g. "locations/1234567890"
  title: string;          // Business name
  websiteUri?: string;
  primaryPhone?: string;
  storefrontAddress?: { locality?: string; regionCode?: string };
  categories?: { primaryCategory?: { displayName?: string } };
  profile?: { description?: string };
}

export interface GbpSearchKeyword {
  keyword: string;
  impressions: number | null; // null = below threshold (privacy)
}

export interface GbpMetricsSummary {
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  mapsImpressions: number;
  searchImpressions: number;
  totalImpressions: number;
  periodDays: number;
}

// ─── Account & Location listing ──────────────────────────────────────────────

export async function listGbpLocations(accessToken: string): Promise<GbpLocation[]> {
  // Step 1: list accounts
  const accountsData = await gbpFetch<{ accounts?: { name: string }[] }>(
    `${ACCOUNT_API}/accounts`,
    accessToken
  );
  if (!accountsData?.accounts?.length) return [];

  // Step 2: list locations for each account (usually just one account)
  const allLocations: GbpLocation[] = [];
  const readMask = "name,title,websiteUri,primaryPhone,storefrontAddress,categories,profile";

  for (const account of accountsData.accounts.slice(0, 3)) {
    const locData = await gbpFetch<{ locations?: GbpLocation[] }>(
      `${INFO_API}/${account.name}/locations?readMask=${readMask}&pageSize=20`,
      accessToken
    );
    if (locData?.locations) allLocations.push(...locData.locations);
  }

  return allLocations;
}

// ─── Search Keywords (what users searched to find the business) ───────────────

export async function getGbpSearchKeywords(
  accessToken: string,
  locationName: string, // e.g. "locations/1234567890"
  months = 6
): Promise<GbpSearchKeyword[]> {
  const now = new Date();
  const end = { year: now.getFullYear(), month: now.getMonth() + 1 }; // current month
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const start = { year: startDate.getFullYear(), month: startDate.getMonth() + 1 };

  const params = new URLSearchParams({
    "monthlyRange.startMonth.year": String(start.year),
    "monthlyRange.startMonth.month": String(start.month),
    "monthlyRange.endMonth.year": String(end.year),
    "monthlyRange.endMonth.month": String(end.month),
  });

  const data = await gbpFetch<{
    searchKeywordsCounts?: { searchKeyword: string; insightsValue: { value?: string; threshold?: string } }[]
  }>(
    `${PERF_API}/${locationName}/searchkeywords/impressions/monthly?${params}`,
    accessToken
  );

  if (!data?.searchKeywordsCounts) return [];

  return data.searchKeywordsCounts.map(k => ({
    keyword: k.searchKeyword,
    impressions: k.insightsValue.value != null ? parseInt(k.insightsValue.value) : null,
  })).slice(0, 50);
}

// ─── Performance Metrics (views, clicks, calls) ───────────────────────────────

export async function getGbpMetrics(
  accessToken: string,
  locationName: string,
  days = 90
): Promise<GbpMetricsSummary | null> {
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 86400_000);

  const fmt = (d: Date) => ({
    year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
  });
  const start = fmt(startDate);
  const end = fmt(endDate);

  const metrics = [
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  ];

  const params = new URLSearchParams({
    "dailyRange.startDate.year": String(start.year),
    "dailyRange.startDate.month": String(start.month),
    "dailyRange.startDate.day": String(start.day),
    "dailyRange.endDate.year": String(end.year),
    "dailyRange.endDate.month": String(end.month),
    "dailyRange.endDate.day": String(end.day),
  });
  for (const m of metrics) params.append("dailyMetric", m);

  const data = await gbpFetch<{
    multiDailyMetricTimeSeries?: {
      dailyMetric: string;
      dailySubEntityType?: unknown;
      timeSeries?: { datedValues?: { value?: string }[] };
    }[]
  }>(
    `${PERF_API}/${locationName}:getDailyMetricsTimeSeries?${params}`,
    accessToken
  );

  if (!data?.multiDailyMetricTimeSeries) return null;

  const sum = (metricName: string): number =>
    data.multiDailyMetricTimeSeries!
      .find(m => m.dailyMetric === metricName)
      ?.timeSeries?.datedValues
      ?.reduce((acc, v) => acc + parseInt(v.value ?? "0"), 0) ?? 0;

  const mapsImpressions = sum("BUSINESS_IMPRESSIONS_DESKTOP_MAPS") + sum("BUSINESS_IMPRESSIONS_MOBILE_MAPS");
  const searchImpressions = sum("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH") + sum("BUSINESS_IMPRESSIONS_MOBILE_SEARCH");

  return {
    websiteClicks: sum("WEBSITE_CLICKS"),
    callClicks: sum("CALL_CLICKS"),
    directionRequests: sum("BUSINESS_DIRECTION_REQUESTS"),
    mapsImpressions,
    searchImpressions,
    totalImpressions: mapsImpressions + searchImpressions,
    periodDays: days,
  };
}

// ─── Combined insights for assistant ─────────────────────────────────────────

export interface GbpInsights {
  location: GbpLocation;
  searchKeywords: GbpSearchKeyword[];
  metrics: GbpMetricsSummary | null;
}

export async function getGbpInsightsForLocation(
  accessToken: string,
  locationName: string,
  locationInfo: GbpLocation
): Promise<GbpInsights> {
  const [searchKeywords, metrics] = await Promise.all([
    getGbpSearchKeywords(accessToken, locationName, 6),
    getGbpMetrics(accessToken, locationName, 90),
  ]);
  return { location: locationInfo, searchKeywords, metrics };
}
