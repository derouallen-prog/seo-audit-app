import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, listGscSites } from "@/lib/gscOAuth";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("gsc_session")?.value;
  if (!sessionId) return NextResponse.json({ connected: false });

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) return NextResponse.json({ connected: false });

  try {
    const sites = await listGscSites(accessToken);
    return NextResponse.json({ connected: true, sites });
  } catch (e) {
    console.error("[gsc status] error:", e);
    return NextResponse.json({ connected: false });
  }
}
