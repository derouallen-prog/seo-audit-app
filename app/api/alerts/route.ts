import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/activeSite";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await getServiceSupabase()
    .from("user_alerts")
    .select("id,site_url,kind,severity,title,detail,read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // Migration non appliquée : on renvoie une liste vide plutôt qu'une erreur
  if (error) return NextResponse.json({ alerts: [], unread: 0 });
  return NextResponse.json({ alerts: data, unread: data.filter(a => !a.read).length });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await req.json().catch(() => ({})) as { id?: string };
  let q = getServiceSupabase().from("user_alerts").update({ read: true }).eq("user_id", user.id);
  if (id) q = q.eq("id", id);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
