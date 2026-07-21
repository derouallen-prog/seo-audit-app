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

/** Extract a short text excerpt from the raw LLM response, per platform format */
function extractExcerpt(platform: string, raw: unknown): string {
  try {
    const r = raw as Record<string, unknown>;
    if (platform === "perplexity") {
      const choices = r.choices as { message: { content: string } }[] | undefined;
      return (choices?.[0]?.message?.content ?? "").slice(0, 280);
    }
    if (platform === "claude") {
      const content = r.content as { type: string; text?: string }[] | undefined;
      const block = content?.find(b => b.type === "text");
      return (block?.text ?? "").slice(0, 280);
    }
    if (platform === "gemini") {
      const cands = r.candidates as { content: { parts: { text: string }[] } }[] | undefined;
      return (cands?.[0]?.content?.parts?.[0]?.text ?? "").slice(0, 280);
    }
  } catch { /* ignore */ }
  return "";
}

/** Extract cited URLs from raw response */
function extractSources(platform: string, raw: unknown): string[] {
  try {
    const r = raw as Record<string, unknown>;
    if (platform === "perplexity") {
      return (r.citations as string[] | undefined) ?? [];
    }
    if (platform === "gemini") {
      const cands = r.candidates as { groundingMetadata?: { groundingChunks?: { web?: { uri: string } }[] } }[] | undefined;
      return (cands?.[0]?.groundingMetadata?.groundingChunks ?? []).map(c => c.web?.uri ?? "").filter(Boolean);
    }
    if (platform === "claude") {
      const urls: string[] = [];
      const content = r.content as { type: string; citations?: { url?: string }[] }[] | undefined;
      for (const block of content ?? []) {
        for (const c of block.citations ?? []) { if (c.url) urls.push(c.url); }
      }
      return urls;
    }
  } catch { /* ignore */ }
  return [];
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const trackedUrl = searchParams.get("tracked_url");
  const language = searchParams.get("language"); // null = all languages
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const sb = getSupabase();

  let pQuery = sb.from("prompt_sets").select("id, tracked_url, prompt_text, intent, topic, language, active").eq("user_id", user.id);
  if (trackedUrl) pQuery = pQuery.eq("tracked_url", trackedUrl);
  if (language) pQuery = pQuery.eq("language", language);
  const { data: prompts } = await pQuery;

  const empty = {
    prompts: [], runs: [], runDetails: [],
    citationShare: {}, mentionShare: {},
    shareOfVoice: null,
    competitorMatrix: [],
    topCompetitors: [], topPages: [], trend: [],
    languages: [],
    meta: { days, totalRuns: 0 },
  };
  if (!prompts?.length) return NextResponse.json(empty);

  // Collect all available languages for the filter UI
  const { data: allPrompts } = await sb
    .from("prompt_sets")
    .select("language")
    .eq("user_id", user.id);
  const languages = [...new Set((allPrompts ?? []).map(p => (p.language as string) || "fr"))].sort();

  const promptIds = prompts.map(p => p.id);

  const { data: runs } = await sb
    .from("citation_runs")
    .select("id, prompt_id, platform, run_at, cited, mentioned, citation_position, cited_url, competitor_domains, raw_response, response_text")
    .in("prompt_id", promptIds)
    .gte("run_at", since)
    .order("run_at", { ascending: false });

  if (!runs) return NextResponse.json({ ...empty, prompts, languages });

  // ── Citation share & Mention share per platform ──────────────────────────
  const byPlatform: Record<string, { cited: number; mentioned: number; total: number }> = {};
  for (const run of runs) {
    if (!byPlatform[run.platform]) byPlatform[run.platform] = { cited: 0, mentioned: 0, total: 0 };
    byPlatform[run.platform]!.total++;
    if (run.cited) byPlatform[run.platform]!.cited++;
    if (run.mentioned) byPlatform[run.platform]!.mentioned++;
  }

  const citationShare = Object.fromEntries(
    Object.entries(byPlatform).map(([p, { cited, total }]) => [
      p, { cited, total, share: total > 0 ? Math.round((cited / total) * 100) : 0 },
    ])
  );
  const mentionShare = Object.fromEntries(
    Object.entries(byPlatform).map(([p, { mentioned, total }]) => [
      p, { mentioned, total, share: total > 0 ? Math.round((mentioned / total) * 100) : 0 },
    ])
  );

  // ── Share of Voice vs competitors ─────────────────────────────────────────
  const domainMentions: Record<string, number> = {};
  for (const run of runs) {
    const competitors = (run.competitor_domains as string[] | null) ?? [];
    for (const d of competitors) { domainMentions[d] = (domainMentions[d] ?? 0) + 1; }
    if (run.cited) {
      const ourDomain = prompts.find(p => p.id === run.prompt_id)?.tracked_url ?? "";
      if (ourDomain) domainMentions[ourDomain] = (domainMentions[ourDomain] ?? 0) + 1;
    }
  }
  const totalMentions = Object.values(domainMentions).reduce((a, b) => a + b, 0);
  const ourCitations = runs.filter(r => r.cited).length;
  const shareOfVoice = totalMentions > 0 ? Math.round((ourCitations / totalMentions) * 100) : null;

  // ── Competitor × platform matrix (Ahrefs-style) ───────────────────────────
  // competitor_domains lists all domains cited alongside our tracked domain (or instead of it).
  // We count per-competitor, per-platform appearances.
  const matrixRaw: Record<string, Record<string, number>> = {};
  for (const run of runs) {
    const competitors = (run.competitor_domains as string[] | null) ?? [];
    for (const domain of competitors) {
      if (!matrixRaw[domain]) matrixRaw[domain] = {};
      matrixRaw[domain]![run.platform] = (matrixRaw[domain]![run.platform] ?? 0) + 1;
    }
  }
  const competitorMatrix = Object.entries(matrixRaw)
    .map(([domain, byPlatformRaw]) => ({
      domain,
      total: Object.values(byPlatformRaw).reduce((a, b) => a + b, 0),
      byPlatform: byPlatformRaw,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  // ── Top competitors (flat list) ───────────────────────────────────────────
  const topCompetitors = competitorMatrix
    .slice(0, 20)
    .map(({ domain, total }) => ({ domain, count: total }));

  // ── Top cited pages ───────────────────────────────────────────────────────
  const pageCount: Record<string, number> = {};
  for (const run of runs) {
    if (run.cited_url) pageCount[run.cited_url] = (pageCount[run.cited_url] ?? 0) + 1;
  }
  const topPages = Object.entries(pageCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  // ── Weekly trend ──────────────────────────────────────────────────────────
  const trendByWeek: Record<string, { cited: number; mentioned: number; total: number }> = {};
  for (const run of runs) {
    const d = new Date(run.run_at);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(0, 10);
    if (!trendByWeek[key]) trendByWeek[key] = { cited: 0, mentioned: 0, total: 0 };
    trendByWeek[key]!.total++;
    if (run.cited) trendByWeek[key]!.cited++;
    if (run.mentioned) trendByWeek[key]!.mentioned++;
  }
  const trend = Object.entries(trendByWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, { cited, mentioned, total }]) => ({
      week,
      share: total > 0 ? Math.round((cited / total) * 100) : 0,
      mentionShare: total > 0 ? Math.round((mentioned / total) * 100) : 0,
      cited,
      mentioned,
      total,
    }));

  // ── Run details for the analysis table ───────────────────────────────────
  const latestByKey: Record<string, typeof runs[0]> = {};
  for (const run of runs) {
    const key = `${run.prompt_id}__${run.platform}`;
    if (!latestByKey[key]) latestByKey[key] = run;
  }

  const runDetails = Object.values(latestByKey).map(run => ({
    id: run.id,
    prompt_id: run.prompt_id,
    platform: run.platform,
    run_at: run.run_at,
    cited: run.cited,
    mentioned: run.mentioned,
    citation_position: run.citation_position,
    cited_url: run.cited_url,
    competitor_domains: (run.competitor_domains as string[] | null) ?? [],
    responseExcerpt: (run.response_text as string | null) ?? extractExcerpt(run.platform, run.raw_response),
    sources: extractSources(run.platform, run.raw_response),
  }));

  // Strip raw_response before sending to client
  const runsClean = runs.map(r => {
    const { raw_response: _raw, ...rest } = r as typeof r & { raw_response: unknown };
    return rest;
  });

  return NextResponse.json({
    prompts,
    runs: runsClean,
    runDetails,
    citationShare,
    mentionShare,
    shareOfVoice,
    competitorMatrix,
    topCompetitors,
    topPages,
    trend,
    languages,
    meta: { days, totalRuns: runs.length },
  });
}
