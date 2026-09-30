import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { ACTIVE_SITE_COOKIE, listSites } from "@/lib/activeSite";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await req.json().catch(() => ({})) as { id?: string };
  const sites = await listSites(user.id);
  const site = sites.find(s => s.id === id);
  if (!site) return NextResponse.json({ error: "Site introuvable" }, { status: 404 });

  const res = NextResponse.json({ active: site });
  res.cookies.set(ACTIVE_SITE_COOKIE, site.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
