import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { subject, language = "fr-FR" } = await req.json() as { subject?: string; language?: string };

  if (!subject?.trim()) {
    return NextResponse.json({ error: "Sujet requis" }, { status: 400 });
  }

  const langLabel =
    language.startsWith("fr") ? "français" :
    language.startsWith("en") ? "anglais (English)" :
    language.startsWith("es") ? "espagnol (Español)" :
    language.startsWith("de") ? "allemand (Deutsch)" :
    "français";

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `Tu es un expert SEO. Pour l'article sur le sujet suivant :\n"${subject.trim()}"\n\nLangue cible : ${langLabel}\n\nSuggère 3 mots-clés principaux SEO pertinents à cibler. Chaque mot-clé doit :\n- Refléter l'intention de recherche réelle\n- Être composé de 2 à 6 mots\n- Être en ${langLabel}\n\nRéponds avec exactement 3 lignes, une par mot-clé, sans numéro ni tiret ni ponctuation, rien d'autre.`,
    }],
  });

  const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  const keywords = text
    .split("\n")
    .map(l => l.replace(/^[-–•*\d.)\s]+/, "").trim())
    .filter(l => l.length > 2 && l.length < 80)
    .slice(0, 3);

  return NextResponse.json({ keywords });
}
