import { NextRequest, NextResponse } from "next/server";
import { getDataForSeoCompetitors } from "@/lib/dataforseo";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const { domain, country } = await req.json() as { domain: string; country?: string };
  if (!domain) return NextResponse.json({ competitors: [] });

  // Domaine neuf ou sans historique organique indexé = aucune suggestion plutôt qu'une liste inventée
  // (c'était auparavant un pur brainstorm Haiku, sans aucune donnée réelle derrière).
  if (!process.env.DATAFORSEO_LOGIN) return NextResponse.json({ competitors: [] });

  try {
    const list = await getDataForSeoCompetitors(domain, country || "fr", [], 8);
    return NextResponse.json({ competitors: list.map(c => c.domain) });
  } catch (e) {
    console.error("[onboarding/competitors] error:", e);
    return NextResponse.json({ competitors: [] });
  }
}
