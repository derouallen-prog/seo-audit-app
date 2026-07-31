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

export interface WooProductDetail {
  id: number;
  name: string;
  status: string;
  permalink: string;
  editUrl: string;
  description: string;
  shortDescription: string;
  meta: { key: string; value: unknown }[];
}

export async function getProduct(creds: WcCredentials, productId: number): Promise<WooProductDetail> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/wp-json/wc/v3/products/${productId}`, {
    headers: { "Authorization": wcAuth(creds) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce get product ${res.status}: ${text.slice(0, 200)}`);
  }
  const d = await res.json();
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    permalink: d.permalink,
    editUrl: `${base}/wp-admin/post.php?post=${d.id}&action=edit`,
    description: d.description ?? "",
    shortDescription: d.short_description ?? "",
    // Les champs ACF sont stockés en post meta : `champ` porte la valeur,
    // `_champ` porte la field key ACF (field_xxx) — les deux sont requis à l'écriture.
    meta: (d.meta_data ?? []).map((m: { key: string; value: unknown }) => ({ key: m.key, value: m.value })),
  };
}

export interface WooProductUpdate {
  name?: string;
  status?: "draft" | "publish" | "pending" | "private";
  description?: string;
  shortDescription?: string;
  meta?: { key: string; value: string }[];
}

export async function updateProduct(
  creds: WcCredentials,
  productId: number,
  fields: WooProductUpdate
): Promise<WooDraftProductResult> {
  const base = creds.storeUrl.replace(/\/$/, "");
  const body: Record<string, unknown> = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.status !== undefined) body.status = fields.status;
  if (fields.description !== undefined) body.description = fields.description;
  if (fields.shortDescription !== undefined) body.short_description = fields.shortDescription;
  if (fields.meta?.length) body.meta_data = fields.meta;

  if (Object.keys(body).length === 0) throw new Error("Aucun champ à mettre à jour");

  const res = await fetch(`${base}/wp-json/wc/v3/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": wcAuth(creds) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce update product ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    permalink: data.permalink,
    editUrl: `${base}/wp-admin/post.php?post=${data.id}&action=edit`,
  };
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
