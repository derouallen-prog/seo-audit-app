import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", req.nextUrl.origin));
  }

  const rawUrl = req.nextUrl.searchParams.get("site_url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Paramètre site_url manquant" }, { status: 400 });
  }

  // Normalize: add https:// if no protocol
  const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let base: string;
  try {
    base = new URL(normalized).origin;
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/api/wp/callback`;
  const rejectUrl = `${origin}/integrations?error=rejected`;

  // WordPress built-in Application Passwords authorization flow (WP 5.6+)
  const wpAuthUrl = new URL(`${base}/wp-admin/authorize-application.php`);
  wpAuthUrl.searchParams.set("app_name", "Search Mind SEO");
  wpAuthUrl.searchParams.set("app_id", crypto.randomUUID());
  wpAuthUrl.searchParams.set("success_url", successUrl);
  wpAuthUrl.searchParams.set("reject_url", rejectUrl);

  return NextResponse.redirect(wpAuthUrl.toString());
}
