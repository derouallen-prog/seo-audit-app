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
  const slug = slugFromUrl(pageUrl);
  if (!slug) return null;

  const auth = makeAuthHeader(creds);
  const base = creds.storeUrl.replace(/\/$/, "");

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

  const res = await fetch(`${base}/wp-json/wp/v2/${postType}/${postId}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_title: seoTitle,
        _yoast_wpseo_metadesc: metaDescription,
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
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
