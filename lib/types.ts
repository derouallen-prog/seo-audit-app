export type Analysis = {
  status: number;
  statusText: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdDetected: boolean;
  h1Count: number;
  headings: {
    h2: number;
    h3: number;
    h4: number;
  };
  internalLinks: number;
  externalLinks: number;
  imagesMissingAlt: number;
  htmlSize: number;
  responseTimeMs: number;
  sitemapHref: string | null;
  openGraph: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
    url: string | null;
  };
  twitterCard: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  security: {
    https: boolean;
    hsts: boolean;
    xFrameOptions: string | null;
    xContentTypeOptions: string | null;
    csp: boolean;
  };
  robotsTxt?: {
    found: boolean;
    sitemapUrls: string[];
    disallowedPaths: string[];
    crawlDelay: number | null;
    blocksGooglebot: boolean;
  };
  sitemap?: {
    found: boolean;
    url: string | null;
    urlCount: number | null;
    isIndex: boolean;
  };
  recommendations: string[];
  gsc?: {
    clicks: number;
    impressions: number;
    ctr: number; // 0..1
    position: number; // average
    lastDays: number;
  };
  pagespeed?: {
    performanceScore: number | null; // 0..100
    lighthouseVersion?: string;
    metrics?: {
      fcpMs?: number;
      lcpMs?: number;
      inpMs?: number;
      cls?: number;
    };
  };
  keywords?: {
    database: string;
    keywords: {
      keyword: string;
      position: number;
      searchVolume: number;
      cpc: number;
      difficulty: number;
      traffic: number;
      url: string;
    }[];
  };
  domainTopPages?: {
    database: string;
    pages: { url: string; keywords: number; traffic: number }[];
  };
  backlinks?: {
    overview: {
      authorityScore: number | null;
      total: number;
      referringDomains: number;
      referringIps: number;
    };
    topReferringDomains: {
      domain: string;
      authorityScore: number | null;
      backlinksCount: number;
    }[];
  };
};
