import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { encryptToken, decryptToken } from "./tokenCrypto";

const TABLE = "gsc_connections";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface GscTokens {
  accessToken: string;
  refreshToken: string | null;
  expiry: string; // ISO
  scope: string | null;
}

interface GscConnectionRow {
  session_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry: string;
  scope: string | null;
}

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function saveGscConnection(sessionId: string, tokens: GscTokens): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase non configuré");
  const { error } = await supabase.from(TABLE).upsert(
    {
      session_id: sessionId,
      access_token: encryptToken(tokens.accessToken),
      refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      expiry: tokens.expiry,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
  if (error) throw new Error(error.message);
}

export async function getGscConnection(sessionId: string): Promise<GscConnectionRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select("*").eq("session_id", sessionId).maybeSingle();
  if (error || !data) return null;
  const row = data as GscConnectionRow;
  return {
    ...row,
    access_token: decryptToken(row.access_token),
    refresh_token: row.refresh_token ? decryptToken(row.refresh_token) : null,
  };
}

export async function deleteGscConnection(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from(TABLE).delete().eq("session_id", sessionId);
}

export async function getValidAccessToken(sessionId: string): Promise<string | null> {
  const conn = await getGscConnection(sessionId);
  if (!conn) return null;

  const expiryMs = new Date(conn.expiry).getTime();
  if (expiryMs - Date.now() > 60_000) {
    return conn.access_token;
  }

  if (!conn.refresh_token) return null;

  const oauth2Client = getGoogleOAuthClient();
  if (!oauth2Client) return null;
  oauth2Client.setCredentials({ refresh_token: conn.refresh_token });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) return null;
    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600_000).toISOString();
    await saveGscConnection(sessionId, {
      accessToken: credentials.access_token,
      refreshToken: conn.refresh_token,
      expiry: newExpiry,
      scope: conn.scope,
    });
    return credentials.access_token;
  } catch (err) {
    console.warn("[gscOAuth] refresh failed:", err);
    return null;
  }
}

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });
  const res = await searchconsole.sites.list();
  return (res.data.siteEntry || []).map(s => ({
    siteUrl: s.siteUrl || "",
    permissionLevel: s.permissionLevel || "",
  })).filter(s => s.siteUrl);
}

