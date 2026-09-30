import { NextRequest, NextResponse } from "next/server";
import { runMonitoringForAllSites } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/monitoring — hebdomadaire (Vercel Cron), après le suivi des citations du lundi
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runMonitoringForAllSites();
    console.log("[cron/monitoring]", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/monitoring] Fatal error:", e);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
