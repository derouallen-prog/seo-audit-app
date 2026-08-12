import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", req.nextUrl.origin));

  const clientId = process.env.WEBFLOW_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "WEBFLOW_CLIENT_ID non configuré" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/webflow/callback`;
  const scope = "sites:read cms:read cms:write pages:read";

  const authUrl = new URL("https://webflow.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);

  return NextResponse.redirect(authUrl.toString());
}