export interface GscSiteMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getGscSiteMetrics(accessToken: string, siteUrl: string, days = 28): Promise<GscSiteMetrics> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: [],
      rowLimit: 1,
    },
  });

  const row = res.data.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getGscTopQueries(accessToken: string, siteUrl: string, days = 28, limit = 10): Promise<GscQueryRow[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query"],
      rowLimit: limit,
    },
  });

  return (res.data.rows || []).map(r => ({
    query: r.keys?.[0] || "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

export interface GscDimensionRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getGscByDimension(
  accessToken: string,
  siteUrl: string,
  dimension: "page" | "device" | "country",
  days = 28,
  limit = 10
): Promise<GscDimensionRow[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: [dimension],
      rowLimit: limit,
    },
  });

  return (res.data.rows || []).map(r => ({
    key: r.keys?.[0] || "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

export interface GscQueryPageRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getGscQueriesWithPages(accessToken: string, siteUrl: string, days = 28, limit = 50): Promise<GscQueryPageRow[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query", "page"],
      rowLimit: limit,
    },
  });

  return (res.data.rows || []).map(r => ({
    query: r.keys?.[0] || "",
    page: r.keys?.[1] || "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/**
 * Récupère toutes les requêtes (+ pages associées) contenant un terme donné,
 * via le filtre natif GSC plutôt qu'un simple top N global — indispensable
 * pour les thématiques de niche qui n'apparaissent pas dans le top clics du site.
 */
export async function getGscQueriesByTopic(
  accessToken: string,
  siteUrl: string,
  topic: string,
  days = 28,
  limit = 100
): Promise<GscQueryPageRow[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query", "page"],
      dimensionFilterGroups: [
        {
          filters: [
            { dimension: "query", operator: "contains", expression: topic },
          ],
        },
      ],
      rowLimit: limit,
    },
  });

  return (res.data.rows || []).map(r => ({
    query: r.keys?.[0] || "",
    page: r.keys?.[1] || "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/**
 * Comme getGscQueriesByTopic, mais interroge plusieurs variantes/synonymes
 * en parallèle et fusionne les résultats (dédupliqués par requête+page).
 * Le filtre GSC "contains" est une recherche littérale de sous-chaîne, donc
 * une seule variante ("super-aliment") peut manquer toutes les requêtes
 * réelles ("superfoods", "super foods", "superaliments liste"...) — fournir
 * plusieurs variantes/traductions/singulier-pluriel compense cette limite.
 */
export async function getGscQueriesByTopics(
  accessToken: string,
  siteUrl: string,
  topics: string[],
  days = 28,
  limitPerTopic = 50
): Promise<GscQueryPageRow[]> {
  const uniqueTopics = [...new Set(topics.map(t => t.trim()).filter(Boolean))];
  if (uniqueTopics.length === 0) return [];

  const resultsArrays = await Promise.all(
    uniqueTopics.map(topic => getGscQueriesByTopic(accessToken, siteUrl, topic, days, limitPerTopic))
  );

  const seen = new Set<string>();
  const merged: GscQueryPageRow[] = [];
  for (const row of resultsArrays.flat()) {
    const key = `${row.query}|||${row.page}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(row);
    }
  }
  return merged;
}

/**
 * Requêtes + pages filtrées par un ou plusieurs patterns (OR natif côté GSC).
 * Une seule requête API quelle que soit la taille de la liste de patterns —
 * idéal pour les requêtes d'intention (interrogatives, commerciales, etc.)
 * sans multiplier les appels API.
 */
export async function getGscQueriesByPatterns(
  accessToken: string,
  siteUrl: string,
  patterns: string[],
  days = 28,
  limit = 150
): Promise<GscQueryPageRow[]> {
  const unique = [...new Set(patterns.map(p => p.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query", "page"],
      dimensionFilterGroups: [
        {
          groupType: "or",
          filters: unique.map(expr => ({
            dimension: "query",
            operator: "contains",
            expression: expr,
          })),
        },
      ],
      rowLimit: limit,
      dataState: "all",
    },
  });

  return (res.data.rows || []).map(r => ({
    query: r.keys?.[0] || "",
    page: r.keys?.[1] || "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

// ── Listes de patterns par type d'intention ────────────────────────────────

export const GSC_INTENT_PATTERNS: Record<string, string[]> = {
  /**
   * Requêtes interrogatives — questions des internautes.
   * Idéales pour les FAQ, le GEO, et les featured snippets.
   */
  interrogative: [
    "comment", "quoi", "pourquoi", "qui ", "où ", "quand",
    "quel ", "quelle ", "quels ", "quelles ",
    "est-ce que", "est-ce qu", "peut-on", "faut-il",
    "y a-t-il", "qu'est-ce", "c'est quoi", "kesako",
    "how ", "what ", "why ", "when ", "where ", "who ", "which ",
    "is there", "can i", "do i need", "should i",
  ],
  /**
   * Requêtes commerciales / transactionnelles — intention d'achat.
   */
  commercial: [
    "prix", "tarif", "acheter", "achat", "commander", "commande",
    "meilleur", "comparatif", "comparaison", "avis", "test ",
    " vs ", "alternative", "pas cher", "promo", "promotion",
    "solde", "discount", "offre", "devis", "gratuit",
    "buy", "price", "best ", "review", "cheap", "order",
  ],
  /**
   * Requêtes navigationnelles — l'utilisateur cherche un site/marque précis.
   */
  navigational: [
    "site ", "officiel", "connexion", "login", "mon compte",
    "contact ", "téléphone", "adresse", "horaires",
    "espace client", "se connecter",
  ],
  /**
   * Requêtes locales — avec intention géographique.
   */
  local: [
    "près de", "autour de", " paris", " lyon", " marseille",
    " bordeaux", " toulouse", " nantes", " strasbourg", " lille",
    "dans ma ville", "dans mon quartier",
    "near me", "nearby",
  ],
};
