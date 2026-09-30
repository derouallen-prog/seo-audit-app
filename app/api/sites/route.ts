import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { ACTIVE_SITE_COOKIE, PRIMARY_SITE_ID, cleanDomain, getServiceSupabase, listSites } from "@/lib/activeSite";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const sites = await listSites(user.id);
  const cookieId = req.cookies.get(ACTIVE_SITE_COOKIE)?.value;
  const active = sites.find(s => s.id === cookieId) ?? sites[0] ?? null;
  return NextResponse.json({ sites, activeId: active?.id ?? null, active });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    site_url?: string; label?: string; market?: string; positioning?: string; competitors?: string[];
  };
  const siteUrl = body.site_url?.trim();
  if (!siteUrl || !/[a-z0-9-]\.[a-z]{2,}/i.test(siteUrl)) {
    return NextResponse.json({ error: "Indiquez un domaine valide (ex : client.fr)." }, { status: 400 });
  }

  const competitors = (body.competitors ?? []).map(c => cleanDomain(c.trim())).filter(Boolean).slice(0, 10);
  const { data, error } = await getServiceSupabase()
    .from("client_sites")
    .insert({
      user_id: user.id,
      site_url: cleanDomain(siteUrl),
      label: body.label?.trim() || cleanDomain(siteUrl),
      market: body.market?.trim() || null,
      positioning: body.positioning?.trim() || null,
      competitors,
    })
    .select("id")
    .single();

  if (error) {
    const missingTable = error.code === "42P01" || /client_sites/.test(error.message);
    return NextResponse.json(
      { error: missingTable ? "La table client_sites n'existe pas encore : appliquez la migration supabase/client_sites_branding_alerts.sql." : error.message },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ id: data.id });
  res.cookies.set(ACTIVE_SITE_COOKIE, data.id, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id || id === PRIMARY_SITE_ID) {
    return NextResponse.json({ error: "Le site principal se modifie depuis Paramètres > À propos." }, { status: 400 });
  }

  const { error } = await getServiceSupabase().from("client_sites").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  if (req.cookies.get(ACTIVE_SITE_COOKIE)?.value === id) res.cookies.delete(ACTIVE_SITE_COOKIE);
  return res;
}
