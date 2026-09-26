export interface StructuredDataResult {
  url: string;
  schemasFound: SchemaEntry[];
  hasProduct: boolean;
  hasBreadcrumb: boolean;
  hasFaqPage: boolean;
  hasLocalBusiness: boolean;
  hasArticle: boolean;
  hasAggregateRating: boolean;
  errors: string[];
}

export interface SchemaEntry {
  type: string;
  source: "json-ld" | "microdata";
  preview: Record<string, unknown>;
}

function safeStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function extractTypes(obj: Record<string, unknown>): string[] {
  const raw = obj["@type"];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(safeStr).filter(Boolean);
  return [safeStr(raw)].filter(Boolean);
}

function buildPreview(obj: Record<string, unknown>, types: string[]): Record<string, unknown> {
  const preview: Record<string, unknown> = { "@type": types.length === 1 ? types[0] : types };
  const INTERESTING = ["name", "description", "url", "image", "price", "priceCurrency",
    "aggregateRating", "ratingValue", "reviewCount", "ratingCount",
    "author", "datePublished", "headline", "address", "telephone",
    "openingHours", "geo"];
  for (const k of INTERESTING) {
    if (k in obj) {
      const v = obj[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const nested = v as Record<string, unknown>;
        preview[k] = Object.fromEntries(Object.entries(nested).slice(0, 3));
      } else if (Array.isArray(v)) {
        preview[k] = (v as unknown[]).slice(0, 2);
      } else {
        preview[k] = v;
      }
    }
  }
  return preview;
}

function parseJsonLdBlock(text: string): SchemaEntry[] {
  try {
    const parsed = JSON.parse(text);
    const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
    const entries: SchemaEntry[] = [];
    for (const item of items) {
      if (typeof item !== "object" || !item) continue;
      const obj = item as Record<string, unknown>;
      // Handle @graph
      if (Array.isArray(obj["@graph"])) {
        for (const node of obj["@graph"] as unknown[]) {
          if (typeof node !== "object" || !node) continue;
          const n = node as Record<string, unknown>;
          const types = extractTypes(n);
          if (!types.length) continue;
          entries.push({ type: types.join("|"), source: "json-ld", preview: buildPreview(n, types) });
        }
      } else {
        const types = extractTypes(obj);
        if (!types.length) continue;
        entries.push({ type: types.join("|"), source: "json-ld", preview: buildPreview(obj, types) });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export async function checkStructuredData(url: string): Promise<StructuredDataResult> {
  const result: StructuredDataResult = {
    url,
    schemasFound: [],
    hasProduct: false,
    hasBreadcrumb: false,
    hasFaqPage: false,
    hasLocalBusiness: false,
    hasArticle: false,
    hasAggregateRating: false,
    errors: [],
  };

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMindBot/1.0)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      result.errors.push(`HTTP ${res.status}`);
      return result;
    }
    html = await res.text();
  } catch (e) {
    result.errors.push(`Fetch error: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }

  // Extract JSON-LD blocks
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    const entries = parseJsonLdBlock(match[1]!.trim());
    result.schemasFound.push(...entries);
  }

  // Classify found schemas
  for (const s of result.schemasFound) {
    const types = s.type.toLowerCase();
    if (types.includes("product")) result.hasProduct = true;
    if (types.includes("breadcrumb")) result.hasBreadcrumb = true;
    if (types.includes("faqpage")) result.hasFaqPage = true;
    if (types.includes("localbusiness") || types.includes("store") || types.includes("restaurant")) result.hasLocalBusiness = true;
    if (types.includes("article") || types.includes("blogposting") || types.includes("newsarticle")) result.hasArticle = true;
    if (types.includes("aggregaterating")) result.hasAggregateRating = true;
    // Check nested AggregateRating
    const preview = s.preview as Record<string, unknown>;
    if (preview.aggregateRating) result.hasAggregateRating = true;
  }

  return result;
}
