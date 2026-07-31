import { WcCredentials } from "./woocommerce";

export interface AcfRepeater {
  type: "repeater";
  fieldKey: string;
  subFields: string[];
  currentCount: number;
}

export interface AcfSimpleField {
  type: "simple";
  fieldKey: string;
  sampleValue?: string;
}

export interface WcSiteProfile {
  analyzedAt: string;
  plugins: ("acf" | "yoast" | "rankmath" | "woocommerce" | "wpml")[];
  contentInAcf: boolean;
  descriptionEmpty: boolean;
  acfFields: Record<string, AcfRepeater | AcfSimpleField>;
  standardFieldsUsed: boolean;
  postTypes: string[];
  wpRestAvailable: boolean;
  sampleProductId?: number;
  samplePostId?: number;
}

type MetaEntry = { key: string; value: unknown };

function detectPlugins(meta: MetaEntry[]): WcSiteProfile["plugins"] {
  const plugins: WcSiteProfile["plugins"] = [];
  const keys = meta.map((m) => m.key);
  const hasAcf = keys.some((k) => !k.startsWith("_") && keys.includes(`_${k}`) &&
    typeof meta.find((m) => m.key === `_${k}`)?.value === "string" &&
    (meta.find((m) => m.key === `_${k}`)!.value as string).startsWith("field_"));
  if (hasAcf) plugins.push("acf");
  if (keys.some((k) => k.startsWith("_yoast_wpseo"))) plugins.push("yoast");
  if (keys.some((k) => k.startsWith("rank_math"))) plugins.push("rankmath");
  if (keys.some((k) => k.startsWith("_wpml"))) plugins.push("wpml");
  return plugins;
}

function extractAcfFields(meta: MetaEntry[]): Record<string, AcfRepeater | AcfSimpleField> {
  const fieldKeyMap = new Map<string, string>();
  for (const m of meta) {
    if (m.key.startsWith("_") && typeof m.value === "string" && m.value.startsWith("field_")) {
      fieldKeyMap.set(m.key.slice(1), m.value);
    }
  }

  const repeaterCounters = new Map<string, number>();
  const repeaterSubFields = new Map<string, Set<string>>();

  for (const m of meta) {
    if (m.key.startsWith("_")) continue;
    // Detect repeater rows: prefix_N_subfield
    const repeaterMatch = m.key.match(/^(.+?)_(\d+)_(.+)$/);
    if (repeaterMatch && repeaterMatch[1] && repeaterMatch[3] && fieldKeyMap.has(repeaterMatch[1])) {
      const prefix = repeaterMatch[1];
      const subField = repeaterMatch[3];
      if (!repeaterSubFields.has(prefix)) repeaterSubFields.set(prefix, new Set());
      repeaterSubFields.get(prefix)!.add(subField);
    }
    // Detect counter fields: e.g. description_dropdowns = "6"
    if (fieldKeyMap.has(m.key) && typeof m.value === "string" && /^\d+$/.test(m.value as string)) {
      const hasRows = meta.some((x) => x.key.startsWith(`${m.key}_0_`));
      if (hasRows) repeaterCounters.set(m.key, parseInt(m.value as string, 10));
    }
  }

  const fields: Record<string, AcfRepeater | AcfSimpleField> = {};

  for (const [fieldName, fieldKey] of fieldKeyMap.entries()) {
    if (repeaterCounters.has(fieldName)) {
      fields[fieldName] = {
        type: "repeater",
        fieldKey,
        subFields: [...(repeaterSubFields.get(fieldName) ?? [])],
        currentCount: repeaterCounters.get(fieldName)!,
      };
    } else if (!repeaterSubFields.has(fieldName) && !/^.+_\d+_.+$/.test(fieldName)) {
      const sampleVal = meta.find((m) => m.key === fieldName)?.value;
      fields[fieldName] = {
        type: "simple",
        fieldKey,
        sampleValue: typeof sampleVal === "string" ? sampleVal.slice(0, 120) : undefined,
      };
    }
  }
  return fields;
}

function auth(creds: WcCredentials) {
  if (creds.consumerKey && creds.consumerSecret) {
    return "Basic " + Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  }
  if (creds.wpUsername && creds.wpAppPassword) {
    return "Basic " + Buffer.from(`${creds.wpUsername}:${creds.wpAppPassword}`).toString("base64");
  }
  throw new Error("Aucune méthode d'auth");
}

