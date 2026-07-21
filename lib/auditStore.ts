import { createClient } from "@supabase/supabase-js";
import type { Analysis } from "./types";

const TABLE = "audits";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function saveAudit(url: string, data: Analysis, score: number, grade: string, userId?: string | null): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const payload: Record<string, unknown> = { url, score, grade, data };
    if (userId) payload.user_id = userId;
    const { data: row, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.warn("[auditStore] saveAudit error:", error.message);
      return null;
    }
    return (row as { id: string }).id;
  } catch (e) {
    console.warn("[auditStore] saveAudit exception:", e);
    return null;
  }
}

export async function loadAudit(id: string): Promise<Analysis | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: row, error } = await sb
      .from(TABLE)
      .select("data")
      .eq("id", id)
      .single();
    if (error || !row) return null;
    return (row as { data: Analysis }).data;
  } catch (e) {
    console.warn("[auditStore] loadAudit exception:", e);
    return null;
  }
}
