export interface WcCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
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

function wcBasicAuth(key: string, secret: string): string {
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
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
      "Authorization": wcBasicAuth(creds.consumerKey, creds.consumerSecret),
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
      "Authorization": wcBasicAuth(creds.consumerKey, creds.consumerSecret),
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
