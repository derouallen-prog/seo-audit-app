export type RobotsTxtResult = {
  found: boolean;
  raw: string | null;
  sitemapUrls: string[];
  disallowedPaths: string[];
  crawlDelay: number | null;
  blocksGooglebot: boolean;
};

export type SitemapResult = {
  found: boolean;
  url: string | null;
  urlCount: number | null; // null if unparseable
  isIndex: boolean; // true if sitemap index (multiple sitemaps)
};

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "SEO-Audit-App/0.1" },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function analyzeRobotsTxt(origin: string): Promise<RobotsTxtResult> {
  const url = `${origin}/robots.txt`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { found: false, raw: null, sitemapUrls: [], disallowedPaths: [], crawlDelay: null, blocksGooglebot: false };
    }
    const raw = await res.text();
    const lines = raw.split("\n").map(l => l.trim());

    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];
    let crawlDelay: number | null = null;
    let currentAgent = "*";
    let blocksGooglebot = false;

    for (const line of lines) {
      if (line.startsWith("#") || !line) continue;
      const [key, ...rest] = line.split(":");
      if (!key) continue;
      const value = rest.join(":").trim();

      if (key.toLowerCase() === "user-agent") {
        currentAgent = value.toLowerCase();
      } else if (key.toLowerCase() === "disallow") {
        if (value && (currentAgent === "*" || currentAgent === "googlebot")) {
          disallowedPaths.push(value);
          if (value === "/") blocksGooglebot = true;
        }
      } else if (key.toLowerCase() === "crawl-delay") {
        const d = parseFloat(value);
        if (!isNaN(d)) crawlDelay = d;
      } else if (key.toLowerCase() === "sitemap") {
        if (value) sitemapUrls.push(value);
      }
    }

    return { found: true, raw, sitemapUrls, disallowedPaths, crawlDelay, blocksGooglebot };
  } catch {
    return { found: false, raw: null, sitemapUrls: [], disallowedPaths: [], crawlDelay: null, blocksGooglebot: false };
  }
}

export async function analyzeSitemap(origin: string, sitemapUrlsFromRobots: string[]): Promise<SitemapResult> {
  // Try sitemap URLs from robots.txt first, then fall back to common paths
  const candidates = [
    ...sitemapUrlsFromRobots,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const xml = await res.text();

      // Count URLs
      const urlMatches = xml.match(/<loc>/g);
      const urlCount = urlMatches ? urlMatches.length : 0;
      const isIndex = xml.includes("<sitemapindex");

      return { found: true, url, urlCount, isIndex };
    } catch {
      continue;
    }
  }

  return { found: false, url: null, urlCount: null, isIndex: false };
}
