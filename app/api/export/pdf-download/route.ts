import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAuditWithMeta } from "@/lib/auditStore";
import { generatePdfBuffer } from "@/lib/generatePdf";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPERT_SYSTEM_PROMPT = `Tu es un expert SEO avec plus de 10 ans d'expérience. Tu rédiges des analyses synthétiques, claires et actionnables pour des clients non-techniques. Ton ton est professionnel, pédagogue et direct.`;

async function generateAiAnalysis(url: string, data: Analysis, score: number, grade: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  const ps = data.pagespeed;
  const bl = data.backlinks?.overview;

  const context = `
URL : ${url} | Score : ${score}/100 (${grade})
HTTPS : ${data.security.https ? "Oui" : "Non"} | Title : ${data.title?.length ?? 0} car. | Meta desc : ${data.description?.length ?? 0} car.
H1 : ${data.h1Count} | Images sans alt : ${data.imagesMissingAlt} | JSON-LD : ${data.jsonLdDetected ? "Oui" : "Non"}
robots.txt : ${data.robotsTxt?.found ? "Présent" : "Absent"} | Sitemap : ${data.sitemap?.found ? `Présent (${data.sitemap.urlCount} URLs)` : "Absent"}
${ps ? `PageSpeed : ${ps.performanceScore}/100 | LCP : ${ps.metrics?.lcpMs != null ? (ps.metrics.lcpMs / 1000).toFixed(2) + "s" : "—"} | CLS : ${ps.metrics?.cls?.toFixed(3) ?? "—"}` : ""}
${bl ? `Authority Score : ${bl.authorityScore}/100 | Backlinks : ${bl.total} | Domaines réf. : ${bl.referringDomains}` : ""}
${data.gsc ? `GSC : ${data.gsc.clicks} clics | ${data.gsc.impressions} impressions | CTR ${(data.gsc.ctr * 100).toFixed(1)}% | Pos. moy. ${data.gsc.position.toFixed(1)}` : ""}
Top recommandations : ${data.recommendations.slice(0, 6).join(" / ")}
`.trim();

  try {
    const ai = new Anthropic({ apiKey });
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: EXPERT_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Sur la base de cet audit, rédige une analyse experte de 400 mots maximum en français. Identifie les 2-3 forces, les 2-3 faiblesses prioritaires et donne des recommandations concrètes. Prose fluide, sans puces ni titres.\n\n${context}`,
      }],
    });
    const block = msg.content[0];
    return block?.type === "text" ? block.text : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const auditId = req.nextUrl.searchParams.get("auditId");
  if (!auditId) {
    return NextResponse.json({ error: "auditId manquant" }, { status: 400 });
  }

  const meta = await loadAuditWithMeta(auditId);
  if (!meta) {
    return NextResponse.json({ error: "Audit introuvable ou expiré" }, { status: 404 });
  }

  const { url, data, score, grade } = meta;

  try {
    const aiAnalysis = await generateAiAnalysis(url, data, score, grade);
    const buffer = await generatePdfBuffer(url, data, score, grade, aiAnalysis);

    const hostname = url !== "—" ? new URL(url.startsWith("http") ? url : `https://${url}`).hostname : "rapport";
    const date = new Date().toISOString().slice(0, 10);
    const filename = `rapport-seo-${hostname}-${date}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf-download]", e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
