import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/supabaseServer";
import { getDataForSeoCompetitors } from "@/lib/dataforseo";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Décrit le marché en quelques mots — suggestion de repli éditable par l'utilisateur,
// jamais présentée comme une donnée vérifiée (contrairement à la liste de concurrents ci-dessous).
async function describeMarket(siteUrl: string): Promise<string | null> {
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 60,
      messages: [{ role: "user", content: `Le site est "${siteUrl}". Identifie son marché/secteur en quelques mots en français, sans ponctuation finale. Réponds uniquement avec cette courte description, rien d'autre.` }],
    });
    return msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as { site_url: string; market?: string };
  const { site_url, market } = body;
  if (!site_url) return NextResponse.json({ error: "site_url requis" }, { status: 400 });

  const domain = site_url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? site_url;

  const [marketDesc, competitorsResult] = await Promise.all([
    market ? Promise.resolve(market) : describeMarket(site_url),
    process.env.DATAFORSEO_LOGIN
      ? getDataForSeoCompetitors(domain, "fr", [], 8).catch(e => {
          console.error("[suggest-competitors] DataForSEO error:", e);
          return [];
        })
      : Promise.resolve([]),
  ]);

  // Domaine sans historique organique dans DataForSEO Labs = aucune suggestion, jamais une liste inventée.
  const competitors = competitorsResult.map(c => ({ domain: c.domain, name: c.domain }));

  return NextResponse.json({ market: marketDesc, competitors });
}
