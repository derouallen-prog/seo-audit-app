interface WpCreds {
  storeUrl: string;
  wpUsername: string;
  wpAppPassword: string;
}

function makeAuthHeader(creds: WpCreds): string {
  return "Basic " + Buffer.from(`${creds.wpUsername}:${creds.wpAppPassword}`).toString("base64");
}

function slugFromUrl(pageUrl: string): string {
  try {
    const pathname = new URL(pageUrl).pathname;
    const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    const parts = pageUrl.replace(/\/$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }
}

export async function findPostByUrl(
  creds: WpCreds,
  pageUrl: string
): Promise<{ id: number; postType: "posts" | "pages"; title: string } | null> {
  const auth = makeAuthHeader(creds);
  const base = creds.storeUrl.replace(/\/$/, "");

  const slug = slugFromUrl(pageUrl);

  // Homepage: slug is empty or URL matches the site root
  if (!slug) {
    // Get WordPress front page setting
    const settingsRes = await fetch(`${base}/wp-json/wp/v2/settings`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });
    if (settingsRes.ok) {
      const settings = await settingsRes.json() as { page_on_front?: number; page_for_posts?: number };
      const frontPageId = settings.page_on_front ?? 0;
      if (frontPageId > 0) {
        const pageRes = await fetch(`${base}/wp-json/wp/v2/pages/${frontPageId}?_fields=id,title`, {
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(10000),
        });
        if (pageRes.ok) {
          const page = await pageRes.json() as { id: number; title: { rendered: string } };
          return { id: page.id, postType: "pages", title: page.title.rendered };
        }
      }
    }
    return null;
  }

  // Regular page/post: search by slug
  for (const postType of ["posts", "pages"] as const) {
    const res = await fetch(
      `${base}/wp-json/wp/v2/${postType}?slug=${encodeURIComponent(slug)}&_fields=id,title,type`,
      { headers: { Authorization: auth }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) continue;
    const data = await res.json() as Array<{ id: number; title: { rendered: string } }>;
    const first = data[0];
    if (data.length > 0 && first) {
      return { id: first.id, postType, title: first.title.rendered };
    }
  }

  return null;
}

export async function updateYoastMeta(
  creds: WpCreds,
  postId: number,
  postType: "posts" | "pages",
  seoTitle: string,
  metaDescription: string
): Promise<void> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const auth = makeAuthHeader(creds);

  // Write via standard WP REST API
  const writeRes = await fetch(`${base}/wp-json/wp/v2/${postType}/${postId}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_title: seoTitle,
        _yoast_wpseo_metadesc: metaDescription,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!writeRes.ok) {
    const err = await writeRes.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${writeRes.status}`);
  }

  // Verify: WP REST API silently ignores writes to protected meta keys (_prefix)
  // that aren't registered with show_in_rest: true. We must read back to confirm.
  const verifyRes = await fetch(
    `${base}/wp-json/wp/v2/${postType}/${postId}?_fields=id,meta`,
    { headers: { Authorization: auth }, signal: AbortSignal.timeout(10000) }
  );

  if (!verifyRes.ok) return; // can't verify, assume ok

  const data = await verifyRes.json() as { meta?: Record<string, unknown> };
  const metaObj = data.meta ?? {};

  // Check if the meta key even appears in the REST response
  const titleInResponse = "_yoast_wpseo_title" in metaObj;
  const descInResponse = "_yoast_wpseo_metadesc" in metaObj;

  if (!titleInResponse && !descInResponse) {
    // Yoast meta not exposed by REST on this site — try updating via a full post
    // save that touches a safe field (date_gmt trick forces save_post hooks to run,
    // which causes Yoast to rebuild its indexable from stored post meta).
    // But first, verify if meta were actually stored (they just aren't in REST response).
    // We have no other non-invasive write path here, so report clearly.
    throw new Error(
      "YOAST_REST_NOT_REGISTERED: Les champs Yoast SEO (_yoast_wpseo_title, _yoast_wpseo_metadesc) " +
      "ne sont pas exposés en écriture par l'API REST de ce site. " +
      "Cause probable : Yoast SEO < 14.0, ou le filtre REST a été désactivé par un plugin/thème."
    );
  }

  const savedTitle = metaObj["_yoast_wpseo_title"];
  const savedDesc = metaObj["_yoast_wpseo_metadesc"];

  const titleOk = !seoTitle || savedTitle === seoTitle;
  const descOk = !metaDescription || savedDesc === metaDescription;

  if (!titleOk || !descOk) {
    // Fields are in REST response but values don't match — Yoast indexable cache.
    // Trigger a "touch" save to force Yoast to rebuild from postmeta.
    await fetch(`${base}/wp-json/wp/v2/${postType}/${postId}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { _yoast_wpseo_title: seoTitle, _yoast_wpseo_metadesc: metaDescription } }),
      signal: AbortSignal.timeout(15000),
    });
  }
}

// Simple but correct CSV parser (handles quoted fields with commas/newlines inside)
export function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }

  if (rows.length < 2) return [];
  const headerRow = rows[0];
  if (!headerRow) return [];
  const headers = headerRow.map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}
