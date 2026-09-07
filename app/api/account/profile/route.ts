import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data } = await sb
    .from("user_site_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    email: user.email,
    display_name: user.user_metadata?.display_name ?? null,
    profile: data ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();

  // Separate auth-level fields from profile fields
  const { display_name, ...profileFields } = body;

  if (display_name !== undefined) {
    await sb.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, display_name },
    });
  }

  if (Object.keys(profileFields).length > 0) {
    await sb.from("user_site_profile").upsert(
      { user_id: user.id, ...profileFields, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json({ ok: true });
}
