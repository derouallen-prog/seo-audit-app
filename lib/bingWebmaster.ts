// Bing Webmaster Tools — API historique (api.svc/json), authentifiée par clé API unique
// (Settings > API Access > Generate API Key dans Bing Webmaster Tools), pas par OAuth.
// Vérifié en direct le 2026-11-16 : GetUserSites, GetRankAndTrafficStats et GetQueryStats
// répondent toujours malgré l'annonce de retrait du 31 août 2026 (qui ne vise que SOAP/POX).
// Si cette API venait à être coupée, le symptôme serait une erreur HTTP ou un JSON
// {"ErrorCode":...} au lieu du wrapper {"d": [...]} attendu.

const BASE_URL = "https://ssl.bing.com/webmaster/api.svc/json";

function getApiKey(): string {
  const key = process.env.BING_API_KEY;
  if (!key) throw new Error("BING_API_KEY non configurée dans .env.local");
  return key;
}

async function bingGet<T>(method: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({ apikey: getApiKey(), ...params });
  const res = await fetch(`${BASE_URL}/${method}?${qs.toString()}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bing Webmaster ${method} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { d?: T[]; ErrorCode?: number; Message?: string };
  if (data.ErrorCode) throw new Error(`Bing Webmaster ${method} erreur ${data.ErrorCode}: ${data.Message ?? "inconnue"}`);
  return data.d ?? [];
}

// Les dates reviennent au format WCF "/Date(1316156400000-0700)/" ou sans offset.
function parseWcfDate(wcf: string): string {
  const match = /\/Date\((-?\d+)/.exec(wcf);
  if (!match) return wcf;
  return new Date(Number(match[1])).toISOString().slice(0, 10);
}

export interface BingSite {
  url: string;
  isVerified: boolean;
}

interface RawSite { Url: string; IsVerified: boolean }

export async function getUserSites(): Promise<BingSite[]> {
  const sites = await bingGet<RawSite>("GetUserSites");
  return sites.map(s => ({ url: s.Url, isVerified: s.IsVerified }));
}

export interface BingDailyTraffic {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
}

interface RawRankAndTrafficStats { Date: string; Clicks: number; Impressions: number }

export async function getRankAndTrafficStats(siteUrl: string, days = 28): Promise<BingDailyTraffic[]> {
  const rows = await bingGet<RawRankAndTrafficStats>("GetRankAndTrafficStats", { siteUrl });
  const all = rows.map(r => ({ date: parseWcfDate(r.Date), clicks: r.Clicks, impressions: r.Impressions }));
  all.sort((a, b) => a.date.localeCompare(b.date));
  return days > 0 ? all.slice(-days) : all;
}

export interface BingQueryStat {
  query: string;
  clicks: number;
  impressions: number;
  avgClickPosition: number | null;
  avgImpressionPosition: number | null;
}

interface RawQueryStats {
  Query: string;
  Date: string;
  Clicks: number;
  Impressions: number;
  AvgClickPosition: number; // -1 si aucun clic sur ce jour
  AvgImpressionPosition: number;
}

// L'API retourne une ligne par (requête, jour). On agrège sur la fenêtre demandée :
// somme des clics/impressions, moyenne pondérée par impressions pour les positions.
export async function getQueryStats(siteUrl: string, days = 28, limit = 50): Promise<BingQueryStat[]> {
  const rows = await bingGet<RawQueryStats>("GetQueryStats", { siteUrl });
  const cutoff = days > 0 ? Date.now() - days * 86_400_000 : 0;

  const byQuery = new Map<string, { clicks: number; impressions: number; posWeighted: number; posWeight: number; clickPosWeighted: number; clickWeight: number }>();
  for (const r of rows) {
    const match = /\/Date\((-?\d+)/.exec(r.Date);
    const ts = match ? Number(match[1]) : 0;
    if (ts < cutoff) continue;

    const acc = byQuery.get(r.Query) ?? { clicks: 0, impressions: 0, posWeighted: 0, posWeight: 0, clickPosWeighted: 0, clickWeight: 0 };
    acc.clicks += r.Clicks;
    acc.impressions += r.Impressions;
    if (r.Impressions > 0 && r.AvgImpressionPosition > 0) {
      acc.posWeighted += r.AvgImpressionPosition * r.Impressions;
      acc.posWeight += r.Impressions;
    }
    if (r.Clicks > 0 && r.AvgClickPosition > 0) {
      acc.clickPosWeighted += r.AvgClickPosition * r.Clicks;
      acc.clickWeight += r.Clicks;
    }
    byQuery.set(r.Query, acc);
  }

  return [...byQuery.entries()]
    .map(([query, a]) => ({
      query,
      clicks: a.clicks,
      impressions: a.impressions,
      avgClickPosition: a.clickWeight > 0 ? Math.round((a.clickPosWeighted / a.clickWeight) * 10) / 10 : null,
      avgImpressionPosition: a.posWeight > 0 ? Math.round((a.posWeighted / a.posWeight) * 10) / 10 : null,
    }))
    .sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions))
    .slice(0, limit);
}
