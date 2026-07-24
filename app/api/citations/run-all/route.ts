import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { runAllActivePrompts } from "@/lib/citations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/citations/run-all — déclenche un run complet pour l'utilisateur connecté
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ran, errors } = await runAllActivePrompts(user.id);
  return NextResponse.json({ ok: true, ran, errors });
}
