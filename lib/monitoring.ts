import { getServiceSupabase, cleanDomain } from "./activeSite";
import { getDataForSeoRankedKeywords, getDataForSeoBacklinks } from "./dataforseo";

interface PositionEntry { pos: number; url: string; vol: number }

interface Snapshot {
  positions: Record<string, PositionEntry> | null;
  referringDomains: number | null;
  backlinks: number | null;
  citations: Record<string, { prompt: string; cited: boolean }>;
}

interface NewAlert { kind: "positions" | "backlinks" | "citations"; severity: "info" | "warning" | "critical"; title: string; detail: string }

const TRACKED_MAX_POSITION = 20;
const DROP_THRESHOLD = 3;

async function takeSnapshot(userId: string, domain: string): Promise<Snapshot> {
  const sb = getServiceSupabase();
  const [ranked, backlinks] = await Promise.allSettled([
    getDataForSeoRankedKeywords(domain, "fr", { minPosition: 1, maxPosition: TRACKED_MAX_POSITION, limit: 100 }),
    getDataForSeoBacklinks(domain),
  ]);

  const positions: Record<string, PositionEntry> | null = ranked.status === "fulfilled"
    ? Object.fromEntries(ranked.value.items.map(k => [k.keyword, { pos: k.position, url: k.url, vol: k.searchVolume }]))
    : null;

  const citations: Snapshot["citations"] = {};
  const { data: prompts } = await sb
    .from("prompt_sets")
    .select("id,prompt_text,tracked_url")
    .eq("user_id", userId)
    .eq("active", true);
  const sitePrompts = (prompts ?? []).filter(p => cleanDomain(p.tracked_url ?? "") === domain);
  if (sitePrompts.length) {
    const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const { data: runs } = await sb
      .from("citation_runs")
      .select("prompt_id,cited")
      .in("prompt_id", sitePrompts.map(p => p.id))
      .gte("run_at", since);
    for (const p of sitePrompts) {
      const pr = (runs ?? []).filter(r => r.prompt_id === p.id);
      if (pr.length) citations[p.id] = { prompt: p.prompt_text, cited: pr.some(r => r.cited) };
    }
  }

  return {
    positions,
    referringDomains: backlinks.status === "fulfilled" && backlinks.value ? backlinks.value.referringDomains : null,
    backlinks: backlinks.status === "fulfilled" && backlinks.value ? backlinks.value.backlinks : null,
    citations,
  };
}

function compare(prev: Snapshot, curr: Snapshot, domain: string): NewAlert[] {
  const alerts: NewAlert[] = [];

  if (prev.positions && curr.positions) {
    const drops: { kw: string; from: number; to: number | null; vol: number }[] = [];
    for (const [kw, p] of Object.entries(prev.positions)) {
      if (p.pos > 10) continue;
      const now = curr.positions[kw];
      if (!now) drops.push({ kw, from: p.pos, to: null, vol: p.vol });
      else if (now.pos - p.pos >= DROP_THRESHOLD) drops.push({ kw, from: p.pos, to: now.pos, vol: p.vol });
    }
    if (drops.length) {
      drops.sort((a, b) => b.vol - a.vol);
      const critical = drops.some(d => d.from <= 3 && (d.to === null || d.to > 10));
      alerts.push({
        kind: "positions",
        severity: critical ? "critical" : "warning",
        title: `${drops.length} mot${drops.length > 1 ? "s" : ""}-clé${drops.length > 1 ? "s" : ""} en recul sur ${domain}`,
        detail: drops.slice(0, 10)
          .map(d => `${d.kw} : ${d.from} → ${d.to === null ? `hors top ${TRACKED_MAX_POSITION}` : d.to} (${d.vol.toLocaleString("fr-FR")} rech./mois)`)
          .join("\n"),
      });
    }
  }

  if (prev.referringDomains && curr.referringDomains !== null) {
    const lost = prev.referringDomains - curr.referringDomains;
    if (lost >= 5 && lost / prev.referringDomains >= 0.1) {
      alerts.push({
        kind: "backlinks",
        severity: lost / prev.referringDomains >= 0.25 ? "critical" : "warning",
        title: `Perte de ${lost} domaines référents sur ${domain}`,
        detail: `${prev.referringDomains} → ${curr.referringDomains} domaines référents (-${Math.round((lost / prev.referringDomains) * 100)} %) en une semaine.`,
      });
    }
  }

  const lostCitations = Object.entries(prev.citations)
    .filter(([id, c]) => c.cited && curr.citations[id] && !curr.citations[id]!.cited)
    .map(([, c]) => c.prompt);
  if (lostCitations.length) {
    alerts.push({
      kind: "citations",
      severity: "warning",
      title: `${domain} n'est plus cité par les IA sur ${lostCitations.length} prompt${lostCitations.length > 1 ? "s" : ""}`,
      detail: lostCitations.slice(0, 10).map(p => `« ${p} »`).join("\n"),
    });
  }

  return alerts;
}

export async function runMonitoringForSite(userId: string, siteUrl: string): Promise<{ baseline: boolean; alerts: number }> {
  const sb = getServiceSupabase();
  const domain = cleanDomain(siteUrl);
  const curr = await takeSnapshot(userId, domain);

  const { data: prevRow } = await sb
    .from("monitoring_snapshots")
    .select("data")
    .eq("user_id", userId)
    .eq("site_url", domain)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: snapErr } = await sb.from("monitoring_snapshots").insert({ user_id: userId, site_url: domain, data: curr });
  if (snapErr) throw new Error(`Enregistrement de l'instantané impossible : ${snapErr.message}`);

  if (!prevRow) return { baseline: true, alerts: 0 };

  const alerts = compare(prevRow.data as Snapshot, curr, domain);
  if (alerts.length) {
    await sb.from("user_alerts").insert(alerts.map(a => ({ ...a, user_id: userId, site_url: domain })));
  }
  return { baseline: false, alerts: alerts.length };
}

export async function runMonitoringForAllSites(): Promise<{ sites: number; alerts: number; errors: number }> {
  const sb = getServiceSupabase();
  const [{ data: primaries }, { data: clients }] = await Promise.all([
    sb.from("user_site_profile").select("user_id,site_url"),
    sb.from("client_sites").select("user_id,site_url"),
  ]);

  const seen = new Set<string>();
  const targets = [...(primaries ?? []), ...(clients ?? [])].filter(s => {
    if (!s.site_url) return false;
    const key = `${s.user_id}:${cleanDomain(s.site_url)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let alerts = 0;
  let errors = 0;
  for (const t of targets) {
    try {
      alerts += (await runMonitoringForSite(t.user_id, t.site_url)).alerts;
    } catch (e) {
      errors++;
      console.error(`[monitoring] ${t.site_url}:`, e);
    }
  }
  return { sites: targets.length, alerts, errors };
}
