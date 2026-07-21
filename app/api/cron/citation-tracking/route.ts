import { NextRequest, NextResponse } from "next/server";
import { runAllActivePrompts } from "@/lib/citations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/cron/citation-tracking — called weekly by Vercel Cron
// Auth: Bearer CRON_SECRET header (same pattern as /api/cron/seo-news)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/citation-tracking] Starting weekly run");
  const start = Date.now();

  try {
    const { ran, errors } = await runAllActivePrompts();
    const duration = Date.now() - start;
    console.log(`[cron/citation-tracking] Done: ${ran} runs, ${errors} errors, ${duration}ms`);
    return NextResponse.json({ ok: true, ran, errors, durationMs: duration });
  } catch (e) {
    console.error("[cron/citation-tracking] Fatal error:", e);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
