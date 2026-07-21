import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generatePdfBuffer } from "@/lib/generatePdf";
import { computeScore } from "@/lib/score";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPERT_SYSTEM_PROMPT = `Comporte toi comme un expert SEO avec plus de 10 ans d'experiences. Tu as conduis et analysé des milliers d'étude de mots-clés, des optimisations techniques et tu maitrises les évolution du SEO et les dernières mises à jour en 2026. Tu fais partie des top 0,0001% des experts dans ton domaine. Tu as une capacité à fournir des explications claires pour le grand public mais également pour une audience plus aguerrie sur le sujet, tu intègre une dimension pédagogue dans tes réponses. Tu sais comprendre les problématiques et les besoins et proposer des solutions concrètes et des process pour réaliser ou automatiser certaines tâches SEO. Tu maitrises à la perfection les enjeux et les pré-requis SEO aujourd'hui : Guidelines quality rater EEAT, Optimisations du contenu pour la visibilité sur les IA, Signaux positifs pour le référencement (critères de mentions de marque), Maitrises des critères du SEO technique. Pour tes réponses, tu fournis des sources de qualité, vérifiées et pertinentes en fonction de la thématique du sujet.`;

async function generateAiAnalysis(url: string, data: Analysis, score: number, grade: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  const types = data.jsonLdTypes ?? [];
  const titleLen = data.title?.length ?? 0;
  const descLen = data.description?.length ?? 0;
  const ps = data.pagespeed;
  const bl = data.backlinks?.overview;

  const context = `
URL auditée : ${url}
Score SEO global : ${score}/100 (Grade ${grade})

--- TECHNIQUE ---
HTTPS : ${data.security.https ? "Oui" : "Non"}
robots.txt : ${data.robotsTxt?.found ? "Présent" : "Absent"}${data.robotsTxt?.blocksGooglebot ? " (bloque Googlebot !)" : ""}
Sitemap XML : ${data.sitemap?.found ? `Présent (${data.sitemap.urlCount ?? "?"} URLs)` : "Absent"}
Title : "${data.title ?? "—"}" (${titleLen} car.)
Meta description : "${data.description ? data.description.slice(0, 100) + "…" : "—"}" (${descLen} car.)
H1 : ${data.h1Count} · H2 : ${data.headings.h2} · H3 : ${data.headings.h3}
Liens internes / externes : ${data.internalLinks} / ${data.externalLinks}
Images sans alt : ${data.imagesMissingAlt}
Canonical : ${data.canonical ?? "Non défini"}
JSON-LD : ${data.jsonLdDetected ? `Oui (${types.join(", ")})` : "Non"}
Page À propos : ${data.hasAboutPage ? "Oui" : "Non"} · Page Contact : ${data.hasContactPage ? "Oui" : "Non"}
/llms.txt : ${data.hasLlmsTxt ? "Présent" : "Absent"}
Temps de réponse : ${data.responseTimeMs}ms

--- PERFORMANCE (PageSpeed) ---
${ps ? `Score : ${ps.performanceScore ?? "—"}/100
LCP : ${ps.metrics?.lcpMs != null ? `${(ps.metrics.lcpMs / 1000).toFixed(2)}s` : "—"}
INP : ${ps.metrics?.inpMs != null ? `${Math.round(ps.metrics.inpMs)}ms` : "—"}
CLS : ${ps.metrics?.cls != null ? ps.metrics.cls.toFixed(3) : "—"}
FCP : ${ps.metrics?.fcpMs != null ? `${(ps.metrics.fcpMs / 1000).toFixed(2)}s` : "—"}` : "Données non disponibles"}

--- AUTORITÉ ---
${bl ? `Authority Score Semrush : ${bl.authorityScore ?? "—"}/100
Backlinks : ${bl.total.toLocaleString("fr-FR")}
Domaines référents : ${bl.referringDomains.toLocaleString("fr-FR")}` : "Données Semrush non disponibles"}
${data.keywords?.keywords?.length ? `Mots-clés positionnés : ${data.keywords.keywords.length} (DB: ${data.keywords.database})` : ""}
${data.gsc ? `GSC — Clics : ${data.gsc.clicks} | Impressions : ${data.gsc.impressions} | CTR : ${(data.gsc.ctr * 100).toFixed(1)}% | Position moy. : ${data.gsc.position.toFixed(1)}` : ""}

--- RECOMMANDATIONS IDENTIFIÉES ---
${data.recommendations.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join("\n")}
`.trim();

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: EXPERT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Sur la base de cet audit SEO, rédige une analyse experte synthétique de 350 mots maximum en français. Identifie les points forts, les faiblesses prioritaires et donne 2-3 recommandations concrètes et actionnables. Adopte un ton professionnel et pédagogue, accessible à un client non-technique mais rigoureux pour un expert. N'utilise pas de titres ni de listes à puces — rédige en prose fluide.\n\n${context}`,
      }],
    });
    const block = msg.content[0];
    return block?.type === "text" ? block.text : "";
  } catch (err) {
    console.error("[export/pdf] AI analysis error:", err);
    return "";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { url: string; data: Analysis };
  const { url, data } = body;

  if (!url || !data) {
    return NextResponse.json({ error: "Missing url or data" }, { status: 400 });
  }

  const { score, grade } = computeScore(data);

  try {
    const aiAnalysis = await generateAiAnalysis(url, data, score, grade);
    const buffer = await generatePdfBuffer(url, data, score, grade, aiAnalysis);

    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `audit-seo-${hostname}-${date}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("[export/pdf] error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF." }, { status: 500 });
  }
}
