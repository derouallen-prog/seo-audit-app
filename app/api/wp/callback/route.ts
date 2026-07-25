import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { saveWcConnection } from "@/lib/wcConnections";

export const dynamic = "force-dynamic";

// WordPress redirige ici après autorisation de l'Application Password
// Params reçus : user_login, password, site_url
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", req.nextUrl.origin));
  }

  const userLogin = req.nextUrl.searchParams.get("user_login");
  const password = req.nextUrl.searchParams.get("password");
  const siteUrl = req.nextUrl.searchParams.get("site_url");

  if (!userLogin || !password || !siteUrl) {
    return NextResponse.redirect(new URL("/integrations?error=missing_params", req.nextUrl.origin));
  }

  try {
    await saveWcConnection(user.id, {
      storeUrl: siteUrl,
      wcConsumerKey: "",
      wcConsumerSecret: "",
      wpUsername: userLogin,
      wpAppPassword: password,
    });
    return NextResponse.redirect(new URL("/integrations?connected=true", req.nextUrl.origin));
  } catch (e) {
    console.error("[wp/callback] error saving connection:", e);
    return NextResponse.redirect(new URL("/integrations?error=save_failed", req.nextUrl.origin));
  }
}
