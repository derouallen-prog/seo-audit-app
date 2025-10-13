export type Analysis = {
  status: number;
  statusText: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdDetected: boolean;
  h1Count: number;
  internalLinks: number;
  externalLinks: number;
  imagesMissingAlt: number;
  htmlSize: number;
  responseTimeMs: number;
  sitemapHref: string | null;
  recommendations: string[];
};
