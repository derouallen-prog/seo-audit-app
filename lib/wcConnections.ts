import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "./tokenCrypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WcConnectionData {
  storeUrl: string;
  wcConsumerKey: string;
  wcConsumerSecret: string;
  wpUsername: string;
  wpAppPassword: string;
}

export async function getWcConnection(userId: string): Promise<WcConnectionData | null> {
  const { data, error } = await supabaseAdmin
    .from("woocommerce_connections")
    .select("store_url, wc_consumer_key, wc_consumer_secret, wp_username, wp_app_password")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    storeUrl: data.store_url,
    wcConsumerKey: decryptToken(data.wc_consumer_key),
    wcConsumerSecret: decryptToken(data.wc_consumer_secret),
    wpUsername: data.wp_username,
    wpAppPassword: decryptToken(data.wp_app_password),
  };
}

export async function saveWcConnection(userId: string, conn: WcConnectionData): Promise<void> {
  const base = conn.storeUrl.replace(/\/$/, "");

  const { error } = await supabaseAdmin
    .from("woocommerce_connections")
    .upsert({
      user_id: userId,
      store_url: base,
      wc_consumer_key: encryptToken(conn.wcConsumerKey),
      wc_consumer_secret: encryptToken(conn.wcConsumerSecret),
      wp_username: conn.wpUsername,
      wp_app_password: encryptToken(conn.wpAppPassword),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) throw new Error(`Erreur sauvegarde connexion WC: ${error.message}`);
}

export async function deleteWcConnection(userId: string): Promise<void> {
  await supabaseAdmin
    .from("woocommerce_connections")
    .delete()
    .eq("user_id", userId);
}
