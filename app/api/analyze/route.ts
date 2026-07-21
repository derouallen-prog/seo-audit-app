import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { analyzeUrl } from "../../../lib/analyzers";
import { getCachedAnalysis, setCachedAnalysis } from "../../../lib/analyzeCache";
import { saveAudit } from "../../../lib/auditStore";
import { computeScore } from "../../../lib/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
  }

  // Sert un audit récent en cache (évite de re-taper PSI/Semrush/GSC)
  const cached = getCachedAnalysis(url);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { "content-type": "application/json", "x-cache": "HIT" },
    });
  }

  try {
    const result = await analyzeUrl(url);
    setCachedAnalysis(url, result);

    // Récupérer l'utilisateur connecté (si présent) via les cookies de la requête
    let userId: string | null = null;
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return req.cookies.getAll(); },
            setAll() {},
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* auth optionnelle */ }

    const { score, grade } = computeScore(result);
    const auditId = await saveAudit(url, result, score, grade, userId);

    const headers: Record<string, string> = { "content-type": "application/json", "x-cache": "MISS" };
    if (auditId) headers["x-audit-id"] = auditId;

    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    const status = message.startsWith("URL non autorisée") ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}
