import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getGoogleOAuthClient } from "@/lib/gscOAuth";

export async function GET(req: NextRequest) {
  const redirectUri = `${req.nextUrl.origin}/api/gsc/callback`;
  const oauth2Client = getGoogleOAuthClient(redirectUri);

  if (!oauth2Client) {
    return NextResponse.json({ error: "Google OAuth non configuré (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET manquants)" }, { status: 500 });
  }

  const state = randomUUID();
  const sessionId = req.cookies.get("gsc_session")?.value || randomUUID();
  const isProd = process.env.NODE_ENV === "production";

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
    state,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("gsc_session", sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  res.cookies.set("gsc_oauth_state", state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
