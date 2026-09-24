import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// DELETE /api/account/clear-domain-data
// Wipes all domain-scoped data for the authenticated user:
// prompt_sets, citation_runs, audits, chat_sessions, and competitors in user_site_profile
export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sb = getSupabase();
  const uid = user.id;

  const results: Record<string, string> = {};

  // 1. prompt_sets (citation IA prompts)
  const { error: e1 } = await sb.from("prompt_sets").delete().eq("user_id", uid);
  results.prompt_sets = e1 ? e1.message : "ok";

  // 2. citation_runs (individual run results — may cascade from prompt_sets, delete anyway)
  const { error: e2 } = await sb.from("citation_runs").delete().eq("user_id", uid);
  results.citation_runs = e2 ? e2.message : "ok";

  // 3. audits (pages & sites audited)
  const { error: e3 } = await sb.from("audits").delete().eq("user_id", uid);
  results.audits = e3 ? e3.message : "ok";

  // 4. chat_sessions (assistant conversations)
  const { error: e4 } = await sb.from("chat_sessions").delete().eq("user_id", uid);
  results.chat_sessions = e4 ? e4.message : "ok";

  // 5. Clear competitors + market in user_site_profile (domain-specific data)
  const { error: e5 } = await sb
    .from("user_site_profile")
    .update({ competitors: [], market: null, positioning: null, categories: [], target_zones: [], tech_stack: [] })
    .eq("user_id", uid);
  results.profile_fields = e5 ? e5.message : "ok";

  return NextResponse.json({ ok: true, results });
}
