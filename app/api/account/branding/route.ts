import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/activeSite";

export const dynamic = "force-dynamic";

export interface Branding {
  agency_name: string | null;
  logo_url: string | null;
  accent_color: string | null;
  footer_text: string | null;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data } = await getServiceSupabase()
    .from("user_branding")
    .select("agency_name,logo_url,accent_color,footer_text")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ branding: data ?? null });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Partial<Branding>;
  const logo = body.logo_url?.trim() || null;
  if (logo && !/^https:\/\//i.test(logo)) {
    return NextResponse.json({ error: "L'URL du logo doit commencer par https://" }, { status: 400 });
  }
  const color = body.accent_color?.trim() || "#2563eb";
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return NextResponse.json({ error: "La couleur doit être au format #RRGGBB." }, { status: 400 });
  }

  const { error } = await getServiceSupabase().from("user_branding").upsert({
    user_id: user.id,
    agency_name: body.agency_name?.trim().slice(0, 120) || null,
    logo_url: logo,
    accent_color: color,
    footer_text: body.footer_text?.trim().slice(0, 300) || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    const missing = error.code === "42P01" || /user_branding/.test(error.message);
    return NextResponse.json(
      { error: missing ? "La table user_branding n'existe pas encore : appliquez la migration supabase/client_sites_branding_alerts.sql." : error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
