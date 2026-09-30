import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { ACTIVE_SITE_COOKIE, getActiveSite } from "@/lib/activeSite";
import { runMonitoringForSite } from "@/lib/monitoring";

export const runtime = "nodejs";
export const maxDuration = 120;

// Vérification manuelle du site actif (crée la référence au premier passage)
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const site = await getActiveSite(user.id, req.cookies.get(ACTIVE_SITE_COOKIE)?.value);
  if (!site) return NextResponse.json({ error: "Aucun site configuré." }, { status: 400 });

  try {
    const result = await runMonitoringForSite(user.id, site.site_url);
    return NextResponse.json({ site: site.label, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
