export type SeoPlugin = "yoast" | "rankmath" | "aioseo" | "seopress" | "unknown";
export type SeoCompatStatus = "compatible_direct" | "needs_connector_plugin" | "seo_not_detected" | "unchecked" | "checking";

interface WpCreds {
  storeUrl: string;
  wpUsername: string;
  wpAppPassword: string;
}

function authHeader({ wpUsername, wpAppPassword }: WpCreds): string {
  return "Basic " + Buffer.from(`${wpUsername}:${wpAppPassword}`).toString("base64");
}

// ── SEO plugin detection ───────────────────────────────────────────────────────

const SEO_NAMESPACES: Record<string, SeoPlugin> = {
  "yoast/v1": "yoast",
  "rankmath/v1": "rankmath",
  "aioseo/v1": "aioseo",
  "seopress/v1": "seopress",
};

const SEO_META_FIELDS: Record<SeoPlugin, string> = {
  yoast: "_yoast_wpseo_title",
  rankmath: "rank_math_title",
  aioseo: "_aioseo_title",
  seopress: "_seopress_titles_title",
  unknown: "_yoast_wpseo_title", // try yoast as default
};

export async function detectSeoPlugin(creds: WpCreds): Promise<SeoPlugin> {
  try {
    const base = creds.storeUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/wp-json`, {
      headers: { Authorization: authHeader(creds) },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "unknown";

    const data = await res.json() as { namespaces?: string[] };
    const namespaces = data.namespaces ?? [];

    for (const [ns, plugin] of Object.entries(SEO_NAMESPACES)) {
      if (namespaces.includes(ns)) return plugin;
    }
  } catch { /* ignore */ }
  return "unknown";
}

// ── Find a post to test on ─────────────────────────────────────────────────────

async function findTestPostId(
  creds: WpCreds,
  postType: "posts" | "pages"
): Promise<number | null> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const auth = authHeader(creds);

  for (const status of ["publish", "draft"]) {
    try {
      const res = await fetch(
        `${base}/wp-json/wp/v2/${postType}?per_page=1&status=${status}&_fields=id`,
        { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json() as Array<{ id: number }>;
      if (data.length > 0 && data[0]) return data[0].id;
    } catch { /* ignore */ }
  }
  return null;
}

// ── Compatibility test ─────────────────────────────────────────────────────────

export interface CompatCheckResult {
  plugin: SeoPlugin;
  status: SeoCompatStatus;
  aioSeoRestDisabled?: boolean;
}

export async function runCompatCheck(creds: WpCreds): Promise<CompatCheckResult> {
  const plugin = await detectSeoPlugin(creds);

  if (plugin === "unknown") {
    return { plugin, status: "seo_not_detected" };
  }

  const metaKey = SEO_META_FIELDS[plugin];
  const base = creds.storeUrl.replace(/\/$/, "");
  const auth = authHeader(creds);

  // Find a post or page to test on
  let postId: number | null = null;
  let postType: "posts" | "pages" = "posts";

  postId = await findTestPostId(creds, "posts");
  if (!postId) {
    postId = await findTestPostId(creds, "pages");
    if (postId) postType = "pages";
  }

  if (!postId) {
    // No content to test on — can't determine compat
    return { plugin, status: "seo_not_detected" };
  }

  const testValue = `__searchmind_compat_${Date.now()}`;

  // 1. Read current value to restore later
  let originalValue = "";
  try {
    const readRes = await fetch(
      `${base}/wp-json/wp/v2/${postType}/${postId}?_fields=id,meta`,
      { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) }
    );
    if (readRes.ok) {
      const readData = await readRes.json() as { meta?: Record<string, unknown> };
      originalValue = (readData.meta?.[metaKey] as string) ?? "";
    }
  } catch { /* ignore */ }

  // 2. Write test value
  try {
    const patchRes = await fetch(`${base}/wp-json/wp/v2/${postType}/${postId}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { [metaKey]: testValue } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!patchRes.ok) {
      // AIOSEO returns 400 when REST is disabled
      const aioSeoRestDisabled = plugin === "aioseo" && patchRes.status === 400;
      return { plugin, status: "needs_connector_plugin", aioSeoRestDisabled };
    }
  } catch {
    return { plugin, status: "needs_connector_plugin" };
  }

  // 3. Read back to verify persistence (200 OK doesn't guarantee the field was saved)
  let persisted = false;
  try {
    const verifyRes = await fetch(
      `${base}/wp-json/wp/v2/${postType}/${postId}?_fields=id,meta`,
      { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) }
    );
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json() as { meta?: Record<string, unknown> };
      persisted = verifyData.meta?.[metaKey] === testValue;
    }
  } catch { /* ignore */ }

  // 4. Restore original value
  try {
    await fetch(`${base}/wp-json/wp/v2/${postType}/${postId}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { [metaKey]: originalValue } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* ignore — cleanup is best-effort */ }

  return {
    plugin,
    status: persisted ? "compatible_direct" : "needs_connector_plugin",
  };
}
