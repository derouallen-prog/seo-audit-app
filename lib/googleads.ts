const API_VERSION = "v17";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

const LANGUAGE_RESOURCE: Record<string, string> = {
  fr: "languageConstants/1002",
  en: "languageConstants/1000",
  us: "languageConstants/1000",
  de: "languageConstants/1001",
  es: "languageConstants/1003",
  it: "languageConstants/1004",
  uk: "languageConstants/1000",
  gb: "languageConstants/1000",
};

const LOCATION_RESOURCE: Record<string, string> = {
  fr: "geoTargetConstants/2250",
  us: "geoTargetConstants/2840",
  uk: "geoTargetConstants/2826",
  gb: "geoTargetConstants/2826",
  de: "geoTargetConstants/2276",
  es: "geoTargetConstants/2724",
  it: "geoTargetConstants/2380",
  be: "geoTargetConstants/2056",
  ch: "geoTargetConstants/2756",
  ca: "geoTargetConstants/2124",
};

function getCredentials() {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "");
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    throw new Error("Variables Google Ads manquantes dans .env.local (GOOGLE_ADS_*)");
  }
  return { customerId, developerToken, clientId, clientSecret, refreshToken };
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google OAuth2 ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ─── Keyword Ideas ────────────────────────────────────────────────────────────

export interface GoogleAdsKeywordIdea {
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
  lowCpc: number;
  highCpc: number;
}

interface GoogleAdsKeywordIdeasRaw {
  results?: Array<{
    text?: string;
    keywordIdeaMetrics?: {
      avgMonthlySearches?: string;
      competition?: string;
      competitionIndex?: number;
      lowTopOfPageBidMicros?: string;
      highTopOfPageBidMicros?: string;
    };
  }>;
  error?: { code: number; message: string; status: string };
}

export async function getGoogleAdsKeywordIdeas(
  keywords: string[],
  country = "fr",
): Promise<GoogleAdsKeywordIdea[]> {
  const { customerId, developerToken, clientId, clientSecret, refreshToken } = getCredentials();
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

  const languageResource = LANGUAGE_RESOURCE[country.toLowerCase()] ?? "languageConstants/1002";
  const locationResource = LOCATION_RESOURCE[country.toLowerCase()] ?? "geoTargetConstants/2250";

  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "") ?? customerId;

  const res = await fetch(
    `${BASE_URL}/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "login-customer-id": loginCustomerId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keywordSeed: { keywords: keywords.slice(0, 20) },
        geoTargetConstants: [locationResource],
        includeAdultKeywords: false,
        keywordPlanNetwork: "GOOGLE_SEARCH",
        language: languageResource,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 500);
    try { detail = JSON.stringify(JSON.parse(body)?.error ?? body); } catch { /* keep raw */ }
    throw new Error(`Google Ads API ${res.status} (customer: ${customerId}, login: ${loginCustomerId}): ${detail}`);
  }

  const data = await res.json() as GoogleAdsKeywordIdeasRaw;

  if (data.error) {
    throw new Error(`Google Ads API error ${data.error.code}: ${data.error.message}`);
  }

  return (data.results ?? [])
    .filter((r) => r.text && r.keywordIdeaMetrics)
    .map((r) => {
      const m = r.keywordIdeaMetrics!;
      const lowMicros = parseInt(m.lowTopOfPageBidMicros ?? "0", 10);
      const highMicros = parseInt(m.highTopOfPageBidMicros ?? "0", 10);
      return {
        keyword: r.text!,
        avgMonthlySearches: parseInt(m.avgMonthlySearches ?? "0", 10),
        competition: m.competition ?? "UNSPECIFIED",
        competitionIndex: m.competitionIndex ?? 0,
        lowCpc: lowMicros / 1_000_000,
        highCpc: highMicros / 1_000_000,
      };
    })
    .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches);
}
