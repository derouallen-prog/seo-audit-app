import * as cheerio from "cheerio";

export interface DetectedTech {
  name: string;
  category: "CMS" | "E-commerce" | "Page Builder" | "Framework" | "CDN/Hosting" | "Analytics" | "Marketing";
  color: string;
  icon?: string;
}

interface TechPattern {
  name: string;
  category: DetectedTech["category"];
  color: string;
  headers?: RegExp[];
  scripts?: RegExp[];
  html?: RegExp[];
  meta?: { name?: string; content?: RegExp; property?: string };
  links?: RegExp[];
}

const PATTERNS: TechPattern[] = [
  // CMS
  { name: "WordPress",   category: "CMS",          color: "#21759b", scripts: [/wp-content\/|wp-includes\//], html: [/__WORDPRESS/i] },
  { name: "Shopify",     category: "E-commerce",   color: "#96bf48", scripts: [/cdn\.shopify\.com/], html: [/Shopify\.theme|shopify\.com/i] },
  { name: "PrestaShop",  category: "E-commerce",   color: "#df0067", scripts: [/prestashop|\/modules\/ps_/i], html: [/prestashop/i] },
  { name: "Magento",     category: "E-commerce",   color: "#ee672d", scripts: [/mage\/|varien\//i], html: [/Mage\.|magento/i] },
  { name: "Wix",         category: "CMS",          color: "#faad00", scripts: [/static\.parastorage\.com|wix\.com/i], headers: [/wix/i] },
  { name: "Squarespace", category: "CMS",          color: "#222",    scripts: [/squarespace\.com/i], html: [/squarespace/i] },
  { name: "Webflow",     category: "CMS",          color: "#4353ff", scripts: [/webflow\.com/i], html: [/webflow-page-id/i] },
  { name: "Drupal",      category: "CMS",          color: "#009cde", html: [/drupal/i], scripts: [/drupal\.js/i] },
  { name: "Joomla",      category: "CMS",          color: "#f44321", html: [/joomla/i], scripts: [/\/components\/com_/i] },
  // Page Builders
  { name: "Elementor",   category: "Page Builder", color: "#e2231a", scripts: [/elementor/i], html: [/elementor-/i] },
  { name: "Divi",        category: "Page Builder", color: "#6db4e4", scripts: [/divi/i], html: [/et_pb_|divi/i] },
  // Ecommerce add-ons
  { name: "WooCommerce", category: "E-commerce",   color: "#7f54b3", scripts: [/woocommerce/i], html: [/woocommerce/i] },
  // Frameworks
  { name: "Next.js",     category: "Framework",    color: "#000",    scripts: [/_next\/static/], html: [/__NEXT_DATA__/] },
  { name: "Nuxt.js",     category: "Framework",    color: "#00dc82", scripts: [/_nuxt\//i], html: [/__nuxt/i] },
  { name: "React",       category: "Framework",    color: "#61dafb", scripts: [/react\.js|react\.min\.js|react-dom/i] },
  { name: "Vue.js",      category: "Framework",    color: "#42b883", scripts: [/vue\.js|vue\.min\.js/i] },
  { name: "Angular",     category: "Framework",    color: "#dd0031", scripts: [/angular\.js|angular\.min\.js/i], html: [/ng-version/i] },
  // CDN / Hosting
  { name: "Cloudflare",  category: "CDN/Hosting",  color: "#f48120", headers: [/cf-ray|cloudflare/i] },
  { name: "Vercel",      category: "CDN/Hosting",  color: "#000",    headers: [/x-vercel-/i] },
  { name: "Netlify",     category: "CDN/Hosting",  color: "#00c7b7", headers: [/x-nf-/i] },
  // Analytics
  { name: "Google Analytics",    category: "Analytics", color: "#e37400", scripts: [/google-analytics\.com|gtag\/js/i] },
  { name: "Google Tag Manager",  category: "Analytics", color: "#4285f4", scripts: [/googletagmanager\.com/i] },
  { name: "Hotjar",              category: "Analytics", color: "#ff3c00", scripts: [/hotjar\.com/i] },
  // Marketing
  { name: "Facebook Pixel",      category: "Marketing", color: "#1877f2", scripts: [/connect\.facebook\.net/i] },
];

export async function detectTechStack(url: string): Promise<DetectedTech[]> {
  let html = "";
  const detectedHeaders: Record<string, string> = {};

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    res.headers.forEach((value, key) => {
      detectedHeaders[key.toLowerCase()] = value.toLowerCase();
    });

    html = await res.text();
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const scripts: string[] = [];
  const links: string[] = [];

  $("script[src]").each((_, el) => { scripts.push($(el).attr("src") ?? ""); });
  $("script:not([src])").each((_, el) => { scripts.push($(el).html() ?? ""); });
  $("link[href]").each((_, el) => { links.push($(el).attr("href") ?? ""); });

  const scriptText = scripts.join("\n");
  const headerText = Object.entries(detectedHeaders).map(([k, v]) => `${k}: ${v}`).join("\n");

  const detected = new Set<string>();
  const results: DetectedTech[] = [];

  for (const pattern of PATTERNS) {
    if (detected.has(pattern.name)) continue;

    const matches =
      (pattern.headers?.some(r => r.test(headerText))) ||
      (pattern.scripts?.some(r => r.test(scriptText))) ||
      (pattern.html?.some(r => r.test(html))) ||
      (pattern.links?.some(r => links.some(l => r.test(l))));

    if (matches) {
      detected.add(pattern.name);
      results.push({ name: pattern.name, category: pattern.category, color: pattern.color });
    }
  }

  return results;
}
