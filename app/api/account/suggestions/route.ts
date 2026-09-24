import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/supabaseServer";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AssistantSuggestions {
  serp: string[];
  compare: string[];
  paa: string[];
  ads: string[];
}

const FALLBACK: AssistantSuggestions = {
  serp: ["veste imperméable homme", "guide d'achat poêle inox", "crème visage vegan", "chaussures trail running"],
  compare: ["decathlon.fr", "sephora.fr", "maison-du-monde.fr", "cdiscount.com"],
  paa: ["nutrition sportive", "décoration scandinave", "randonnée légère", "vin naturel"],
  ads: ["ma boutique de sport", "mon cabinet dentaire", "mon agence immo", "mon blog cuisine"],
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json(FALLBACK);

  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
    );
    const { data: profile } = await sb
      .from("user_site_profile")
      .select("site_url,market,competitors")
      .eq("user_id", user.id)
      .single();

    // No profile or no market → return fallback
    if (!profile?.site_url && !profile?.market) return NextResponse.json(FALLBACK);

    const site = profile.site_url ?? "";
    const market = profile.market ?? "";
    const competitors: string[] = profile.competitors ?? [];

    // Competitor variants: registered first, then fill up to 4 with market-appropriate ones
    const compareBase = competitors.slice(0, 4);

    const prompt = `Tu es un expert SEO. Le site analysé est "${site}" et son marché est : "${market}".

Génère exactement 4 variantes pour chacune des 3 catégories suivantes, adaptées à ce marché. Réponds UNIQUEMENT avec du JSON valide, sans markdown :

{
  "serp": ["requête principale du marché", "requête longue traîne 1", "requête longue traîne 2", "requête comparateur ou guide d'achat"],
  "paa": ["produit ou sujet clé 1", "produit ou sujet clé 2", "produit ou sujet clé 3", "produit ou sujet clé 4"],
  "ads": ["mot-clé principal", "variante produit 1", "variante produit 2", "segment cible"]
}

Les valeurs doivent être courtes (2-5 mots), spécifiques au marché "${market}", en français.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ ...FALLBACK, compare: compareBase.length ? compareBase : FALLBACK.compare });

    const ai = JSON.parse(jsonMatch[0]) as { serp?: string[]; paa?: string[]; ads?: string[] };

    const result: AssistantSuggestions = {
      serp: ai.serp?.slice(0, 4) ?? FALLBACK.serp,
      compare: compareBase.length >= 1
        ? [...compareBase, ...FALLBACK.compare].slice(0, 4)
        : FALLBACK.compare,
      paa: ai.paa?.slice(0, 4) ?? FALLBACK.paa,
      ads: ai.ads?.slice(0, 4) ?? FALLBACK.ads,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
