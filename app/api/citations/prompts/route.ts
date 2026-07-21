import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabaseServer";
import type { Intent } from "@/lib/citations/types";
import { INTENTS } from "@/lib/citations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET /api/citations/prompts — list prompts for authenticated user
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("prompt_sets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data });
}

// POST /api/citations/prompts — create a new prompt
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    tracked_url: string;
    prompt_text: string;
    intent?: Intent;
    topic?: string;
    language?: string;
  };

  const { tracked_url, prompt_text, intent = "Informational", topic, language = "fr" } = body;

  if (!tracked_url || !prompt_text) {
    return NextResponse.json({ error: "tracked_url and prompt_text are required" }, { status: 400 });
  }
  if (!INTENTS.includes(intent)) {
    return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  }
  if (prompt_text.length > 500) {
    return NextResponse.json({ error: "Prompt must be under 500 characters" }, { status: 400 });
  }

  // Normalize domain: strip protocol + trailing slash
  const normalizedUrl = tracked_url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  const sb = getSupabase();

  // Limit: 50 prompts per user
  const { count } = await sb
    .from("prompt_sets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: "Limite de 50 prompts actifs atteinte" }, { status: 429 });
  }

  const { data, error } = await sb
    .from("prompt_sets")
    .insert({ user_id: user.id, tracked_url: normalizedUrl, prompt_text, intent, topic, language })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompt: data }, { status: 201 });
}

// PATCH /api/citations/prompts — toggle active or update
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { id: string; active?: boolean };
  const { id, active } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("prompt_sets")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/citations/prompts — remove a prompt and its runs
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("prompt_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
