import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/supabaseServer";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as { site_url: string; market?: string };
  const { site_url, market } = body;
  if (!site_url) return NextResponse.json({ error: "site_url requis" }, { status: 400 });

  const prompt = market
    ? `Le site est "${site_url}" et son marché est : "${market}". Propose exactement 3 domaines concurrents directs, réels et existants, dans ce marché. Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour : {"market":"${market}","competitors":[{"domain":"example.fr","name":"Nom"},{"domain":"example2.com","name":"Nom 2"},{"domain":"example3.fr","name":"Nom 3"}]}`
    : `Le site est "${site_url}". Identifie son marché/secteur en quelques mots en français, puis propose exactement 3 domaines concurrents directs, réels et existants dans ce secteur en France. Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour : {"market":"courte description du marché","competitors":[{"domain":"example.fr","name":"Nom"},{"domain":"example2.com","name":"Nom 2"},{"domain":"example3.fr","name":"Nom 3"}]}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Réponse invalide", raw: text }, { status: 500 });

    const data = JSON.parse(jsonMatch[0]) as { market: string; competitors: { domain: string; name: string }[] };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
