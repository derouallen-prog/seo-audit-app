import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabaseServer";
import { runPrompt } from "@/lib/citations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST /api/citations/run — manual trigger for a single prompt
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { prompt_id: string };
  const { prompt_id } = body;
  if (!prompt_id) return NextResponse.json({ error: "prompt_id required" }, { status: 400 });

  // Verify ownership
  const sb = getSupabase();
  const { data: prompt, error } = await sb
    .from("prompt_sets")
    .select("id, prompt_text, tracked_url")
    .eq("id", prompt_id)
    .eq("user_id", user.id)
    .single();

  if (error || !prompt) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  const results = await runPrompt(
    prompt.id,
    prompt.prompt_text,
    prompt.tracked_url,
    { source: "manual" }
  );

  return NextResponse.json({ ok: true, results });
}
