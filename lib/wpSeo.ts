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

  // Homepage: slug empty → resolve via wp/v2/settings page_on_front
  if (!slug) {
    const settingsRes = await fetch(`${base}/wp-json/wp/v2/settings`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });
    if (settingsRes.ok) {
      const settings = await settingsRes.json() as { page_on_front?: number };
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

// ── XML-RPC helpers ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlRpcValue(v: string | number | boolean): string {
  if (typeof v === "boolean") return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  if (typeof v === "number") return `<value><int>${v}</int></value>`;
  return `<value><string>${escapeXml(v)}</string></value>`;
}

// Extract text content between two XML tags (first match)
function xmlFirst(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, "s").exec(xml);
  return m?.[1]?.trim() ?? "";
}

// Parse custom_fields from a wp.getPost XML-RPC response
function parseXmlRpcCustomFields(xml: string): Array<{ id: number; key: string; value: string }> {
  const fields: Array<{ id: number; key: string; value: string }> = [];
  // Extract the array content after the "custom_fields" member
  const cfBlock = /<name>custom_fields<\/name>.*?<array>(.*?)<\/array>/s.exec(xml)?.[1] ?? "";
  const structRe = /<struct>(.*?)<\/struct>/gs;
  let sm: RegExpExecArray | null;
  while ((sm = structRe.exec(cfBlock)) !== null) {
    const body = sm[1] ?? "";
    const get = (n: string) => {
      const m = new RegExp(`<name>${n}</name>\\s*<value>(?:<(?:int|string)>)?(.*?)(?:</(?:int|string)>)?</value>`, "s").exec(body);
      return m?.[1]?.trim() ?? "";
    };
    const id = parseInt(get("id") || "0", 10);
    const key = get("key");
    const value = get("value");
    if (key) fields.push({ id, key, value });
  }
  return fields;
}

async function updateYoastMetaViaXmlRpc(
  creds: WpCreds,
  postId: number,
  seoTitle: string,
  metaDescription: string
): Promise<void> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const xmlrpcUrl = `${base}/xmlrpc.php`;
  const signal = AbortSignal.timeout(15000);
  const headers = { "Content-Type": "text/xml; charset=utf-8" };

  // Step 1 — read existing custom_fields to get meta IDs (needed for update vs create)
  const getBody = `<?xml version="1.0"?>
<methodCall><methodName>wp.getPost</methodName><params>
${xmlRpcValue(1)}
${xmlRpcValue(creds.wpUsername)}
${xmlRpcValue(creds.wpAppPassword)}
${xmlRpcValue(postId)}
<param><value><array><data><value><string>custom_fields</string></value></data></array></value></param>
</params></methodCall>`;

  const getRes = await fetch(xmlrpcUrl, { method: "POST", headers, body: getBody, signal });
  if (!getRes.ok) throw new Error(`XML-RPC HTTP ${getRes.status}`);
  const getXml = await getRes.text();
  if (getXml.includes("<fault>")) {
    throw new Error(`XML-RPC fault: ${xmlFirst(getXml, "string")}`);
  }

  const existing = parseXmlRpcCustomFields(getXml);

  // Step 2 — build custom_fields payload: update if ID found, create otherwise
  const yoastUpdates = [
    { key: "_yoast_wpseo_title", value: seoTitle },
    { key: "_yoast_wpseo_metadesc", value: metaDescription },
  ];

  const cfXml = yoastUpdates.map(({ key, value }) => {
    const found = existing.find(f => f.key === key);
    const idMember = found
      ? `<member><name>id</name><value><int>${found.id}</int></value></member>`
      : "";
    return `<value><struct>
${idMember}
<member><name>key</name><value><string>${escapeXml(key)}</string></value></member>
<member><name>value</name><value><string>${escapeXml(value)}</string></value></member>
</struct></value>`;
  }).join("\n");

  const editBody = `<?xml version="1.0"?>
<methodCall><methodName>wp.editPost</methodName><params>
${xmlRpcValue(1)}
${xmlRpcValue(creds.wpUsername)}
${xmlRpcValue(creds.wpAppPassword)}
${xmlRpcValue(postId)}
<param><value><struct>
<member><name>custom_fields</name>
<value><array><data>${cfXml}</data></array></value>
</member>
</struct></value></param>
</params></methodCall>`;

  const editRes = await fetch(xmlrpcUrl, { method: "POST", headers, body: editBody, signal });
  if (!editRes.ok) throw new Error(`XML-RPC edit HTTP ${editRes.status}`);
  const editXml = await editRes.text();
  if (editXml.includes("<fault>")) {
    throw new Error(`XML-RPC edit fault: ${xmlFirst(editXml, "string")}`);
  }
  if (!editXml.includes("<boolean>1</boolean>")) {
    throw new Error("XML-RPC wp.editPost a retourné false");
  }

  // Step 3 — after XML-RPC write, touch the post via REST to trigger Yoast indexable rebuild
  // (Yoast rebuilds its indexable cache on save_post, which REST update also fires)
  const auth = makeAuthHeader(creds);
  const postType = "pages"; // works for both posts/pages since we only touch meta
  await fetch(`${base}/wp-json/wp/v2/pages/${postId}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({}), // empty body = touch → fires save_post hooks
    signal: AbortSignal.timeout(10000),
  }).catch(() => {/* ignore — indexable rebuild is best-effort */});
}

async function updateYoastMetaViaRest(
  creds: WpCreds,
  postId: number,
  postType: "posts" | "pages",
  seoTitle: string,
  metaDescription: string
): Promise<void> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const auth = makeAuthHeader(creds);

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

  // Verify: WP REST silently ignores writes to protected meta not registered show_in_rest
  const verifyRes = await fetch(
    `${base}/wp-json/wp/v2/${postType}/${postId}?_fields=id,meta`,
    { headers: { Authorization: auth }, signal: AbortSignal.timeout(10000) }
  );
  if (!verifyRes.ok) return; // can't verify, assume ok

  const data = await verifyRes.json() as { meta?: Record<string, unknown> };
  const metaObj = data.meta ?? {};
  const titleInResponse = "_yoast_wpseo_title" in metaObj;
  const descInResponse = "_yoast_wpseo_metadesc" in metaObj;

  if (!titleInResponse && !descInResponse) {
    throw new Error("YOAST_REST_NOT_REGISTERED");
  }
}

export async function updateYoastMeta(
  creds: WpCreds,
  postId: number,
  postType: "posts" | "pages",
  seoTitle: string,
  metaDescription: string
): Promise<{ method: "rest" | "xmlrpc" }> {
  try {
    await updateYoastMetaViaRest(creds, postId, postType, seoTitle, metaDescription);
    return { method: "rest" };
  } catch (e) {
    if (e instanceof Error && e.message === "YOAST_REST_NOT_REGISTERED") {
      // REST meta not registered → fall back to XML-RPC (bypasses show_in_rest)
      await updateYoastMetaViaXmlRpc(creds, postId, seoTitle, metaDescription);
      return { method: "xmlrpc" };
    }
    throw e;
  }
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

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
