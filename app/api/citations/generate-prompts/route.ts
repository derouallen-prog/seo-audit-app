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

  const body = await req.json() as { keywords: string[]; language?: string };
  const { keywords, language = "fr" } = body;

  if (!keywords?.length || keywords.length > 15) {
    return NextResponse.json({ error: "1 à 15 mots-clés requis" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API non configurée" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const langLabel = language === "fr" ? "français" : language === "en" ? "English" : language;

  const systemPrompt = `Tu génères des questions naturelles qu'un utilisateur poserait à une IA (ChatGPT, Perplexity, Gemini, Claude) pour s'informer sur un sujet.
Les questions doivent être variées en intention (informationnelle, commerciale, comparaison, locale, pédagogique) et naturelles — comme si quelqu'un les tapait vraiment.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.`;

  const userPrompt = `Pour chaque mot-clé ci-dessous, génère 2 à 3 questions en ${langLabel} qu'un utilisateur poserait à une IA.
Retourne un JSON avec cette structure exacte :
{
  "prompts": [
    { "keyword": "...", "prompt_text": "...", "intent": "Informational" | "Commercial" | "Learn and Solve" | "Local" | "Navigational" }
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
      prompts: { keyword: string; prompt_text: string; intent: Intent }[];
    };

    return NextResponse.json({ prompts: parsed.prompts ?? [] });
  } catch (e) {
    console.error("[generate-prompts] error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
