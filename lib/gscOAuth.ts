import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

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
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
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
  return data as GscConnectionRow;
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
