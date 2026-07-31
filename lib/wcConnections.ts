import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "./tokenCrypto";
import type { WcSiteProfile } from "./wcSiteProfile";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WcConnectionData {
  id?: string;
  storeUrl: string;
  label?: string;
  isDefault?: boolean;
  wcConsumerKey: string;
  wcConsumerSecret: string;
  wpUsername: string;
  wpAppPassword: string;
  siteProfile?: WcSiteProfile | null;
}

/** Retourne le site par défaut (ou le premier si aucun défaut défini) */
export async function getWcConnection(userId: string): Promise<WcConnectionData | null> {
  const { data } = await supabaseAdmin
    .from("woocommerce_connections")
    .select("id, store_url, label, is_default, wc_consumer_key, wc_consumer_secret, wp_username, wp_app_password, site_profile")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return deserialize(data);
}

/** Retourne tous les sites connectés */
export async function getWcConnections(userId: string): Promise<WcConnectionData[]> {
  const { data } = await supabaseAdmin
    .from("woocommerce_connections")
    .select("id, store_url, label, is_default, wc_consumer_key, wc_consumer_secret, wp_username, wp_app_password, site_profile")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (data ?? []).map(deserialize);
}

function deserialize(data: Record<string, unknown>): WcConnectionData {
  return {
    id: data.id as string,
    storeUrl: data.store_url as string,
    label: (data.label as string | null) ?? undefined,
    isDefault: data.is_default as boolean,
    wcConsumerKey: data.wc_consumer_key ? decryptToken(data.wc_consumer_key as string) : "",
    wcConsumerSecret: data.wc_consumer_secret ? decryptToken(data.wc_consumer_secret as string) : "",
    wpUsername: (data.wp_username as string | null) ?? "",
    wpAppPassword: decryptToken(data.wp_app_password as string),
    siteProfile: (data.site_profile as WcSiteProfile | null) ?? null,
  };
}

export async function saveWcConnection(userId: string, conn: WcConnectionData): Promise<void> {
  const base = conn.storeUrl.replace(/\/$/, "");
  const label = conn.label ?? new URL(base.startsWith("http") ? base : `https://${base}`).hostname;

  // Vérifie si c'est le premier site (sera défaut automatiquement)
  const { count } = await supabaseAdmin
    .from("woocommerce_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const isFirst = (count ?? 0) === 0;

  const { error } = await supabaseAdmin
    .from("woocommerce_connections")
    .upsert({
      user_id: userId,
      store_url: base,
      label,
      is_default: isFirst,
      wc_consumer_key: conn.wcConsumerKey ? encryptToken(conn.wcConsumerKey) : null,
      wc_consumer_secret: conn.wcConsumerSecret ? encryptToken(conn.wcConsumerSecret) : null,
      wp_username: conn.wpUsername,
      wp_app_password: encryptToken(conn.wpAppPassword),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,store_url" });

  if (error) throw new Error(`Erreur sauvegarde connexion WC: ${error.message}`);
}

/** Définit un site comme défaut (retire le défaut des autres) */
export async function setDefaultWcConnection(userId: string, connectionId: string): Promise<void> {
  await supabaseAdmin
    .from("woocommerce_connections")
    .update({ is_default: false })
    .eq("user_id", userId);

  const { error } = await supabaseAdmin
    .from("woocommerce_connections")
    .update({ is_default: true })
    .eq("id", connectionId)
    .eq("user_id", userId);

  if (error) throw new Error(`Erreur définition site par défaut: ${error.message}`);
}

/** Supprime un site spécifique (par ID) ou tous les sites si aucun ID */
export async function deleteWcConnection(userId: string, connectionId?: string): Promise<void> {
  const query = supabaseAdmin
    .from("woocommerce_connections")
    .delete()
    .eq("user_id", userId);

  if (connectionId) {
    await query.eq("id", connectionId);
    // Si c'était le défaut, passer le défaut au plus ancien restant
    const { data: remaining } = await supabaseAdmin
      .from("woocommerce_connections")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (remaining?.[0]) {
      await supabaseAdmin
        .from("woocommerce_connections")
        .update({ is_default: true })
        .eq("id", remaining[0].id);
    }
  } else {
    await query;
  }
}

export async function saveSiteProfile(userId: string, profile: WcSiteProfile, storeUrl?: string): Promise<void> {
  const query = supabaseAdmin
    .from("woocommerce_connections")
    .update({ site_profile: profile, site_profile_updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  const { error } = storeUrl
    ? await query.eq("store_url", storeUrl.replace(/\/$/, ""))
    : await query.eq("is_default", true);

  if (error) throw new Error(`Erreur sauvegarde profil site: ${error.message}`);
}
