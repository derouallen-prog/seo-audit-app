import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGscSiteMetrics, getGscTopQueries, getGscByDimension } from "@/lib/gscOAuth";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("gsc_session")?.value;
  const siteUrl = req.nextUrl.searchParams.get("site");
  const days = parseInt(req.nextUrl.searchParams.get("days") || "28", 10);
  if (!sessionId || !siteUrl) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) {
    return NextResponse.json({ error: "Non connecté à Search Console" }, { status: 401 });
  }

  try {
    const [metrics, topQueries, topPages, devices] = await Promise.all([
      getGscSiteMetrics(accessToken, siteUrl, days),
      getGscTopQueries(accessToken, siteUrl, days, 10),
      getGscByDimension(accessToken, siteUrl, "page", days, 10),
      getGscByDimension(accessToken, siteUrl, "device", days, 5),
    ]);
    return NextResponse.json({ metrics, topQueries, topPages, devices });
  } catch (e) {
    console.error("[gsc metrics] error:", e);
    return NextResponse.json({ error: "Erreur lors de la récupération des données GSC" }, { status: 500 });
  }
}
