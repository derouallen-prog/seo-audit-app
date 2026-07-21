// GT Metrix API v2 — https://gtmetrix.com/api/2.0/
// Auth: HTTP Basic (apiKey as username, empty password)
// Tests are async: submit → poll until complete (30–90s typical)

const GTMETRIX_BASE = "https://gtmetrix.com/api/2.0";
const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 15; // ~120s max wait

export interface GtMetrixResult {
  grade: string;           // A–F
  performanceScore: number; // 0–100
  structureScore: number;   // 0–100 (unique to GT Metrix)
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
  fullyLoadedMs: number | null;
  pageSizeBytes: number | null;
  pageRequests: number | null;
}

interface GtMetrixTestAttributes {
  status: string;
  gtmetrix_grade?: string;
  performance_score?: number;
  structure_score?: number;
  lcp?: number;
  tbt?: number;
  cls?: number;
  ttfb?: number;
  fully_loaded_duration?: number;
  page_bytes?: number;
  page_elements?: number;
}

interface GtMetrixApiResponse {
  data: { id: string; attributes: GtMetrixTestAttributes };
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function startTest(url: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${GTMETRIX_BASE}/tests`, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey),
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "test",
          attributes: { url },
        },
      }),
    });
    if (!res.ok) {
      console.warn("[gtmetrix] start test failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const d = await res.json() as GtMetrixApiResponse;
    return d.data?.id ?? null;
  } catch (e) {
    console.warn("[gtmetrix] start test error:", e);
    return null;
  }
}

async function pollTest(testId: string, apiKey: string): Promise<GtMetrixTestAttributes | null> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, i === 0 ? 15000 : POLL_INTERVAL_MS)); // first wait 15s
    try {
      const res = await fetch(`${GTMETRIX_BASE}/tests/${testId}`, {
        headers: {
          Authorization: authHeader(apiKey),
          Accept: "application/vnd.api+json",
        },
      });
      if (!res.ok) { console.warn("[gtmetrix] poll failed:", res.status); return null; }
      const d = await res.json() as GtMetrixApiResponse;
      const attrs = d.data?.attributes;
      if (!attrs) return null;
      if (attrs.status === "completed") return attrs;
      if (attrs.status === "error") { console.warn("[gtmetrix] test errored"); return null; }
      // still pending/started — continue polling
    } catch (e) {
      console.warn("[gtmetrix] poll error:", e);
      return null;
    }
  }
  console.warn("[gtmetrix] timeout after", MAX_POLLS, "polls");
  return null;
}

export async function runGtMetrix(url: string): Promise<GtMetrixResult | null> {
  const apiKey = process.env.GTMETRIX_API_KEY;
  if (!apiKey) return null;

  const testId = await startTest(url, apiKey);
  if (!testId) return null;

  console.log("[gtmetrix] test started:", testId, "for", url);
  const attrs = await pollTest(testId, apiKey);
  if (!attrs) return null;

  return {
    grade: attrs.gtmetrix_grade ?? "?",
    performanceScore: attrs.performance_score ?? 0,
    structureScore: attrs.structure_score ?? 0,
    lcpMs: attrs.lcp ?? null,
    tbtMs: attrs.tbt ?? null,
    cls: attrs.cls ?? null,
    ttfbMs: attrs.ttfb ?? null,
    fullyLoadedMs: attrs.fully_loaded_duration ?? null,
    pageSizeBytes: attrs.page_bytes ?? null,
    pageRequests: attrs.page_elements ?? null,
  };
}
