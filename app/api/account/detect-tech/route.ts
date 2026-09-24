import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";

interface TechItem { name: string; category: string; color: string }

const DETECTORS: { name: string; category: string; color: string; patterns: RegExp[] }[] = [
  // CMS
  { name: "WordPress", category: "CMS", color: "#21759B", patterns: [/wp-content\//i, /wp-includes\//i, /wp-json\//i, /\/xmlrpc\.php/i] },
  { name: "Shopify", category: "E-commerce", color: "#96BF48", patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /shopify\.com\/s\//i, /myshopify\.com/i] },
  { name: "Webflow", category: "CMS", color: "#4353FF", patterns: [/webflow\.com/i, /\.webflow\.io/i, /data-wf-/i, /webflow\.js/i] },
  { name: "Wix", category: "CMS", color: "#FAAD4D", patterns: [/wixstatic\.com/i, /parastorage\.com/i, /wix-code/i] },
  { name: "Squarespace", category: "CMS", color: "#222222", patterns: [/squarespace\.com/i, /squarespace-cdn\.com/i, /static\.squarespace\.com/i] },
  { name: "Magento", category: "E-commerce", color: "#F46F25", patterns: [/Mage\.Cookies/i, /mage\/cookies/i, /magento/i] },
  { name: "PrestaShop", category: "E-commerce", color: "#DF0067", patterns: [/prestashop/i, /\/themes\/[a-z]+\/assets\//i] },
  { name: "WooCommerce", category: "E-commerce", color: "#7F54B3", patterns: [/woocommerce/i, /wc-api/i, /is-woocommerce/i] },
  // Page builders
  { name: "Divi", category: "Page Builder", color: "#7EBEC5", patterns: [/et_builder/i, /et-divi/i, /\/divi\//i] },
  { name: "Elementor", category: "Page Builder", color: "#92003B", patterns: [/elementor/i] },
  { name: "Oxygen Builder", category: "Page Builder", color: "#FF6B35", patterns: [/oxygen-[a-z]/i, /ct_builder/i] },
  // Analytics
  { name: "Google Analytics 4", category: "Analytics", color: "#E37400", patterns: [/gtag\('config'/i, /"G-[A-Z0-9]{6,}"/i, /googletagmanager\.com\/gtag/i] },
  { name: "Matomo", category: "Analytics", color: "#3152A0", patterns: [/matomo\.js/i, /piwik\.js/i, /matomo\.php/i] },
  // Tag managers
  { name: "Google Tag Manager", category: "Tag Manager", color: "#4285F4", patterns: [/gtm\.js/i, /"GTM-[A-Z0-9]+"/i, /googletagmanager\.com\/ns/i] },
  // SEO
  { name: "Yoast SEO", category: "SEO", color: "#A4286A", patterns: [/yoast/i, /wpseo/i] },
  { name: "RankMath", category: "SEO", color: "#F5A623", patterns: [/rank-math/i, /rankmath/i] },
];

const ALLOWED_CATEGORIES = new Set(["CMS", "E-commerce", "Analytics", "Tag Manager", "CDN/Hosting", "SEO", "Page Builder"]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) return NextResponse.json({ tech_stack: [] });

  const domain = rawUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  const siteUrl = `https://${domain}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(siteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      redirect: "follow",
    });
    clearTimeout(id);

    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    const detected: TechItem[] = [];
    const seen = new Set<string>();

    for (const d of DETECTORS) {
      if (d.patterns.some(p => p.test(html)) && !seen.has(d.name)) {
        detected.push({ name: d.name, category: d.category, color: d.color });
        seen.add(d.name);
      }
    }

    // Cloudflare from headers
    if ((headers["cf-cache-status"] || headers["cf-ray"] || headers["server"]?.includes("cloudflare")) && !seen.has("Cloudflare")) {
      detected.push({ name: "Cloudflare", category: "CDN/Hosting", color: "#F6821F" });
    }

    const filtered = detected.filter(d => ALLOWED_CATEGORIES.has(d.category));
    return NextResponse.json({ tech_stack: filtered });
  } catch {
    return NextResponse.json({ tech_stack: [] });
  }
}
