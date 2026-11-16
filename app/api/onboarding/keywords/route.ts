import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDataForSeoRankedKeywords } from "@/lib/dataforseo";

export const runtime = "nodejs";
export const maxDuration = 20;

export interface OnboardingKeywordInsight {
  hasHistory: boolean;
  topKeywords: { keyword: string; position: number; volume: number }[];
  suggestedTopic: { keyword: string; position: number; volume: number; difficulty: number | null } | null;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { domain } = await req.json() as { domain?: string };
  if (!domain) return NextResponse.json({ error: "Domaine requis" }, { status: 400 });

  const empty: OnboardingKeywordInsight = { hasHistory: false, topKeywords: [], suggestedTopic: null };

  if (!process.env.DATAFORSEO_LOGIN) return NextResponse.json(empty);

  try {
    // Domaine neuf sans historique de positionnement = réponse vide honnête, jamais une estimation.
    const ranked = await getDataForSeoRankedKeywords(domain, "fr", { minPosition: 1, maxPosition: 100, limit: 100 });
    if (!ranked.items.length) return NextResponse.json(empty);

    // "Top mots-clés" = vraiment bien positionnés, pas juste à fort volume : un domaine qui vend du Nike
    // ressort sinon avec "nike" en position 25 comme mot-clé vedette, ce qui n'a aucun sens pour l'utilisateur.
    const inTop10 = ranked.items.filter(k => k.position <= 10);
    const topPool = inTop10.length >= 3 ? inTop10 : ranked.items;
    const topKeywords = [...topPool]
      .sort((a, b) => a.position - b.position || b.searchVolume - a.searchVolume)
      .slice(0, 3)
      .map(k => ({ keyword: k.keyword, position: k.position, volume: k.searchVolume }));

    // Thématique à travailler : la meilleure opportunité quick-win réelle (page 1 basse/page 2, bon volume).
    const quickWins = ranked.items
      .filter(k => k.position >= 4 && k.position <= 20 && k.searchVolume > 0)
      .sort((a, b) => b.searchVolume - a.searchVolume || (a.difficulty ?? 100) - (b.difficulty ?? 100));
    const best = quickWins[0];
    const suggestedTopic = best
      ? { keyword: best.keyword, position: best.position, volume: best.searchVolume, difficulty: best.difficulty }
      : null;

    return NextResponse.json({ hasHistory: true, topKeywords, suggestedTopic } satisfies OnboardingKeywordInsight);
  } catch (e) {
    console.error("[onboarding/keywords] error:", e);
    return NextResponse.json(empty);
  }
}
