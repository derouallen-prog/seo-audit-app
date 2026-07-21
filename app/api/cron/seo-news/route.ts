import { NextRequest, NextResponse } from "next/server";
import { refreshSeoNewsDigest } from "@/lib/seoNews";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshSeoNewsDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron seo-news error:", e);
    return NextResponse.json({ error: "Erreur lors du rafraîchissement" }, { status: 500 });
  }
}
