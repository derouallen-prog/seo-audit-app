import { createClient } from "@supabase/supabase-js";
import type { UserSiteProfile } from "./userSiteProfile";

export const ACTIVE_SITE_COOKIE = "sm_active_site";
export const PRIMARY_SITE_ID = "primary";

export interface SiteEntry extends UserSiteProfile {
  id: string;
  label: string;
  site_url: string;
  isPrimary: boolean;
}

export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function cleanDomain(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? url;
}

export async function listSites(userId: string): Promise<SiteEntry[]> {
  const sb = getServiceSupabase();
  const sites: SiteEntry[] = [];

  const { data: primary } = await sb
    .from("user_site_profile")
    .select("site_url,positioning,categories,market,target_zones,competitors")
    .eq("user_id", userId)
    .maybeSingle();
  if (primary?.site_url) {
    sites.push({ ...primary, id: PRIMARY_SITE_ID, label: cleanDomain(primary.site_url), isPrimary: true });
  }

  // Table absente tant que la migration client_sites n'est pas appliquée : on ignore l'erreur
  const { data: clients } = await sb
    .from("client_sites")
    .select("id,label,site_url,market,positioning,competitors")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  for (const c of clients ?? []) {
    sites.push({ ...c, competitors: c.competitors ?? [], isPrimary: false });
  }

  return sites;
}

export async function getActiveSite(userId: string, cookieValue: string | undefined): Promise<SiteEntry | null> {
  const sites = await listSites(userId);
  if (sites.length === 0) return null;
  return sites.find(s => s.id === cookieValue) ?? sites[0] ?? null;
}
