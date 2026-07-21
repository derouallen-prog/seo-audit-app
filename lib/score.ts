import type { Analysis } from "./types";

export type Grade = "A" | "B" | "C" | "D";

export function gradeFromScore(s: number): Grade {
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  return "D";
}

export function computeScore(data: Analysis): { score: number; grade: Grade } {
  let pts = 0;
  let total = 70;

  // Technique (30 pts)
  if (data.security.https) pts += 10;
  if (data.status >= 200 && data.status < 300) pts += 8;
  if (data.robotsTxt?.found && !data.robotsTxt.blocksGooglebot) pts += 7;
  else if (data.robotsTxt?.found) pts += 3;
  if (data.sitemap?.found) pts += 5;

  // Contenu & Balises (40 pts)
  if (data.title) pts += 5;
  const tl = data.title?.length ?? 0;
  if (tl >= 30 && tl <= 65) pts += 5;
  if (data.description) pts += 5;
  const dl = data.description?.length ?? 0;
  if (dl >= 70 && dl <= 155) pts += 5;
  if (data.h1Count === 1) pts += 5;
  if (data.imagesMissingAlt === 0) pts += 5;
  if (data.jsonLdDetected) pts += 5;
  if (data.canonical) pts += 5;

  // Performance (30 pts) — optionnel
  const ps = data.pagespeed?.performanceScore;
  if (ps != null) {
    total = 100;
    pts += Math.round((ps / 100) * 30);
  }

  const score = Math.min(100, Math.round((pts / total) * 100));
  return { score, grade: gradeFromScore(score) };
}

/** Résumé textuel compact pour injecter dans le contexte de l'assistant. */
export function formatAuditForAssistant(data: Analysis, url: string, score: number, grade: Grade): string {
  const lines: string[] = [
    `## Contexte d'audit — ${new URL(url).hostname}`,
    `URL : ${url}`,
    `Score SEO global : ${score}/100 (Grade ${grade})`,
    "",
    "**Technique**",
    `- HTTPS : ${data.security.https ? "✓" : "✗"} | Statut HTTP : ${data.status} | Temps de réponse : ${data.responseTimeMs}ms`,
    `- robots.txt : ${data.robotsTxt?.found ? (data.robotsTxt.blocksGooglebot ? "✓ (bloque Googlebot ⚠️)" : "✓") : "✗"} | Sitemap : ${data.sitemap?.found ? `✓ (${data.sitemap.urlCount ?? "?"} URLs)` : "✗"}`,
    `- Canonical : ${data.canonical ? "✓ " + data.canonical : "✗"}`,
    "",
    "**Contenu & Balises**",
    `- Title : ${data.title ? `"${data.title.slice(0, 70)}" (${data.title.length} car.)` : "absent"}`,
    `- Meta description : ${data.description ? `"${data.description.slice(0, 80)}…" (${data.description.length} car.)` : "absente"}`,
    `- H1 : ${data.h1Count} | H2 : ${data.headings.h2} | H3 : ${data.headings.h3} | Images sans alt : ${data.imagesMissingAlt}`,
    `- JSON-LD : ${data.jsonLdDetected ? "✓" : "✗"}${(data.jsonLdTypes ?? []).length ? " (" + [...new Set(data.jsonLdTypes)].join(", ") + ")" : ""}`,
    `- Liens internes : ${data.internalLinks} | Liens externes : ${data.externalLinks}`,
  ];

  if (data.pagespeed) {
    const m = data.pagespeed.metrics ?? {};
    lines.push("", "**Performance (PageSpeed mobile)**");
    lines.push(`- Score : ${data.pagespeed.performanceScore ?? "—"}/100`);
    lines.push(`- LCP : ${m.lcpMs ? (m.lcpMs / 1000).toFixed(1) + "s" : "—"} | INP : ${m.inpMs ? (m.inpMs / 1000).toFixed(1) + "s" : "—"} | CLS : ${m.cls?.toFixed(3) ?? "—"} | FCP : ${m.fcpMs ? (m.fcpMs / 1000).toFixed(1) + "s" : "—"}`);
  }

  const types = data.jsonLdTypes ?? [];
  const hasOrg = types.some(t => ["Organization", "LocalBusiness", "Store", "Restaurant", "ProfessionalService"].includes(t));
  const hasFaq = types.some(t => t === "FAQPage");
  lines.push("", "**GEO / E-E-A-T**");
  lines.push(`- Schéma Organization/LocalBusiness : ${hasOrg ? "✓" : "✗"} | FAQ schema : ${hasFaq ? "✓" : "✗"}`);
  lines.push(`- Page À propos : ${data.hasAboutPage ? "✓" : "✗"} | Page Contact : ${data.hasContactPage ? "✓" : "✗"}`);
  lines.push(`- /llms.txt : ${data.hasLlmsTxt ? "✓" : "✗"}`);

  if (data.backlinks) {
    lines.push("", "**Autorité (Semrush)**");
    lines.push(`- Authority Score : ${data.backlinks.overview.authorityScore ?? "—"} | Backlinks : ${data.backlinks.overview.total.toLocaleString("fr-FR")} | Domaines référents : ${data.backlinks.overview.referringDomains.toLocaleString("fr-FR")}`);
  }
  if (data.openPageRank) {
    lines.push(`- Open PageRank : ${data.openPageRank.pageRankInteger}/10 (score précis : ${data.openPageRank.pageRankDecimal.toFixed(2)})`);
  }
  if (data.keywords && data.keywords.keywords.length > 0) {
    const top5 = data.keywords.keywords.slice(0, 5);
    lines.push("", "**Mots-clés positionnés (top 5)**");
    for (const kw of top5) {
      lines.push(`- "${kw.keyword}" → position ${kw.position} (volume ${kw.searchVolume.toLocaleString("fr-FR")} req/mois)`);
    }
    lines.push(`  … et ${data.keywords.keywords.length} mots-clés au total.`);
  }

  if (data.recommendations.length > 0) {
    lines.push("", "**Recommandations prioritaires**");
    data.recommendations.slice(0, 6).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }

  return lines.join("\n");
}
