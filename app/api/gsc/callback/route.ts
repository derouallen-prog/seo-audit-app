import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient, saveGscConnection } from "@/lib/gscOAuth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("gsc_oauth_state")?.value;
  const sessionId = req.cookies.get("gsc_session")?.value;

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));

  if (!code || !state || !sessionId || state !== expectedState) {
    return redirectTo("/?gsc=error");
  }

  const redirectUri = `${req.nextUrl.origin}/api/gsc/callback`;
  const oauth2Client = getGoogleOAuthClient(redirectUri);
  if (!oauth2Client) {
    return redirectTo("/?gsc=error");
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) throw new Error("Pas d'access_token retourné par Google");

    await saveGscConnection(sessionId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600_000).toISOString(),
      scope: tokens.scope ?? null,
    });
  } catch (e) {
    console.error("[gsc callback] error:", e);
    return redirectTo("/?gsc=error");
  }

  const res = redirectTo("/?gsc=connected");
  res.cookies.delete("gsc_oauth_state");
  return res;
}
