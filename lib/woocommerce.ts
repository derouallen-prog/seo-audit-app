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

export async function createDraftProduct(p: WooDraftProductParams): Promise<WooDraftProductResult> {
  const url = process.env.WOOCOMMERCE_URL;
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  if (!url || !key || !secret) {
    throw new Error("WooCommerce non configuré (WOOCOMMERCE_URL / CONSUMER_KEY / CONSUMER_SECRET manquants)");
  }
  const base = url.replace(/\/$/, "");

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

  const params = new URLSearchParams({ consumer_key: key, consumer_secret: secret });
  const res = await fetch(`${base}/wp-json/wc/v3/products?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
