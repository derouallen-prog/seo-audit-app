import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGscSiteMetrics, getGscTopQueries } from "@/lib/gscOAuth";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("gsc_session")?.value;
  const siteUrl = req.nextUrl.searchParams.get("site");
  if (!sessionId || !siteUrl) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) {
    return NextResponse.json({ error: "Non connecté à Search Console" }, { status: 401 });
  }

  try {
    const [metrics, topQueries] = await Promise.all([
      getGscSiteMetrics(accessToken, siteUrl),
      getGscTopQueries(accessToken, siteUrl),
    ]);
    return NextResponse.json({ metrics, topQueries });
  } catch (e) {
    console.error("[gsc metrics] error:", e);
    return NextResponse.json({ error: "Erreur lors de la récupération des données GSC" }, { status: 500 });
  }
}
