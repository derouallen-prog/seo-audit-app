import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET /api/citations/results?days=30&tracked_url=... — aggregated citation results
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const trackedUrl = searchParams.get("tracked_url");

  const sb = getSupabase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Get all user prompt IDs (filtered by tracked_url if provided)
  let pQuery = sb.from("prompt_sets").select("id, tracked_url, prompt_text, intent, topic").eq("user_id", user.id);
  if (trackedUrl) pQuery = pQuery.eq("tracked_url", trackedUrl);
  const { data: prompts } = await pQuery;
  if (!prompts?.length) return NextResponse.json({ prompts: [], runs: [], citationShare: {} });

  const promptIds = prompts.map(p => p.id);

  // Fetch all runs in the window
  const { data: runs } = await sb
    .from("citation_runs")
    .select("id, prompt_id, platform, run_at, cited, citation_position, cited_url, competitor_domains")
    .in("prompt_id", promptIds)
    .gte("run_at", since)
    .order("run_at", { ascending: false });

  if (!runs) return NextResponse.json({ prompts, runs: [], citationShare: {} });

  // Compute citation_share per platform
  const byPlatform: Record<string, { cited: number; total: number }> = {};
  for (const run of runs) {
    if (!byPlatform[run.platform]) byPlatform[run.platform] = { cited: 0, total: 0 };
    byPlatform[run.platform]!.total++;
    if (run.cited) byPlatform[run.platform]!.cited++;
  }
  const citationShare = Object.fromEntries(
    Object.entries(byPlatform).map(([p, { cited, total }]) => [
      p,
      { cited, total, share: total > 0 ? Math.round((cited / total) * 100) : 0 },
    ])
  );

  // Top competitor domains across all runs
  const compCount: Record<string, number> = {};
  for (const run of runs) {
    const domains = (run.competitor_domains as string[] | null) ?? [];
    for (const d of domains) {
      compCount[d] = (compCount[d] ?? 0) + 1;
    }
  }
  const topCompetitors = Object.entries(compCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([domain, count]) => ({ domain, count }));

  // Most cited pages
  const pageCount: Record<string, number> = {};
  for (const run of runs) {
    if (run.cited_url) pageCount[run.cited_url] = (pageCount[run.cited_url] ?? 0) + 1;
  }
  const topPages = Object.entries(pageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  // Citation trend: group by week
  const trendByWeek: Record<string, { cited: number; total: number }> = {};
  for (const run of runs) {
    const weekStart = new Date(run.run_at);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!trendByWeek[key]) trendByWeek[key] = { cited: 0, total: 0 };
    trendByWeek[key].total++;
    if (run.cited) trendByWeek[key].cited++;
  }
  const trend = Object.entries(trendByWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, { cited, total }]) => ({
      week,
      share: total > 0 ? Math.round((cited / total) * 100) : 0,
      cited,
      total,
    }));

  return NextResponse.json({
    prompts,
    runs,
    citationShare,
    topCompetitors,
    topPages,
    trend,
    meta: { days, since, totalRuns: runs.length },
  });
}
