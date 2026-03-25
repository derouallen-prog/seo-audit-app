export type PageSpeedResult = {
  performanceScore: number | null;
  lighthouseVersion?: string;
  metrics?: { fcpMs?: number; lcpMs?: number; inpMs?: number; cls?: number };
};

export async function runPageSpeed(url: string, apiKey?: string): Promise<PageSpeedResult | null> {
  try {
    const u = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    u.searchParams.set("url", url);
    if (apiKey) u.searchParams.set("key", apiKey);
    // strategy can be 'mobile' or 'desktop'; default keeps API flexible
    u.searchParams.set("strategy", "mobile");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(u.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json: any = await res.json();

    const categories = json?.lighthouseResult?.categories;
    const perf = categories?.performance?.score;
    const version = json?.lighthouseResult?.lighthouseVersion as string | undefined;
    const audits = json?.lighthouseResult?.audits;

    const ms = (v: any): number | undefined => (typeof v === "number" ? v : undefined);
    const fromAudit = (id: string) => audits?.[id]?.numericValue;

    const fcpMs = ms(fromAudit("first-contentful-paint"));
    const lcpMs = ms(fromAudit("largest-contentful-paint"));
    const inpMs = ms(fromAudit("interactive")) ?? ms(fromAudit("experimental-interaction-to-next-paint"));
    const cls = typeof audits?.["cumulative-layout-shift"]?.numericValue === "number"
      ? (audits["cumulative-layout-shift"].numericValue as number)
      : undefined;

    return {
      performanceScore: typeof perf === "number" ? Math.round(perf * 100) : null,
      lighthouseVersion: version,
      metrics: { fcpMs, lcpMs, inpMs, cls }
    };
  } catch {
    return null;
  }
}