export async function analyzeSiteProfile(creds: WcCredentials): Promise<WcSiteProfile> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const headers = { "Authorization": auth(creds) };
  const timeout = AbortSignal.timeout(20_000);

  const profile: WcSiteProfile = {
    analyzedAt: new Date().toISOString(),
    plugins: ["woocommerce"],
    contentInAcf: false,
    descriptionEmpty: true,
    acfFields: {},
    standardFieldsUsed: false,
    postTypes: [],
    wpRestAvailable: false,
  };

  // Check WP REST availability + post types
  try {
    const typesRes = await fetch(`${base}/wp-json/wp/v2/types`, { headers, signal: timeout });
    if (typesRes.ok) {
      profile.wpRestAvailable = true;
      const types = await typesRes.json() as Record<string, { slug: string }>;
      profile.postTypes = Object.keys(types).filter((t) => !["attachment", "nav_menu_item", "wp_block"].includes(t));
    }
  } catch { /* WP REST unavailable */ }

  // Analyze a WooCommerce product
  try {
    const prodRes = await fetch(`${base}/wp-json/wc/v3/products?per_page=3&status=any&orderby=modified`, {
      headers, signal: AbortSignal.timeout(20_000),
    });
    if (prodRes.ok) {
      const products = await prodRes.json() as { id: number; description: string; short_description: string; meta_data: MetaEntry[] }[];
      // Pick the product with the most meta fields (richer structure)
      const product = products.sort((a, b) => b.meta_data.length - a.meta_data.length)[0];
      if (product) {
        profile.sampleProductId = product.id;
        profile.descriptionEmpty = !product.description?.trim();
        profile.standardFieldsUsed = !!(product.description?.trim() || product.short_description?.trim());
        const detectedPlugins = detectPlugins(product.meta_data);
        profile.plugins = [...new Set([...profile.plugins, ...detectedPlugins])];
        profile.acfFields = extractAcfFields(product.meta_data);
        profile.contentInAcf = Object.keys(profile.acfFields).length > 0 && profile.descriptionEmpty;
      }
    }
  } catch { /* WC products unavailable */ }

  // Analyze a WordPress post (for blog/articles context)
  try {
    const postRes = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1&orderby=modified`, {
      headers, signal: AbortSignal.timeout(15_000),
    });
    if (postRes.ok) {
      const posts = await postRes.json() as { id: number; meta?: MetaEntry[] }[];
      if (posts[0]) {
        profile.samplePostId = posts[0].id;
        const postMeta = posts[0].meta ?? [];
        if (Array.isArray(postMeta) && postMeta.length > 0) {
          const postPlugins = detectPlugins(postMeta);
          profile.plugins = [...new Set([...profile.plugins, ...postPlugins])];
          const postAcf = extractAcfFields(postMeta);
          Object.assign(profile.acfFields, postAcf);
        }
      }
    }
  } catch { /* WP posts unavailable */ }

  return profile;
}

export function formatProfileForPrompt(profile: WcSiteProfile): string {
  const lines: string[] = [
    `**Profil du site connecté** (analysé le ${new Date(profile.analyzedAt).toLocaleDateString("fr-FR")}) :`,
    `- Plugins détectés : ${profile.plugins.join(", ")}`,
  ];

  if (profile.contentInAcf) {
    lines.push(`- ⚠️ Le contenu visible est dans des **champs ACF**, pas dans la description WooCommerce standard.`);
  } else if (profile.standardFieldsUsed) {
    lines.push(`- Le contenu est dans les champs description/short_description WooCommerce standard.`);
  }

  const repeaters = Object.entries(profile.acfFields).filter(([, f]) => f.type === "repeater");
  const simpleAcf = Object.entries(profile.acfFields).filter(([, f]) => f.type === "simple" && f.fieldKey);

  if (repeaters.length > 0) {
    lines.push(`\n**Répéteurs ACF détectés :**`);
    for (const [name, field] of repeaters) {
      const f = field as AcfRepeater;
      lines.push(`- \`${name}\` (field key : \`${f.fieldKey}\`) — ${f.currentCount} entrée(s), sous-champs : ${f.subFields.map((s) => `\`${name}_N_${s}\``).join(", ")}`);
    }
  }

  if (simpleAcf.length > 0) {
    lines.push(`\n**Champs ACF simples détectés :**`);
    for (const [name, field] of simpleAcf.slice(0, 20)) {
      const f = field as AcfSimpleField;
      lines.push(`- \`${name}\` (field key : \`${f.fieldKey}\`)${f.sampleValue ? ` — ex: "${f.sampleValue.slice(0, 60)}"` : ""}`);
    }
    if (simpleAcf.length > 20) lines.push(`  _(+ ${simpleAcf.length - 20} autres champs)_`);
  }

  return lines.join("\n");
}
