import { google } from "googleapis";

type GscSummary = {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number; // average
};

function readServiceAccountFromEnv(): {
  client_email: string;
  private_key: string;
} | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    return {
      client_email: json.client_email,
      private_key: json.private_key,
    };
  } catch {
    return null;
  }
}

export async function getGscPageMetrics(property: string, pageUrl: string, lastDays = 28): Promise<GscSummary | null> {
  const creds = readServiceAccountFromEnv();
  if (!creds) return null;

  // Service account must be added as a user of the property in Search Console
  const scopes = ["https://www.googleapis.com/auth/webmasters.readonly"];
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  });

  const searchconsole = google.searchconsole({ version: "v1", auth: jwt });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - lastDays);

  const res = await searchconsole.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["page"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "page",
              operator: "equals",
              expression: pageUrl,
            },
          ],
        },
      ],
      rowLimit: 1,
    },
  });

  // Type guards since googleapis types can be broad
  const row = (res as any)?.data?.rows?.[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  };
}
