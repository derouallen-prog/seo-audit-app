
import type { ReactNode, ReactElement } from "react";
import type { Analysis } from "./types";
import type { Grade } from "./score";

// Use eval('require') to bypass webpack bundling and get the SAME React instance
// as @react-pdf/renderer (which is a serverExternalPackage loaded via require()).
// Without this, Next.js bundles its own React causing error #31 in @react-pdf.

const R: typeof import("react") = (eval("require") as (m: string) => unknown)("react") as typeof import("react");
const pdf: typeof import("@react-pdf/renderer") = (eval("require") as (m: string) => unknown)("@react-pdf/renderer") as typeof import("@react-pdf/renderer");

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = pdf;
const ce = R.createElement;

// ── Palette ───────────────────────────────────────────────────────────────
const BRAND = "#5b21b6";
const INK = "#111827";
const SOFT = "#6b7280";
const HAIRLINE = "#e5e7eb";
const GREEN = "#16a34a";
const RED = "#dc2626";
const ORANGE = "#d97706";
const MUTED = "#f9fafb";

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: INK, padding: "32 44", lineHeight: 1.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  logo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND },
  headerRight: { alignItems: "flex-end" },
  headerLabel: { fontSize: 7.5, color: SOFT },
  headerUrl: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 2 },
  headerDate: { fontSize: 7.5, color: SOFT, marginTop: 2 },
  scoreRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  scoreBox: { width: 76, height: 76, borderRadius: 6, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 28, fontFamily: "Helvetica-Bold", color: "#fff" },
  scoreGrade: { fontSize: 9.5, color: "#c4b5fd", fontFamily: "Helvetica-Bold", marginTop: 2 },
  badgesWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4, alignContent: "flex-start" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 7, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 160, color: SOFT, fontSize: 8 },
  value: { flex: 1, fontSize: 8, color: INK },
  bold: { fontFamily: "Helvetica-Bold" },
  reco: { flexDirection: "row", marginBottom: 3 },
  recoBullet: { width: 14, color: BRAND, fontFamily: "Helvetica-Bold", fontSize: 8 },
  recoText: { flex: 1, fontSize: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 3, paddingHorizontal: 5 },
  tableHeaderCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff" },
  tableRow: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  tableCell: { fontSize: 7.5 },
  geoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  geoIcon: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", marginTop: 1 },
  geoIconText: { fontSize: 6.5, fontFamily: "Helvetica-Bold" },
  aiBox: { backgroundColor: "#f5f3ff", borderWidth: 1, borderColor: "#ddd6fe", borderRadius: 6, padding: 10, marginTop: 8 },
  aiTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 4 },
  aiText: { fontSize: 8, color: INK, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 20, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 5 },
  footerText: { fontSize: 6.5, color: SOFT },
  statBox: { borderRadius: 5, padding: 6, borderWidth: 1, borderColor: "#ddd6fe", backgroundColor: "#f5f3ff", alignItems: "center", flex: 1 },
  statLabel: { fontSize: 6.5, color: SOFT, marginBottom: 1 },
  statValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND },
});

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtMs(ms?: number): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function badgeEl(label: string, ok: boolean, warn?: boolean) {
  const bg = ok ? "#f0fdf4" : warn ? "#fffbeb" : "#fef2f2";
  const border = ok ? "#bbf7d0" : warn ? "#fde68a" : "#fecaca";
  const color = ok ? GREEN : warn ? ORANGE : RED;
  const icon = ok ? "✓" : warn ? "⚠" : "✗";
  return ce(View, { key: label, style: [s.badge, { backgroundColor: bg, borderColor: border }] },
    ce(Text, { style: [s.badgeText, { color }] }, `${icon} ${label}`)
  );
}

function rowEl(label: string, value: string, ok?: boolean | null, key?: string) {
  const color = ok === true ? GREEN : ok === false ? RED : INK;
  return ce(View, { key: key ?? label, style: s.row },
    ce(Text, { style: s.label }, label),
    ce(Text, { style: [s.value, { color }] }, value)
  );
}

function sectionEl(title: string, children: ReactNode[]) {
  return ce(View, { key: title, style: s.section },
    ce(Text, { style: s.sectionTitle }, title),
    ...(children as ReactElement[])
  );
}

