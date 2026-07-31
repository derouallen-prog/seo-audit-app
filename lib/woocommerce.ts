export interface WcCredentials {
  storeUrl: string;
  // Méthode A : WooCommerce Consumer Keys (traditionnel)
  consumerKey?: string;
  consumerSecret?: string;
  // Méthode B : WordPress Application Password (WP 5.6+ / WC 4.8+)
  wpUsername?: string;
  wpAppPassword?: string;
}

export interface WooDraftProductParams {
  name: string;
  descriptionHtml: string;
  metaTitle?: string;
  metaDescription?: string;
  regularPrice?: string;
}

export interface WooDraftProductResult {
  id: number;
  permalink: string;
  editUrl: string;
}

export interface WooDraftCategoryParams {
  name: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface WooDraftCategoryResult {
  id: number;
  slug: string;
  link: string;
  editUrl: string;
}

function wcAuth(creds: WcCredentials): string {
  if (creds.consumerKey && creds.consumerSecret) {
    return "Basic " + Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  }
  if (creds.wpUsername && creds.wpAppPassword) {
    return "Basic " + Buffer.from(`${creds.wpUsername}:${creds.wpAppPassword}`).toString("base64");
  }
  throw new Error("WooCommerce : aucune méthode d'authentification configurée");
}

export interface WooSearchResult {
  id: number;
  name: string;
  slug: string;
  status: string;
  permalink?: string;
  editUrl: string;
  price?: string;
  sku?: string;
}

export async function searchProducts(
  creds: WcCredentials,
  query: string,
  perPage = 10
): Promise<WooSearchResult[]> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ search: query, per_page: String(perPage), status: "any" });
  const res = await fetch(`${base}/wp-json/wc/v3/products?${params}`, {
    headers: { "Authorization": wcAuth(creds) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce search products ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { id: number; name: string; slug: string; status: string; permalink: string; price: string; sku: string }[];
  return data.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    permalink: p.permalink,
    editUrl: `${base}/wp-admin/post.php?post=${p.id}&action=edit`,
    price: p.price,
    sku: p.sku,
  }));
}

export async function searchCategories(
  creds: WcCredentials,
  query: string,
  perPage = 10
): Promise<WooSearchResult[]> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ search: query, per_page: String(perPage) });
  const res = await fetch(`${base}/wp-json/wc/v3/products/categories?${params}`, {
    headers: { "Authorization": wcAuth(creds) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce search categories ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { id: number; name: string; slug: string; count: number; link: string }[];
  return data.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: `${c.count} produit(s)`,
    permalink: c.link,
    editUrl: `${base}/wp-admin/term.php?taxonomy=product_cat&tag_ID=${c.id}`,
  }));
}

export async function createDraftProduct(
  creds: WcCredentials,
  p: WooDraftProductParams
): Promise<WooDraftProductResult> {
  const base = creds.storeUrl.replace(/\/$/, "");

  const body: Record<string, unknown> = {
    name: p.name,
    status: "draft",
    description: p.descriptionHtml,
  };
  if (p.regularPrice) body.regular_price = p.regularPrice;

  const metaData: { key: string; value: string }[] = [];
  if (p.metaTitle) metaData.push({ key: "_yoast_wpseo_title", value: p.metaTitle });
  if (p.metaDescription) metaData.push({ key: "_yoast_wpseo_metadesc", value: p.metaDescription });
  if (metaData.length > 0) body.meta_data = metaData;

  const res = await fetch(`${base}/wp-json/wc/v3/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": wcAuth(creds),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    permalink: data.permalink,
    editUrl: `${base}/wp-admin/post.php?post=${data.id}&action=edit`,
  };
}

export async function createProductCategory(
  creds: WcCredentials,
  p: WooDraftCategoryParams
): Promise<WooDraftCategoryResult> {
  const base = creds.storeUrl.replace(/\/$/, "");

  const body: Record<string, unknown> = { name: p.name };
  if (p.description) body.description = p.description;

  const metaData: { key: string; value: string }[] = [];
  if (p.metaTitle) metaData.push({ key: "_yoast_wpseo_title", value: p.metaTitle });
  if (p.metaDescription) metaData.push({ key: "_yoast_wpseo_metadesc", value: p.metaDescription });
  if (metaData.length > 0) body.yoast_head_json = { title: p.metaTitle, description: p.metaDescription };

  const res = await fetch(`${base}/wp-json/wc/v3/products/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": wcAuth(creds),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce Categories API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    slug: data.slug,
    link: data.link,
    editUrl: `${base}/wp-admin/term.php?taxonomy=product_cat&tag_ID=${data.id}`,
  };
}
