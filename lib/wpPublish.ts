export interface WpCredentials {
  storeUrl: string;
  wpUsername: string;
  wpAppPassword: string;
}

export interface WpDraftPostParams {
  title: string;
  contentHtml: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface WpPublishResult {
  id: number;
  link: string;
  editUrl: string;
}

function wpBasicAuth(username: string, appPassword: string): string {
  // Application passwords can contain spaces — keep as-is for the header
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

async function createWpContent(
  creds: WpCredentials,
  type: "posts" | "pages",
  p: WpDraftPostParams
): Promise<WpPublishResult> {
  const base = creds.storeUrl.replace(/\/$/, "");

  const body: Record<string, unknown> = {
    title: p.title,
    content: p.contentHtml,
    status: "draft",
  };
  if (p.excerpt) body.excerpt = p.excerpt;

  if (p.metaTitle || p.metaDescription) {
    body.meta = {
      ...(p.metaTitle ? { _yoast_wpseo_title: p.metaTitle } : {}),
      ...(p.metaDescription ? { _yoast_wpseo_metadesc: p.metaDescription } : {}),
    };
  }

  const res = await fetch(`${base}/wp-json/wp/v2/${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": wpBasicAuth(creds.wpUsername, creds.wpAppPassword),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WordPress REST API (${type}) ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    link: data.link,
    editUrl: `${base}/wp-admin/post.php?post=${data.id}&action=edit`,
  };
}

export async function createDraftPost(
  creds: WpCredentials,
  p: WpDraftPostParams
): Promise<WpPublishResult> {
  return createWpContent(creds, "posts", p);
}

export async function createDraftPage(
  creds: WpCredentials,
  p: WpDraftPostParams
): Promise<WpPublishResult> {
  return createWpContent(creds, "pages", p);
}
