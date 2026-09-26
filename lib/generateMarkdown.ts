import type { Analysis } from "./types";
import type { Grade } from "./score";

function fmt(n: number | null | undefined, unit = "") {
  if (n == null) return "—";
  return `${n}${unit}`;
}

export function generateMarkdown(url: string, data: Analysis, score: number, grade: Grade): string {
  const date = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const lines: string[] = [];

  lines.push(`# Rapport d'audit SEO — ${url}`);
  lines.push(`\n> Généré le ${date} par [Search Mind](https://searchmind.cloud)`);
  lines.push(`\n---\n`);

  // Score
  lines.push(`## Score global : ${score}/100 (Grade ${grade})`);
  lines.push(`\n---\n`);

  // Technique de base
  lines.push(`## Technique de base`);
  lines.push(`- **Statut HTTP** : ${data.status} ${data.statusText}`);
  lines.push(`- **HTTPS** : ${data.security.https ? "✅ Oui" : "❌ Non"}`);
  lines.push(`- **Title** : ${data.title ?? "—"} (${data.title?.length ?? 0} caractères)`);
  lines.push(`- **Meta description** : ${data.description ?? "—"} (${data.description?.length ?? 0} caractères)`);
  lines.push(`- **Canonical** : ${data.canonical ?? "—"}`);
  lines.push(`- **H1** : ${data.h1Count} (idéal : 1)`);
  lines.push(`- **H2** : ${data.headings.h2} | **H3** : ${data.headings.h3} | **H4** : ${data.headings.h4}`);
  lines.push(`- **Liens internes** : ${data.internalLinks} | **Liens externes** : ${data.externalLinks}`);
  lines.push(`- **Images sans alt** : ${data.imagesMissingAlt}`);
  lines.push(`- **JSON-LD** : ${data.jsonLdDetected ? `✅ ${(data.jsonLdTypes ?? []).join(", ")}` : "❌ Absent"}`);
  lines.push(`- **Taille HTML** : ${Math.round(data.htmlSize / 1024)} Ko`);
  lines.push(`- **Temps de réponse** : ${data.responseTimeMs} ms`);
  lines.push(`\n`);

  // Indexation
  lines.push(`## Indexation`);
  lines.push(`- **robots.txt** : ${data.robotsTxt?.found ? "✅ Présent" : "❌ Absent"}`);
  if (data.robotsTxt?.found) {
    lines.push(`  - Bloque Googlebot : ${data.robotsTxt.blocksGooglebot ? "⚠️ Oui" : "Non"}`);
    if (data.robotsTxt.disallowedPaths.length > 0) {
      lines.push(`  - Paths bloqués : ${data.robotsTxt.disallowedPaths.slice(0, 5).join(", ")}`);
    }
  }
  lines.push(`- **Sitemap** : ${data.sitemap?.found ? `✅ ${data.sitemap.url ?? ""}` : "❌ Absent"}`);
  if (data.sitemap?.found) {
    lines.push(`  - URLs indexées : ${fmt(data.sitemap.urlCount)}`);
  }
  lines.push(`- **Meta robots** : ${data.robotsMeta ?? "Non défini (par défaut : index, follow)"}`);
  lines.push(`- **llms.txt** : ${data.hasLlmsTxt ? "✅ Présent" : "❌ Absent"}`);
  lines.push(`\n`);

  // Performance
  if (data.pagespeed) {
    lines.push(`## Performance (PageSpeed Insights)`);
    lines.push(`- **Score Performance** : ${fmt(data.pagespeed.performanceScore)}/100`);
    if (data.pagespeed.metrics) {
      const m = data.pagespeed.metrics;
      if (m.fcpMs != null) lines.push(`- **FCP** : ${(m.fcpMs / 1000).toFixed(1)} s`);
      if (m.lcpMs != null) lines.push(`- **LCP** : ${(m.lcpMs / 1000).toFixed(1)} s`);
      if (m.inpMs != null) lines.push(`- **INP** : ${m.inpMs} ms`);
      if (m.cls != null) lines.push(`- **CLS** : ${m.cls.toFixed(3)}`);
    }
    if (data.pagespeedAnalysis) {
      lines.push(`\n### Analyse`);
      lines.push(data.pagespeedAnalysis.summary);
      if (data.pagespeedAnalysis.recommendations.length > 0) {
        lines.push(`\n### Recommandations performance`);
        for (const r of data.pagespeedAnalysis.recommendations) {
          const icon = r.priority === "haute" ? "🔴" : r.priority === "moyenne" ? "🟡" : "🟢";
          lines.push(`- ${icon} **${r.titre}** — ${r.detail}`);
        }
      }
    }
    lines.push(`\n`);
  }

  // Autorité SEO
  lines.push(`## Autorité SEO`);
  if (data.openPageRank) {
    lines.push(`- **Open PageRank** : ${data.openPageRank.pageRankDecimal.toFixed(2)}/10`);
    if (data.openPageRank.referringDomains != null) {
      lines.push(`- **Domaines référents** : ${data.openPageRank.referringDomains}`);
    }
  }
  if (data.backlinks) {
    const ov = data.backlinks.overview;
    lines.push(`- **Authority Score (Semrush)** : ${fmt(ov.authorityScore)}/100`);
    lines.push(`- **Backlinks totaux** : ${ov.total}`);
    lines.push(`- **Domaines référents** : ${ov.referringDomains}`);
    if (data.backlinks.topReferringDomains.length > 0) {
      lines.push(`\n### Top domaines référents`);
      for (const d of data.backlinks.topReferringDomains.slice(0, 10)) {
        lines.push(`- ${d.domain} (AS: ${d.authorityScore ?? "—"}, ${d.backlinksCount} liens)`);
      }
    }
  }
  lines.push(`\n`);

  // Mots-clés
  if (data.keywords?.keywords.length) {
    lines.push(`## Mots-clés (${data.keywords.database.toUpperCase()})`);
    lines.push(`| Mot-clé | Position | Volume | Difficulté | CPC |`);
    lines.push(`|---------|----------|--------|------------|-----|`);
    for (const k of data.keywords.keywords.slice(0, 20)) {
      lines.push(`| ${k.keyword} | ${k.position} | ${k.searchVolume} | ${k.difficulty} | ${k.cpc.toFixed(2)}€ |`);
    }
    lines.push(`\n`);
  }

  // GSC
  if (data.gsc) {
    lines.push(`## Google Search Console (${data.gsc.lastDays} derniers jours)`);
    lines.push(`- **Clics** : ${data.gsc.clicks}`);
    lines.push(`- **Impressions** : ${data.gsc.impressions}`);
    lines.push(`- **CTR moyen** : ${(data.gsc.ctr * 100).toFixed(1)}%`);
    lines.push(`- **Position moyenne** : ${data.gsc.position.toFixed(1)}`);
    lines.push(`\n`);
  }

  // Open Graph
  lines.push(`## Open Graph & Réseaux sociaux`);
  lines.push(`- **OG Title** : ${data.openGraph.title ?? "—"}`);
  lines.push(`- **OG Description** : ${data.openGraph.description ?? "—"}`);
  lines.push(`- **OG Image** : ${data.openGraph.image ?? "—"}`);
  lines.push(`- **Twitter Card** : ${data.twitterCard.card ?? "—"}`);
  lines.push(`\n`);

  // Sécurité
  lines.push(`## Sécurité`);
  lines.push(`- **HTTPS** : ${data.security.https ? "✅" : "❌"}`);
  lines.push(`- **HSTS** : ${data.security.hsts ? "✅" : "❌"}`);
  lines.push(`- **X-Frame-Options** : ${data.security.xFrameOptions ?? "—"}`);
  lines.push(`- **X-Content-Type-Options** : ${data.security.xContentTypeOptions ?? "—"}`);
  lines.push(`- **CSP** : ${data.security.csp ? "✅" : "❌"}`);
  lines.push(`\n`);

  // Recommandations
  if (data.recommendations.length > 0) {
    lines.push(`## Recommandations prioritaires`);
    for (const r of data.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push(`\n`);
  }

  lines.push(`---`);
  lines.push(`*Rapport généré par Search Mind · searchmind.cloud*`);

  return lines.join("\n");
}
