import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 20;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { domain, metaTitle, metaDesc, h1 } = await req.json() as {
    domain: string;
    metaTitle?: string;
    metaDesc?: string;
    h1?: string;
  };

  if (!domain) return NextResponse.json({ competitors: [] });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Tu es un expert en analyse concurrentielle SEO. À partir des informations ci-dessous, identifie 5 à 8 domaines concurrents directs de ce site.

Domaine : ${domain}
Titre de la page d'accueil : ${metaTitle ?? "–"}
H1 : ${h1 ?? "–"}
Meta description : ${metaDesc ?? "–"}

Règles :
- Retourne UNIQUEMENT les domaines (sans https://, sans www si possible, ex: concurrent.fr)
- Privilégie des acteurs français ou du même marché géographique si le site est francophone
- Ne retourne PAS le domaine du site lui-même
- Retourne UNIQUEMENT un tableau JSON valide, rien d'autre

Exemple de réponse : ["concurrent1.fr", "concurrent2.com", "concurrent3.fr"]`,
        },
      ],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
    console.log("[competitors] raw response:", raw.slice(0, 300));

    // Try multiple JSON extraction strategies
    let competitors: string[] = [];
    try {
      // Direct parse first
      competitors = JSON.parse(raw);
    } catch {
      // Extract first [...] block
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { competitors = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }
    }

    // Filter: keep only valid-looking domains, strip protocol/www
    const cleaned = (Array.isArray(competitors) ? competitors : [])
      .map((c: unknown) => String(c).trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, ""))
      .filter(c => c.length > 3 && c.includes(".") && c !== domain)
      .slice(0, 8);

    console.log("[competitors] cleaned:", cleaned);
    return NextResponse.json({ competitors: cleaned });
  } catch (e) {
    console.error("[competitors] error:", e);
    return NextResponse.json({ competitors: [] });
  }
}
