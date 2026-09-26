import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignore in route handlers */ }
        },
      },
    }
  );

  try {
    // Use NEXT_PUBLIC_SITE_URL (prod) or VERCEL_URL (preview) before falling back to request origin (dev)
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      req.nextUrl.origin;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteOrigin}/api/auth/callback`,
      },
    });

    if (error) {
      const errObj = error as unknown as Record<string, unknown>;
      const rawMsg = errObj.message;
      const msg = (typeof rawMsg === "string" && rawMsg ? rawMsg : null)
        || (errObj.code as string | undefined)
        || (errObj.name as string | undefined)
        || "Erreur lors de la création du compte.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur de connexion au service d'authentification.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
