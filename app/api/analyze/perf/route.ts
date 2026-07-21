import { NextRequest, NextResponse } from "next/server";
import { runGtMetrix } from "@/lib/gtmetrix";
import { assertSafeUrl } from "@/lib/safeUrl";

// Endpoint d'enrichissement performance découplé de l'audit principal.
// GT Metrix lance un test réel (30-135s), donc ce chemin a son propre budget
// de temps — il ne doit JAMAIS être appelé dans le flux synchrone de /api/analyze.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 150;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Paramètre url manquant" }, { status: 400 });
  }

  const safe = await assertSafeUrl(url);
  if (!safe.ok || !safe.url) {
    return NextResponse.json({ error: `URL non autorisée : ${safe.reason ?? "cible invalide"}` }, { status: 400 });
  }

  if (!process.env.GTMETRIX_API_KEY) {
    return NextResponse.json({ error: "GT Metrix non configuré (GTMETRIX_API_KEY manquant)" }, { status: 503 });
  }

  try {
    const gtmetrix = await runGtMetrix(safe.url);
    if (!gtmetrix) {
      return NextResponse.json({ error: "GT Metrix n'a pas retourné de résultat (test trop long, quota épuisé ou URL injoignable)" }, { status: 502 });
    }
    return NextResponse.json({ gtmetrix });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur GT Metrix";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