function geoRowEl(label: string, ok?: boolean, warn?: boolean, hint?: string) {
  const iconBg = ok ? "#dcfce7" : warn ? "#fef3c7" : "#fee2e2";
  const iconColor = ok ? GREEN : warn ? ORANGE : RED;
  const iconTxt = ok ? "✓" : warn ? "~" : "✗";
  return ce(View, { key: label, style: s.geoRow },
    ce(View, { style: [s.geoIcon, { backgroundColor: iconBg }] },
      ce(Text, { style: [s.geoIconText, { color: iconColor }] }, iconTxt)
    ),
    ce(View, { style: { flex: 1 } },
      ce(Text, { style: { fontSize: 8, color: INK } }, label),
      ...(hint ? [ce(Text, { style: { fontSize: 7, color: SOFT, marginTop: 1 } }, hint)] : [])
    )
  );
}

function statEl(label: string, value: string) {
  return ce(View, { key: label, style: s.statBox },
    ce(Text, { style: s.statLabel }, label),
    ce(Text, { style: s.statValue }, value)
  );
}

function footer(url: string) {
  return ce(View, { style: s.footer, fixed: true },
    ce(Text, { style: s.footerText }, `Search Mind · ${url}`),
    ce(Text, { style: s.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` })
  );
}

function pageHeader(url: string, subtitle: string, date: string) {
  return ce(View, { style: s.header },
    ce(Text, { style: s.logo }, "Search Mind"),
    ce(View, { style: s.headerRight },
      ce(Text, { style: s.headerLabel }, subtitle),
      ce(Text, { style: s.headerUrl }, url),
      ce(Text, { style: s.headerDate }, date)
    )
  );
}

// ── Page 1 : Vue d'ensemble ───────────────────────────────────────────────
function page1(url: string, data: Analysis, score: number, grade: Grade, date: string) {
  const gradeName = grade === "A" ? "Excellent" : grade === "B" ? "Bon" : grade === "C" ? "À améliorer" : "Critique";
  const titleLen = data.title?.length ?? 0;
  const descLen = data.description?.length ?? 0;

  const scoreRow = ce(View, { style: s.scoreRow },
    ce(View, { style: s.scoreBox },
      ce(Text, { style: s.scoreNum }, String(score)),
      ce(Text, { style: s.scoreGrade }, `Grade ${grade} · ${gradeName}`)
    ),
    ce(View, { style: s.badgesWrap },
      badgeEl("HTTPS", data.security.https),
      badgeEl(`HTTP ${data.status}`, data.status >= 200 && data.status < 300),
      badgeEl("Title", !!data.title && titleLen >= 30 && titleLen <= 65, !!data.title && (titleLen < 30 || titleLen > 65)),
      badgeEl("Meta desc.", !!data.description && descLen >= 70 && descLen <= 155, !!data.description && (descLen < 70 || descLen > 155)),
      badgeEl(`H1 (${data.h1Count})`, data.h1Count === 1, data.h1Count > 1),
      badgeEl("JSON-LD", data.jsonLdDetected),
      badgeEl("robots.txt", data.robotsTxt?.found ?? false),
      badgeEl("Sitemap", data.sitemap?.found ?? false),
    )
  );

  const techRows = [
    rowEl("Titre", data.title ?? "—"),
    ...(data.title ? [rowEl("Longueur du titre", `${titleLen} car. (cible 30–65)`, titleLen >= 30 && titleLen <= 65, "titlen")] : []),
    rowEl("Meta description", data.description ? data.description.slice(0, 90) + (descLen > 90 ? "…" : "") : "—", undefined, "metadesc"),
    ...(data.description ? [rowEl("Longueur meta desc.", `${descLen} car. (cible 70–155)`, descLen >= 70 && descLen <= 155, "desclen")] : []),
    rowEl("Canonical", data.canonical ?? "Non défini"),
    rowEl("H1 / H2 / H3", `${data.h1Count} / ${data.headings.h2} / ${data.headings.h3}`, data.h1Count === 1, "hn"),
    rowEl("Liens internes / externes", `${data.internalLinks} / ${data.externalLinks}`, undefined, "links"),
    rowEl("Images sans alt", String(data.imagesMissingAlt), data.imagesMissingAlt === 0, "imgs"),
    rowEl("Taille HTML", `${Math.round(data.htmlSize / 1024)} Ko`, undefined, "size"),
    rowEl("Temps de réponse", fmtMs(data.responseTimeMs), data.responseTimeMs < 800, "resp"),
    rowEl("JSON-LD", data.jsonLdDetected ? ((data.jsonLdTypes ?? []).join(", ") || "Présent") : "Absent", data.jsonLdDetected, "jsonld"),
  ];

  const indexRows = [
    rowEl("robots.txt", data.robotsTxt?.found ? "Présent" : "Absent", data.robotsTxt?.found, "rtxt"),
    ...(data.robotsTxt?.found ? [rowEl("Bloque Googlebot", data.robotsTxt.blocksGooglebot ? "Oui ⚠" : "Non", !data.robotsTxt.blocksGooglebot, "gbot")] : []),
    rowEl("Sitemap", data.sitemap?.found ? (data.sitemap.url ?? "Présent") : "Absent", data.sitemap?.found, "smap"),
    ...(data.sitemap?.found && data.sitemap.urlCount != null ? [rowEl("URLs dans le sitemap", String(data.sitemap.urlCount), undefined, "smapn")] : []),
    rowEl("Meta robots", data.robotsMeta ?? "Non défini (index, follow par défaut)", undefined, "mrobot"),
    rowEl("llms.txt (GEO)", data.hasLlmsTxt ? "Présent" : "Absent", !!data.hasLlmsTxt, "llms"),
  ];

  const perfRows: ReactNode[] = data.pagespeed ? [
    rowEl("Score Performance", data.pagespeed.performanceScore != null ? `${data.pagespeed.performanceScore}/100` : "—",
      data.pagespeed.performanceScore != null ? data.pagespeed.performanceScore >= 90 : null, "perf"),
    ...(data.pagespeed.metrics?.lcpMs != null ? [rowEl("LCP", fmtMs(data.pagespeed.metrics.lcpMs), data.pagespeed.metrics.lcpMs < 2500, "lcp")] : []),
    ...(data.pagespeed.metrics?.inpMs != null ? [rowEl("INP", fmtMs(data.pagespeed.metrics.inpMs), data.pagespeed.metrics.inpMs < 200, "inp")] : []),
    ...(data.pagespeed.metrics?.cls != null ? [rowEl("CLS", data.pagespeed.metrics.cls.toFixed(3), data.pagespeed.metrics.cls < 0.1, "cls")] : []),
    ...(data.pagespeed.metrics?.fcpMs != null ? [rowEl("FCP", fmtMs(data.pagespeed.metrics.fcpMs), data.pagespeed.metrics.fcpMs < 1800, "fcp")] : []),
    ...(data.pagespeedAnalysis ? [
      ce(View, { key: "pssummary", style: { marginTop: 4 } },
        ce(Text, { style: [s.value, { color: SOFT, fontSize: 7.5, lineHeight: 1.5 }] }, data.pagespeedAnalysis.summary)
      ),
      ...data.pagespeedAnalysis.recommendations.slice(0, 5).map((r, i) =>
        ce(View, { key: `psr${i}`, style: { flexDirection: "row", gap: 5, marginTop: 2 } },
          ce(View, { style: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: r.priority === "haute" ? "#fee2e2" : r.priority === "moyenne" ? "#fef3c7" : "#f3f4f6" } },
            ce(Text, { style: { fontSize: 6, fontFamily: "Helvetica-Bold", color: r.priority === "haute" ? RED : r.priority === "moyenne" ? ORANGE : SOFT } },
              r.priority === "haute" ? "HAUTE" : r.priority === "moyenne" ? "MOY." : "FAIBLE")
          ),
          ce(View, { style: { flex: 1 } },
            ce(Text, { style: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: INK } }, r.titre),
            ce(Text, { style: { fontSize: 7, color: SOFT, lineHeight: 1.4 } }, r.detail)
          )
        )
      )
    ] : []),
  ] : [ce(Text, { key: "noperf", style: [s.value, { color: SOFT }] }, "Données PageSpeed non disponibles.")];

  return ce(Page, { size: "A4", style: s.page },
    pageHeader(url, "Rapport d'audit SEO — Vue d'ensemble", date),
    scoreRow,
    sectionEl("Technique de base", techRows),
    sectionEl("Indexation", indexRows),
    sectionEl("Performance (PageSpeed Insights)", perfRows),
    footer(url)
  );
}

// ── Page 2 : Autorité SEO ─────────────────────────────────────────────────
function page2(url: string, data: Analysis, date: string) {
  const children: ReactNode[] = [];

  // GSC data
  if (data.gsc) {
    children.push(sectionEl("Search Console", [
      ce(View, { key: "gscstats", style: { flexDirection: "row", gap: 6, marginBottom: 4 } },
        statEl(`Clics (${data.gsc.lastDays}j)`, data.gsc.clicks.toLocaleString("fr-FR")),
        statEl("Impressions", data.gsc.impressions.toLocaleString("fr-FR")),
        statEl("CTR", `${(data.gsc.ctr * 100).toFixed(1)}%`),
        statEl("Position moy.", data.gsc.position.toFixed(1))
      )
    ]));
  }

  // Backlinks
  if (data.backlinks) {
    const bl = data.backlinks;
    children.push(sectionEl("Backlinks (Semrush)", [
      ce(View, { key: "blstats", style: { flexDirection: "row", gap: 6, marginBottom: 6 } },
        statEl("Authority Score", bl.overview.authorityScore != null ? `${bl.overview.authorityScore}/100` : "—"),
        statEl("Backlinks", bl.overview.total.toLocaleString("fr-FR")),
        statEl("Domaines référents", bl.overview.referringDomains.toLocaleString("fr-FR")),
        statEl("IPs référentes", bl.overview.referringIps.toLocaleString("fr-FR"))
      ),
      ...(bl.topReferringDomains.length > 0 ? [
        ce(Text, { key: "blth", style: { fontSize: 8, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 3 } }, "Top domaines référents"),
        ce(View, { key: "blhdr", style: s.tableHeader },
          ce(Text, { style: [s.tableHeaderCell, { flex: 4 }] }, "Domaine"),
          ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "AS"),
          ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Backlinks"),
        ),
        ...bl.topReferringDomains.slice(0, 15).map((d, i) =>
          ce(View, { key: `bld${i}`, style: [s.tableRow, { backgroundColor: i % 2 === 0 ? "#fff" : MUTED }] },
            ce(Text, { style: [s.tableCell, { flex: 4 }] }, d.domain),
            ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, d.authorityScore != null ? String(d.authorityScore) : "—"),
            ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, d.backlinksCount.toLocaleString("fr-FR")),
          )
        )
      ] : [])
    ]));
  }

  // Mots-clés positionnés
  if (data.keywords?.keywords && data.keywords.keywords.length > 0) {
    const kws = data.keywords.keywords.slice(0, 25);
    children.push(sectionEl(`Mots-clés positionnés — Top ${kws.length} (${data.keywords.database.toUpperCase()})`, [
      ce(View, { key: "kwhdr", style: s.tableHeader },
        ce(Text, { style: [s.tableHeaderCell, { flex: 4 }] }, "Mot-clé"),
        ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Pos."),
        ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Volume"),
        ce(Text, { style: [s.tableHeaderCell, { flex: 2 }] }, "URL"),
        ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Trafic %"),
      ),
      ...kws.map((k, i) =>
        ce(View, { key: `kw${i}`, style: [s.tableRow, { backgroundColor: i % 2 === 0 ? "#fff" : MUTED }] },
          ce(Text, { style: [s.tableCell, { flex: 4 }] }, k.keyword),
          ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right", color: k.position <= 3 ? GREEN : k.position <= 10 ? ORANGE : INK, fontFamily: "Helvetica-Bold" }] }, String(k.position)),
          ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, k.searchVolume.toLocaleString("fr-FR")),
          ce(Text, { style: [s.tableCell, { flex: 2, fontSize: 6.5 }] }, k.url ? k.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 28) + (k.url.length > 28 ? "…" : "") : "—"),
          ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, `${k.traffic.toFixed(1)}%`),
        )
      )
    ]));
  }

  // Top pages organiques
  if (data.domainTopPages?.pages && data.domainTopPages.pages.length > 0) {
    const pages = data.domainTopPages.pages.slice(0, 15);
    children.push(sectionEl(`Top pages organiques (${data.domainTopPages.database.toUpperCase()})`, [
      ce(View, { key: "tphdr", style: s.tableHeader },
        ce(Text, { style: [s.tableHeaderCell, { flex: 5 }] }, "URL"),
        ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Mots-clés"),
        ce(Text, { style: [s.tableHeaderCell, { flex: 1, textAlign: "right" }] }, "Trafic"),
      ),
      ...pages.map((p, i) =>
        ce(View, { key: `tp${i}`, style: [s.tableRow, { backgroundColor: i % 2 === 0 ? "#fff" : MUTED }] },
          ce(Text, { style: [s.tableCell, { flex: 5, fontSize: 6.5 }] }, p.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 50) + (p.url.length > 50 ? "…" : "")),
          ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, p.keywords.toLocaleString("fr-FR")),
          ce(Text, { style: [s.tableCell, { flex: 1, textAlign: "right" }] }, p.traffic.toLocaleString("fr-FR")),
        )
      )
    ]));
  }

  if (children.length === 0) {
    children.push(ce(Text, { key: "noauth", style: [s.value, { color: SOFT }] }, "Données Semrush non disponibles pour ce domaine."));
  }

  return ce(Page, { size: "A4", style: s.page },
    pageHeader(url, "Autorité SEO", date),
    ...(children as ReactElement[]),
    footer(url)
  );
}

// ── Page 3 : Contenu & balises ────────────────────────────────────────────
function page3(url: string, data: Analysis, date: string) {
  const titleLen = data.title?.length ?? 0;
  const descLen = data.description?.length ?? 0;

  const balisesRows = [
    // Title
    ce(View, { key: "titleblk", style: { borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 6, marginBottom: 5 } },
      ce(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 } },
        ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase" } }, "TITLE"),
        ce(View, { style: [s.badge, {
          backgroundColor: data.title && titleLen >= 30 && titleLen <= 65 ? "#f0fdf4" : "#fef2f2",
          borderColor: data.title && titleLen >= 30 && titleLen <= 65 ? "#bbf7d0" : "#fecaca",
        }] },
          ce(Text, { style: [s.badgeText, { color: data.title && titleLen >= 30 && titleLen <= 65 ? GREEN : RED }] },
            `${titleLen} car. (cible 30–65)`)
        )
      ),
      ce(Text, { style: { fontSize: 8, color: INK } }, data.title ?? "—")
    ),
    // Meta description
    ce(View, { key: "metablk", style: { borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 6, marginBottom: 5 } },
      ce(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 } },
        ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase" } }, "META DESCRIPTION"),
        ce(View, { style: [s.badge, {
          backgroundColor: data.description && descLen >= 70 && descLen <= 155 ? "#f0fdf4" : "#fef2f2",
          borderColor: data.description && descLen >= 70 && descLen <= 155 ? "#bbf7d0" : "#fecaca",
        }] },
          ce(Text, { style: [s.badgeText, { color: data.description && descLen >= 70 && descLen <= 155 ? GREEN : RED }] },
            `${descLen} car. (cible 70–155)`)
        )
      ),
      ce(Text, { style: { fontSize: 8, color: INK } }, data.description ?? "—")
    ),
    // Structure Hn
    ce(View, { key: "hnblk", style: { marginBottom: 5 } },
      ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase", marginBottom: 3 } }, "STRUCTURE DES TITRES"),
      ce(View, { style: { flexDirection: "row", gap: 5 } },
        ...[
          { label: "H1", v: data.h1Count, ok: data.h1Count === 1, warn: data.h1Count > 1 },
          { label: "H2", v: data.headings.h2 },
          { label: "H3", v: data.headings.h3 },
          { label: "H4", v: data.headings.h4 },
        ].map(({ label, v, ok, warn }) =>
          ce(View, { key: label, style: { borderRadius: 4, borderWidth: 1, borderColor: ok ? "#bbf7d0" : warn ? "#fde68a" : HAIRLINE, backgroundColor: ok ? "#f0fdf4" : warn ? "#fffbeb" : "#fff", paddingHorizontal: 8, paddingVertical: 4 } },
            ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT } }, label),
            ce(Text, { style: { fontSize: 14, fontFamily: "Helvetica-Bold", color: INK } }, String(v))
          )
        )
      )
    ),
    // Liens & images
    ce(View, { key: "linksblk", style: { marginBottom: 5 } },
      ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase", marginBottom: 3 } }, "LIENS & IMAGES"),
      ce(View, { style: { flexDirection: "row", gap: 5 } },
        ce(View, { style: { borderRadius: 4, borderWidth: 1, borderColor: HAIRLINE, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" } },
          ce(Text, { style: { fontSize: 14, fontFamily: "Helvetica-Bold", color: INK } }, String(data.internalLinks)),
          ce(Text, { style: { fontSize: 6.5, color: SOFT } }, "Liens internes")
        ),
        ce(View, { style: { borderRadius: 4, borderWidth: 1, borderColor: HAIRLINE, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" } },
          ce(Text, { style: { fontSize: 14, fontFamily: "Helvetica-Bold", color: INK } }, String(data.externalLinks)),
          ce(Text, { style: { fontSize: 6.5, color: SOFT } }, "Liens externes")
        ),
        ce(View, { style: { borderRadius: 4, borderWidth: 1, borderColor: data.imagesMissingAlt === 0 ? "#bbf7d0" : "#fecaca", backgroundColor: data.imagesMissingAlt === 0 ? "#f0fdf4" : "#fef2f2", paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" } },
          ce(Text, { style: { fontSize: 14, fontFamily: "Helvetica-Bold", color: data.imagesMissingAlt === 0 ? GREEN : RED } }, String(data.imagesMissingAlt)),
          ce(Text, { style: { fontSize: 6.5, color: SOFT } }, "Images sans alt")
        )
      )
    ),
    // Signaux techniques
    ce(View, { key: "signalblk", style: { marginBottom: 5 } },
      ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase", marginBottom: 3 } }, "SIGNAUX TECHNIQUES"),
      ce(View, { style: { flexDirection: "row", gap: 4, flexWrap: "wrap" } },
        badgeEl("JSON-LD", data.jsonLdDetected),
        badgeEl("Canonical", !!data.canonical),
        badgeEl("Robots meta", !!data.robotsMeta),
        badgeEl("Sitemap link", !!data.sitemapHref),
        badgeEl("HTTPS", data.security.https),
        badgeEl("HSTS", data.security.hsts),
      )
    ),
    // Types JSON-LD
    ...(data.jsonLdTypes && data.jsonLdTypes.length > 0 ? [
      ce(View, { key: "jsonldtypes", style: { marginBottom: 5 } },
        ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase", marginBottom: 3 } }, "TYPES JSON-LD DÉTECTÉS"),
        ce(View, { style: { flexDirection: "row", gap: 3, flexWrap: "wrap" } },
          ...[...new Set(data.jsonLdTypes)].map(t =>
            ce(View, { key: t, style: { borderRadius: 10, backgroundColor: "#f5f3ff", paddingHorizontal: 6, paddingVertical: 1.5 } },
              ce(Text, { style: { fontSize: 7, color: BRAND, fontFamily: "Helvetica-Bold" } }, t)
            )
          )
        )
      )
    ] : []),
    // Open Graph
    ...(data.openGraph?.title || data.openGraph?.description ? [
      ce(View, { key: "ogblk", style: { marginBottom: 5 } },
        ce(Text, { style: { fontSize: 7, fontFamily: "Helvetica-Bold", color: SOFT, textTransform: "uppercase", marginBottom: 3 } }, "OPEN GRAPH"),
        ...(data.openGraph.title ? [rowEl("OG Title", data.openGraph.title, undefined, "ogtitle")] : []),
        ...(data.openGraph.description ? [rowEl("OG Description", data.openGraph.description.slice(0, 80) + (data.openGraph.description.length > 80 ? "…" : ""), undefined, "ogdesc")] : []),
        ...(data.openGraph.type ? [rowEl("OG Type", data.openGraph.type, undefined, "ogtype")] : []),
        ...(data.openGraph.image ? [rowEl("OG Image", data.openGraph.image.slice(0, 50) + "…", undefined, "ogimg")] : []),
      )
    ] : []),
  ];

  return ce(Page, { size: "A4", style: s.page },
    pageHeader(url, "Contenu & balises", date),
    sectionEl("Balises SEO & Signaux on-page", balisesRows),
    footer(url)
  );
}

// ── Page 4 : GEO / LLMs ───────────────────────────────────────────────────
function page4(url: string, data: Analysis, date: string) {
  const types = data.jsonLdTypes ?? [];
  const hasOrg = types.some(t => ["Organization", "LocalBusiness", "Store", "Restaurant", "ProfessionalService"].includes(t));
  const hasPerson = types.some(t => ["Person", "Author"].includes(t));
  const hasFaq = types.some(t => t === "FAQPage");
  const hasArticle = types.some(t => ["Article", "BlogPosting", "NewsArticle", "WebPage"].includes(t));
  const hasBreadcrumb = types.some(t => t === "BreadcrumbList");
  const hasProduct = types.some(t => t === "Product");
  const hasReview = types.some(t => ["Review", "AggregateRating"].includes(t));
  const technicalOk = data.security.https && (data.robotsTxt?.found ?? false) && (data.sitemap?.found ?? false) && !!data.canonical;
  const technicalWarn = !technicalOk && (data.security.https || (data.robotsTxt?.found ?? false));
  const contentDepth = data.htmlSize > 50000 ? "ok" : data.htmlSize > 20000 ? "warn" : "error";
  const headingStructure = data.headings.h2 >= 3 ? "ok" : data.headings.h2 >= 1 ? "warn" : "error";

  let geoPts = 0;
  if (data.jsonLdDetected) geoPts += 15;
  if (hasOrg) geoPts += 10;
  if (hasPerson) geoPts += 5;
  if (data.hasAboutPage) geoPts += 10;
  if (data.hasContactPage) geoPts += 10;
  if (hasFaq) geoPts += 15;
  if (hasBreadcrumb) geoPts += 5;
  if (technicalOk) geoPts += 15;
  else if (technicalWarn) geoPts += 7;
  if (contentDepth === "ok") geoPts += 10;
  else if (contentDepth === "warn") geoPts += 5;
  if (headingStructure === "ok") geoPts += 5;
  const geoScore = Math.min(100, geoPts);
  const geoLabel = geoScore >= 70 ? "Bon" : geoScore >= 40 ? "À renforcer" : "Insuffisant";
  const geoColor = geoScore >= 70 ? GREEN : geoScore >= 40 ? ORANGE : RED;

  return ce(Page, { size: "A4", style: s.page },
    pageHeader(url, "GEO / Visibilité IA", date),

    // Score GEO
    sectionEl("Score GEO / LLMs", [
      ce(View, { key: "geoscorebox", style: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#f5f3ff", borderRadius: 6, padding: 8, marginBottom: 4 } },
        ce(View, { style: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" } },
          ce(Text, { style: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#fff" } }, String(geoScore))
        ),
        ce(View, {},
          ce(Text, { style: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK } }, geoLabel),
          ce(Text, { style: { fontSize: 7, color: SOFT, marginTop: 2 } }, `Score GEO : ${geoScore}/100 — Visibilité sur ChatGPT, Perplexity, Gemini…`)
        )
      )
    ]),

    // EEAT
    sectionEl("Signaux E-E-A-T", [
      geoRowEl("Données structurées (JSON-LD) présentes", data.jsonLdDetected, undefined, "Incontournables pour les extraits enrichis et la compréhension par les LLMs."),
      geoRowEl("Schéma Organization / LocalBusiness", hasOrg, undefined, "Identifie la marque, l'adresse, le secteur."),
      geoRowEl("Schéma Person / Author", hasPerson, undefined, "Indique une expertise identifiable."),
      geoRowEl("Page À propos détectée", data.hasAboutPage ?? false, undefined, "Signal de confiance (Trustworthiness)."),
      geoRowEl("Page Contact détectée", data.hasContactPage ?? false, undefined, "Signal de légitimité de la marque."),
      geoRowEl("Fil d'Ariane (BreadcrumbList)", hasBreadcrumb, undefined, "Structure la hiérarchie pour les crawlers et les IA."),
    ]),

    // Prérequis LLMs
    sectionEl("Prérequis pour les plateformes génératives", [
      geoRowEl("Contenu FAQ (FAQPage schema)", hasFaq, undefined, "Format conversationnel privilégié par les LLMs."),
      geoRowEl("Contenu éditorial (Article / BlogPosting)", hasArticle, undefined, "Signale un contenu de référence citable."),
      geoRowEl("Données produit (Product schema)", hasProduct, undefined, "Essentiel pour la visibilité dans les résultats d'achat IA."),
      geoRowEl("Avis / notes structurés (AggregateRating)", hasReview, undefined, "Renforce la crédibilité, peut déclencher des rich results."),
      geoRowEl(`Densité du contenu (${(data.htmlSize / 1024).toFixed(0)} Ko HTML)`, contentDepth === "ok", contentDepth === "warn",
        "≥ 50 Ko : riche · 20–50 Ko : moyen · < 20 Ko : trop court."),
      geoRowEl(`Structure de titres (${data.headings.h2} H2, ${data.headings.h3} H3)`, headingStructure === "ok", headingStructure === "warn",
        "≥ 3 H2 bien nommés facilitent l'extraction par les IA."),
      geoRowEl("/llms.txt présent", data.hasLlmsTxt ?? false, undefined, "Équivalent robots.txt pour les LLMs."),
    ]),

    // Socle technique
    sectionEl("Socle SEO technique", [
      geoRowEl("HTTPS activé", data.security.https, undefined, "Prérequis absolu de confiance."),
      geoRowEl("robots.txt présent", data.robotsTxt?.found ?? false, undefined, "Guide les crawlers."),
      geoRowEl("Sitemap XML disponible", data.sitemap?.found ?? false, undefined, "Facilite l'indexation complète."),
      geoRowEl("URL canonique définie", !!data.canonical, undefined, "Évite la dilution de l'autorité."),
      geoRowEl("Balise title optimisée (30–65 car.)", !!data.title && data.title.length >= 30 && data.title.length <= 65,
        !!data.title && (data.title.length < 30 || data.title.length > 65)),
    ]),

    footer(url)
  );
}

// ── Page 5 : Recommandations + Analyse IA ────────────────────────────────
function page5(url: string, data: Analysis, date: string, aiAnalysis?: string) {
  return ce(Page, { size: "A4", style: s.page },
    pageHeader(url, "Recommandations & Analyse experte", date),

    sectionEl(`Recommandations prioritaires (${data.recommendations.length})`, [
      ...data.recommendations.map((r, i) =>
        ce(View, { key: i, style: s.reco },
          ce(View, { style: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center", marginRight: 2, marginTop: 0.5 } },
            ce(Text, { style: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: BRAND } }, String(i + 1))
          ),
          ce(Text, { style: s.recoText }, r)
        )
      )
    ]),

    ...(aiAnalysis ? [
      ce(View, { key: "aibox", style: s.aiBox },
        ce(View, { style: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 } },
          ce(View, { style: { width: 16, height: 16, borderRadius: 4, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" } },
            ce(Text, { style: { fontSize: 9, color: "#fff" } }, "✦")
          ),
          ce(Text, { style: s.aiTitle }, "Analyse experte SEO")
        ),
        ce(Text, { style: s.aiText }, aiAnalysis)
      )
    ] : []),

    footer(url)
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export async function generatePdfBuffer(
  url: string,
  data: Analysis,
  score: number,
  grade: Grade,
  aiAnalysis?: string
): Promise<Buffer> {
  const date = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  const doc = ce(Document, { title: `Audit SEO — ${url}`, author: "Search Mind" },
    page1(url, data, score, grade, date),
    page2(url, data, date),
    page3(url, data, date),
    page4(url, data, date),
    page5(url, data, date, aiAnalysis)
  );

  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}
