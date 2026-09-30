import { NextRequest, NextResponse } from "next/server";
import { searchLLMMentions } from "@/lib/dataforseo_llm_mentions";
import { getAuthUser } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // Endpoint payant côté DataForSEO : réservé aux comptes connectés
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Connectez-vous pour lancer une recherche de mentions." }, { status: 401 });

  try {
    const body = await req.json() as {
      domain?: string;
      keyword?: string;
      language_code?: string;
      location_code?: number;
      platform?: "chat_gpt" | "google";
      limit?: number;
      offset?: number;
    };

    const result = await searchLLMMentions({ ...body, limit: Math.min(body.limit ?? 50, 100) });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
