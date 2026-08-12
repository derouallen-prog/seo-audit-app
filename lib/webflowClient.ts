export interface WebflowSite {
  id: string;
  displayName: string;
  shortName: string;
  previewUrl?: string;
  lastPublished?: string;
  customDomains?: { url: string }[];
}

export interface WebflowCollection {
  id: string;
  displayName: string;
  singularName: string;
  slug: string;
  createdOn: string;
  lastUpdated: string;
}

export interface WebflowItem {
  id: string;
  cmsLocaleId?: string;
  lastPublished?: string;
  lastUpdated?: string;
  createdOn?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: Record<string, unknown>;
}

const BASE = "https://api.webflow.com/v2";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function wf<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webflow API ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function listSiteDomains(token: string, siteId: string): Promise<string[]> {
  try {
    const data = await wf<{ domains: { url: string }[] }>(token, `/sites/${siteId}/domains`);
    return (data.domains ?? []).map((d) => d.url).filter(Boolean);
  } catch {
    return [];
  }
}

export async function listSites(token: string): Promise<WebflowSite[]> {
  const data = await wf<{ sites: WebflowSite[] }>(token, "/sites");
  const sites = data.sites ?? [];

  // Enrichit chaque site avec ses domaines de production
  const enriched = await Promise.all(
    sites.map(async (site) => {
      const domains = await listSiteDomains(token, site.id);
      return { ...site, customDomains: domains.map((url) => ({ url })) };
    })
  );

  return enriched;
}

export async function listCollections(token: string, siteId: string): Promise<WebflowCollection[]> {
  const data = await wf<{ collections: WebflowCollection[] }>(token, `/sites/${siteId}/collections`);
  return data.collections ?? [];
}

export async function listItems(
  token: string,
  collectionId: string,
  limit = 20,
  offset = 0
): Promise<{ items: WebflowItem[]; total: number }> {
  const data = await wf<{ items: WebflowItem[]; pagination: { total: number } }>(
    token,
    `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`
  );
  return { items: data.items ?? [], total: data.pagination?.total ?? 0 };
}

export async function createItem(
  token: string,
  collectionId: string,
  fieldData: Record<string, unknown>,
  isDraft = false
): Promise<WebflowItem> {
  return wf<WebflowItem>(token, `/collections/${collectionId}/items`, {
    method: "POST",
    body: JSON.stringify({ fieldData, isDraft }),
  });
}

export async function updateItem(
  token: string,
  collectionId: string,
  itemId: string,
  fieldData: Record<string, unknown>
): Promise<WebflowItem> {
  return wf<WebflowItem>(token, `/collections/${collectionId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ fieldData }),
  });
}

export async function publishItem(token: string, collectionId: string, itemId: string): Promise<void> {
  await wf(token, `/collections/${collectionId}/items/${itemId}/live`, { method: "PUT" });
}

export function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  return fetch("https://api.webflow.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.WEBFLOW_CLIENT_ID,
      client_secret: process.env.WEBFLOW_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
    return r.json() as Promise<{ access_token: string }>;
  });
}
