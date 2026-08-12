import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { exchangeCodeForToken, listSites } from "@/lib/webflowClient";
import { saveWebflowConnection } from "@/lib/webflowConnections";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", req.nextUrl.origin));

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/integrations?webflow_error=rejected", req.nextUrl.origin));
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/webflow/callback`;

  try {
    const { access_token } = await exchangeCodeForToken(code, redirectUri);
    const sites = await listSites(access_token);
    await saveWebflowConnection(user.id, access_token, sites);
    return NextResponse.redirect(new URL("/integrations?webflow_connected=true", req.nextUrl.origin));
  } catch (e) {
    console.error("[webflow/callback]", e);
    return NextResponse.redirect(new URL("/integrations?webflow_error=save_failed", req.nextUrl.origin));
  }
}
