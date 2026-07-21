import Anthropic from "@anthropic-ai/sdk";
import type { GtMetrixResult } from "./gtmetrix";

export interface PageSpeedRecommendation {
  priority: "haute" | "moyenne" | "faible";
  titre: string;
  detail: string;
}

export interface PageSpeedAnalysisResult {
  summary: string;
  recommendations: PageSpeedRecommendation[];
}

interface PageContext {
  url: string;
  responseTimeMs: number;
  htmlSizeKb: number;
  score: number | null;
  fcpMs?: number;
  lcpMs?: number;
  inpMs?: number;
  cls?: number;
  h1Count: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  jsonLdDetected: boolean;
  https: boolean;
  title: string | null;
  description: string | null;
  gtmetrix?: GtMetrixResult | null;
}

function tier(value: number, good: number, mid: number): "Bon" | "À améliorer" | "Mauvais" {
  return value <= good ? "Bon" : value <= mid ? "À améliorer" : "Mauvais";
}

export async function generatePageSpeedAnalysis(ctx: PageContext): Promise<PageSpeedAnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const lines: string[] = [
    ctx.score != null ? `Score Lighthouse mobile : ${ctx.score}/100 (${ctx.score >= 90 ? "Bon" : ctx.score >= 50 ? "À améliorer" : "Mauvais"})` : "Score Lighthouse : indisponible",
    ctx.fcpMs ? `FCP : ${(ctx.fcpMs / 1000).toFixed(2)}s — ${tier(ctx.fcpMs, 1800, 3000)}` : "FCP : indisponible",
    ctx.lcpMs ? `LCP : ${(ctx.lcpMs / 1000).toFixed(2)}s — ${tier(ctx.lcpMs, 2500, 4000)}` : "LCP : indisponible",
    ctx.inpMs ? `INP : ${ctx.inpMs}ms — ${tier(ctx.inpMs, 200, 500)}` : "INP : indisponible",
    ctx.cls != null ? `CLS : ${ctx.cls.toFixed(3)} — ${tier(ctx.cls, 0.1, 0.25)}` : "CLS : indisponible",
    `Temps de réponse serveur : ${ctx.responseTimeMs}ms`,
    `Taille HTML : ${ctx.htmlSizeKb.toFixed(1)} Ko`,
    `Balise H1 : ${ctx.h1Count} (attendu : exactement 1)`,
    `Images sans attribut alt : ${ctx.imagesMissingAlt}`,
    `Liens internes : ${ctx.internalLinks} | Liens externes : ${ctx.externalLinks}`,
    `Données structurées JSON-LD : ${ctx.jsonLdDetected ? "détectées" : "absentes"}`,
    `HTTPS : ${ctx.https ? "oui" : "non"}`,
    ctx.title ? `Title : "${ctx.title.slice(0, 80)}" (${ctx.title.length} car.)` : "Title : absent",
    ctx.description ? `Meta description : ${ctx.description.length} car.` : "Meta description : absente",
  ];

  if (ctx.gtmetrix) {
    const gt = ctx.gtmetrix;
    const gtLines = [
      "--- GT Metrix (analyse complémentaire) ---",
      `Note GT Metrix : ${gt.grade} | Performance : ${gt.performanceScore}/100 | Structure : ${gt.structureScore}/100`,
      gt.lcpMs != null ? `LCP (GT Metrix) : ${(gt.lcpMs / 1000).toFixed(2)}s` : null,
      gt.tbtMs != null ? `TBT (GT Metrix) : ${gt.tbtMs}ms` : null,
      gt.ttfbMs != null ? `TTFB (GT Metrix) : ${gt.ttfbMs}ms` : null,
      gt.fullyLoadedMs != null ? `Temps de chargement complet : ${(gt.fullyLoadedMs / 1000).toFixed(2)}s` : null,
      gt.pageSizeBytes != null ? `Poids total de la page : ${(gt.pageSizeBytes / 1024).toFixed(0)} Ko` : null,
      gt.pageRequests != null ? `Nombre de requêtes : ${gt.pageRequests}` : null,
    ].filter((l): l is string => l !== null);
    lines.push("", ...gtLines);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: `Tu es un expert SEO et performance web senior (10+ ans). Tu analyses des métriques Lighthouse et GT Metrix (quand disponibles) ainsi que la structure d'une page pour produire un diagnostic concis et des recommandations actionnables. Quand les deux sources sont présentes, croise-les pour renforcer ou nuancer le diagnostic (ex: LCP cohérent entre les deux outils = signal fort). Tes recommandations sont toujours spécifiques aux données fournies — jamais génériques. Tu priorises les points bloquants (métriques dans le rouge, erreurs structurelles) avant les optimisations secondaires. Réponds uniquement en JSON valide, sans balise markdown, sans commentaire.`,
      messages: [{
        role: "user",
        content: `Analyse les métriques suivantes pour ${ctx.url} et produis un diagnostic + recommandations.

${lines.join("\n")}

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :
{
  "summary": "2 phrases max : diagnostic global de l'état de santé du site, en citant les métriques clés",
  "recommendations": [
    {
      "priority": "haute|moyenne|faible",
      "titre": "titre court et actionnable (max 60 car.)",
      "detail": "explication concrète : cause probable + action précise à mener (1-2 phrases)"
    }
  ]
}

Règles :
- Maximum 4 recommandations, triées par priorité décroissante
- Priorité haute = métrique dans le rouge ou absence critique (HTTPS, title, H1)
- Priorité moyenne = métrique à améliorer ou point structurel perfectible
- Priorité faible = optimisation non bloquante
- Cite les valeurs chiffrées dans le detail quand pertinent (ex: "LCP à 3.8s dépasse le seuil de 2.5s")`,
      }],
    });

    const raw = (response.content[0] as { text: string }).text.trim()
      .replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(raw) as PageSpeedAnalysisResult;
  } catch (e) {
    console.warn("[pagespeedAnalysis] error:", e);
    return null;
  }
}
