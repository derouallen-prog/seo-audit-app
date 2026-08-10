import { createClient } from "@supabase/supabase-js";
import type { DetectedTech } from "./techDetect";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface SiteProfile {
  id: string;
  user_id: string;
  site_url: string;
  competitors: string[];
  tech_stack: DetectedTech[];
  positioning: string | null;
  writing_style: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export async function getSiteProfile(userId: string): Promise<SiteProfile | null> {
  const { data } = await adminClient()
    .from("user_site_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as SiteProfile | null;
}

export async function upsertSiteProfile(
  userId: string,
  patch: Partial<Omit<SiteProfile, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<SiteProfile> {
  const { data, error } = await adminClient()
    .from("user_site_profile")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "upsert failed");
  return data as SiteProfile;
}
