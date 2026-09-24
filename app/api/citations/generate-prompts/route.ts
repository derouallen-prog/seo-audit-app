import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/supabaseServer";
import type { Intent } from "@/lib/citations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { keywords?: string[]; language?: string; brand?: string; domain?: string; market?: string };
  const { keywords, language = "fr", brand, domain, market } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API non configurée" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const langLabel = language === "fr" ? "français" : language === "en" ? "English" : language;

  // Brand/domain mode: generate from brand + market context
  if ((brand || domain) && !keywords?.length) {
    const brandLabel = brand ?? domain ?? "";
    const marketLabel = market ?? "";
    const systemPrompt = `Tu es un expert en GEO (Generative Engine Optimization). Tu génères des questions que de vrais utilisateurs posent aux IA (ChatGPT, Perplexity, Gemini, Claude) pour se renseigner sur un produit, une marque ou un marché. Les prompts doivent refléter des recherches réelles sur les plateformes IA — pas des requêtes SEO classiques. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.`;

    const userPrompt = `Génère 8 prompts en ${langLabel} qu'un utilisateur taperait dans une IA pour se renseigner sur "${brandLabel}"${marketLabel ? ` (marché : ${marketLabel})` : ""}.

Les prompts doivent couvrir : recommandation de marque, comparaison avec concurrents, avis, produit spécifique, achat, guide ou conseil.
Pour chaque prompt, estime aussi le volume de recherche mensuel approximatif sur les plateformes IA.

Retourne ce JSON exact :
{
  "prompts": [
    {
      "keyword": "thème court (2-4 mots)",
      "prompt_text": "question naturelle complète",
      "intent": "Informational" | "Commercial" | "Learn and Solve" | "Navigational",
      "estimated_volume": "faible" | "moyen" | "élevé"
    }
  ]
}`;

    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON response");
      const parsed = JSON.parse(jsonMatch[0]) as { prompts: { keyword: string; prompt_text: string; intent: Intent; estimated_volume?: string }[] };
      return NextResponse.json({ prompts: parsed.prompts ?? [] });
    } catch (e) {
      console.error("[generate-prompts brand] error:", e);
      return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
    }
  }

  // Keywords mode
  if (!keywords?.length || keywords.length > 15) {
    return NextResponse.json({ error: "1 à 15 mots-clés ou brand/domain requis" }, { status: 400 });
  }

  const systemPrompt = `Tu génères des questions naturelles qu'un utilisateur poserait à une IA (ChatGPT, Perplexity, Gemini, Claude) pour s'informer sur un sujet. Les questions doivent être variées et naturelles — comme si quelqu'un les tapait vraiment. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.`;

  const userPrompt = `Pour chaque mot-clé ci-dessous, génère 2 à 3 questions en ${langLabel} qu'un utilisateur poserait à une IA.
Retourne un JSON avec cette structure exacte :
{
  "prompts": [
    { "keyword": "...", "prompt_text": "...", "intent": "Informational" | "Commercial" | "Learn and Solve" | "Local" | "Navigational", "estimated_volume": "faible" | "moyen" | "élevé" }
  ]
}

Mots-clés : ${keywords.map(k => `"${k}"`).join(", ")}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      prompts: { keyword: string; prompt_text: string; intent: Intent; estimated_volume?: string }[];
    };

    return NextResponse.json({ prompts: parsed.prompts ?? [] });
  } catch (e) {
    console.error("[generate-prompts] error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
