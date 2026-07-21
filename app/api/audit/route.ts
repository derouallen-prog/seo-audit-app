import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: row, error } = await sb
    .from("audits")
    .select("id, url, score, grade, data")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Audit introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    url: row.url,
    score: row.score,
    grade: row.grade,
    data: row.data as Analysis,
  });
}
