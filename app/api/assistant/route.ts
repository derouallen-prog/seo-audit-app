import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Tu es un consultant SEO senior, expert en référencement naturel (technique, contenu, sémantique, netlinking). Tu réponds en français, de façon claire et actionnable, à des consultants SEO et des marketeurs.

Tu peux discuter de stratégie SEO, répondre à des questions techniques, donner des recommandations, et exécuter deux actions concrètes quand on te le demande :
- générer un article de blog optimisé SEO
- générer une fiche produit e-commerce optimisée SEO

Quand l'utilisateur demande explicitement de rédiger un article ou une fiche produit, utilise l'outil correspondant plutôt que de l'écrire toi-même dans ta réponse. Si des informations essentielles manquent (sujet, produit, mot-clé), demande-les avant d'appeler l'outil.`;

const tools: Anthropic.Tool[] = [
  {
    name: "generate_article",
    description: "Génère un article de blog complet optimisé SEO (titre, meta description, structure Hn, corps de texte).",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Sujet ou titre de l'article" },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
        plan: { type: "string", description: "Plan de contenu fourni par l'utilisateur (titres H2/H3), si disponible" },
        ton: { type: "string", description: "Ton souhaité (expert, accessible, commercial...)" },
        longueur_mots: { type: "number", description: "Longueur cible approximative en nombre de mots" },
      },
      required: ["sujet"],
    },
  },
  {
    name: "generate_product_sheet",
    description: "Génère une fiche produit e-commerce optimisée SEO (title tag, meta description, pitch court, description longue, points clés).",
    input_schema: {
      type: "object",
      properties: {
        nom_produit: { type: "string", description: "Nom du produit" },
        caracteristiques: { type: "string", description: "Caractéristiques techniques, avantages, matériaux..." },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
        ton: { type: "string", description: "Ton souhaité (premium, accessible, technique...)" },
      },
      required: ["nom_produit"],
    },
  },
];

interface ArticleParams {
  sujet: string;
  mot_cle_principal?: string;
  plan?: string;
  ton?: string;
  longueur_mots?: number;
}

interface ProductSheetParams {
  nom_produit: string;
  caracteristiques?: string;
  mot_cle_principal?: string;
  ton?: string;
}

async function generateArticleContent(p: ArticleParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `Tu es un rédacteur SEO senior. Tu écris des articles de blog complets, structurés et optimisés pour le référencement naturel, en français. Réponds uniquement avec l'article au format markdown : commence par "# Title SEO" puis "**Meta description:** ..." puis le corps de l'article avec une hiérarchie ## / ###.`,
    messages: [{
      role: "user",
      content: `Rédige un article complet sur : ${p.sujet}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}
${p.plan ? `Plan à suivre :\n${p.plan}` : "Construis un plan pertinent toi-même."}
${p.ton ? `Ton : ${p.ton}` : "Ton expert mais accessible."}
${p.longueur_mots ? `Longueur cible : environ ${p.longueur_mots} mots.` : "Longueur cible : environ 1200-1500 mots."}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

async function generateProductSheetContent(p: ProductSheetParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `Tu es un rédacteur e-commerce SEO senior. Tu écris des fiches produits optimisées pour le référencement et la conversion, en français. Réponds uniquement au format markdown avec ces sections dans l'ordre : "# Title SEO (≤60 car.)", "**Meta description (120-160 car.):**", "## Pitch court", "## Description longue", "## Points clés" (liste à puces).`,
    messages: [{
      role: "user",
      content: `Rédige une fiche produit pour : ${p.nom_produit}
${p.caracteristiques ? `Caractéristiques / avantages : ${p.caracteristiques}` : ""}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}
${p.ton ? `Ton : ${p.ton}` : "Ton premium et engageant."}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages manquants" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUse = response.content.find(b => b.type === "tool_use");

    if (toolUse && toolUse.type === "tool_use") {
      let generated: string;
      let label: string;
      if (toolUse.name === "generate_article") {
        generated = await generateArticleContent(toolUse.input as ArticleParams);
        label = "Voici l'article généré :";
      } else if (toolUse.name === "generate_product_sheet") {
        generated = await generateProductSheetContent(toolUse.input as ProductSheetParams);
        label = "Voici la fiche produit générée :";
      } else {
        generated = "";
        label = "";
      }
      const reply = `${label}\n\n${generated}`;
      return NextResponse.json({ reply });
    }

    const textBlock = response.content.find(b => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("assistant error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
