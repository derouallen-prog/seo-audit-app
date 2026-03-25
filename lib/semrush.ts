export type SemrushKeyword = {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  traffic: number;
  url: string;
};

export type SemrushResult = {
  keywords: SemrushKeyword[];
  database: string;
};

export type SemrushTopPage = {
  url: string;
  keywords: number;
  traffic: number;
};

export type SemrushDomainTopPagesResult = {
  pages: SemrushTopPage[];
  database: string;
};

export type SemrushBacklinksOverview = {
  authorityScore: number | null;
  total: number;
  referringDomains: number;
  referringIps: number;
};

export type SemrushReferringDomain = {
  domain: string;
  authorityScore: number | null;
  backlinksCount: number;
};

export type SemrushBacklinksResult = {
  overview: SemrushBacklinksOverview;
  topReferringDomains: SemrushReferringDomain[];
};

// Semrush renvoie une réponse CSV (séparateur ; lignes \r\n ou \n selon l'endpoint)
function parseSemrushCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map(line => {
    const values = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? "").trim(); });
    return row;
  });
}

async function semrushFetch(params: URLSearchParams, api = "main"): Promise<string | null> {
  const base = api === "backlinks"
    ? "https://api.semrush.com/analytics/v1/"
    : "https://api.semrush.com/";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base}?${params}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.startsWith("ERROR")) {
      console.warn("[semrush] API error:", text.slice(0, 120));
      return null;
    }
    return text;
  } catch (err) {
    clearTimeout(t);
    console.warn("[semrush] fetch error:", err);
    return null;
  }
}

export async function getSemrushUrlKeywords(
  url: string,
  apiKey: string,
  database = "fr",
  limit = 20
): Promise<SemrushResult | null> {
  const text = await semrushFetch(new URLSearchParams({
    type: "url_organic",
    key: apiKey,
    url,
    database,
    display_limit: String(limit),
    display_sort: "tr_desc",
    export_columns: "Ph,Po,Nq,Cp,Kd,Tr,Ur",
  }));
  if (!text) return null;

  const rows = parseSemrushCsv(text);
  const keywords: SemrushKeyword[] = rows
    .filter(r => r["Keyword"] && r["Position"])
    .map(r => ({
      keyword: r["Keyword"] ?? r["Ph"] ?? "",
      position: parseInt(r["Position"] ?? r["Po"] ?? "0", 10),
      searchVolume: parseInt(r["Search Volume"] ?? r["Nq"] ?? "0", 10),
      cpc: parseFloat(r["CPC"] ?? r["Cp"] ?? "0"),
      difficulty: parseInt(r["Keyword Difficulty"] ?? r["Kd"] ?? "0", 10),
      traffic: parseFloat(r["Traffic (%)"] ?? r["Tr"] ?? "0"),
      url: r["URL"] ?? r["Ur"] ?? url,
    }))
    .filter(k => k.keyword && k.position > 0);

  return { keywords, database };
}

export async function getSemrushDomainTopPages(
  domain: string,
  apiKey: string,
  database = "fr",
  limit = 10
): Promise<SemrushDomainTopPagesResult | null> {
  const text = await semrushFetch(new URLSearchParams({
    type: "domain_organic_unique",
    key: apiKey,
    domain,
    database,
    display_limit: String(limit),
    display_sort: "tr_desc",
    export_columns: "Ur,Pc,Tr",
  }));
  if (!text) return null;

  console.log("[semrush] domain_organic_unique raw (200c):", text.slice(0, 200));
  const rows = parseSemrushCsv(text);
  console.log("[semrush] domain_organic_unique rows[0]:", rows[0]);
  const pages: SemrushTopPage[] = rows
    .map(r => ({
      url: r["URL"] || r["Ur"] || "",
      keywords: parseInt(r["Keywords"] || r["Pc"] || "0", 10),
      traffic: parseFloat(r["Traffic"] || r["Tr"] || "0"),
    }))
    .filter(p => p.url);

  return { pages, database };
}

export async function getSemrushBacklinks(
  domain: string,
  apiKey: string,
  limitDomains = 10
): Promise<SemrushBacklinksResult | null> {
  const [overviewText, domainsText] = await Promise.all([
    semrushFetch(new URLSearchParams({
      type: "backlinks_overview",
      key: apiKey,
      target: domain,
      target_type: "root_domain",
      export_columns: "ascore,total,domains_num,ips_num",
    }), "backlinks"),
    semrushFetch(new URLSearchParams({
      type: "backlinks_referring_domains",
      key: apiKey,
      target: domain,
      target_type: "root_domain",
      display_limit: String(limitDomains),
      display_sort: "backlinks_num_desc",
      export_columns: "domain,ascore,backlinks_num",
    }), "backlinks"),
  ]);

  if (!overviewText) return null;

  const overviewRows = parseSemrushCsv(overviewText);
  const ov = overviewRows[0] ?? {};
  const asRaw = ov["Authority Score"] || ov["ascore"] || "";
  const overview: SemrushBacklinksOverview = {
    authorityScore: asRaw ? parseInt(asRaw, 10) : null,
    total: parseInt(ov["Backlinks"] || ov["total"] || "0", 10),
    referringDomains: parseInt(ov["Referring Domains"] || ov["domains_num"] || "0", 10),
    referringIps: parseInt(ov["Referring IPs"] || ov["ips_num"] || "0", 10),
  };

  const topReferringDomains: SemrushReferringDomain[] = domainsText
    ? parseSemrushCsv(domainsText)
        .map(r => {
          const asRawD = r["Authority Score"] || r["ascore"] || "";
          return {
            domain: r["Domain"] || r["domain"] || "",
            authorityScore: asRawD ? parseInt(asRawD, 10) : null,
            backlinksCount: parseInt(r["Backlinks"] || r["backlinks_num"] || "0", 10),
          };
        })
        .filter(d => d.domain)
    : [];

  return { overview, topReferringDomains };
}
