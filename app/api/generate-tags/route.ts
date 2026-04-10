import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { url, pageContent, currentTitle, currentMeta, keyword, pageType } =
      await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    const systemPrompt = `Tu es un expert SEO en stratégie de contenu avec plus de 10 ans d'expérience.
Tu génères des balises title et meta description optimisées SEO pour augmenter le taux de clics.

RÈGLES TITLE :
- Intègre le mot-clé principal en début de title
- Maximum 60 caractères STRICT
- Valorise les arguments phares de la page
- Suis les recommandations Google

RÈGLES META DESCRIPTION :
- Insère le mot-clé principal
- Unique et attrayante avec des verbes d'action
- Longueur idéale : 120 à 140 caractères STRICT
- Optimisée pour le CTR

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "title_axe_a": "...",
  "title_axe_a_chars": 0,
  "title_axe_b": "...",
  "title_axe_b_chars": 0,
  "meta_axe_a": "...",
  "meta_axe_a_chars": 0,
  "meta_axe_b": "...",
  "meta_axe_b_chars": 0,
  "mot_cle_detecte": "...",
  "type_page_detecte": "...",
  "problemes": []
}`;

    const userPrompt = `Génère les balises SEO pour cette page.

URL : ${url}
Title actuel : ${currentTitle || "Non trouvé"}
Meta actuelle : ${currentMeta || "Non trouvée"}
${keyword ? `Mot-clé principal : ${keyword}` : "Mot-clé : à déduire du contenu"}
${pageType ? `Type de page : ${pageType}` : ""}

Contenu de la page :
${pageContent?.slice(0, 2000) || "Non disponible"}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (response.content[0] as { text: string }).text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const tags = JSON.parse(raw);
    return NextResponse.json(tags);
  } catch (e) {
    console.error("generate-tags error:", e);
    return NextResponse.json(
      { error: "Erreur lors de la génération" },
      { status: 500 }
    );
  }
}
