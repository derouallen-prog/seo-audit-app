import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWcConnection, saveWcConnection, deleteWcConnection, saveSiteProfile } from "@/lib/wcConnections";
import { analyzeSiteProfile } from "@/lib/wcSiteProfile";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getWcConnection(user.id);
  if (!conn) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    storeUrl: conn.storeUrl,
    wpUsername: conn.wpUsername,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    storeUrl?: string;
    wcConsumerKey?: string;
    wcConsumerSecret?: string;
    wpUsername?: string;
    wpAppPassword?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { storeUrl, wcConsumerKey, wcConsumerSecret, wpUsername, wpAppPassword } = body;

  if (!storeUrl || !wcConsumerKey || !wcConsumerSecret || !wpUsername || !wpAppPassword) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  // Valider que l'URL est bien un site WP accessible
  try {
    const url = new URL(storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`);
    if (!["http:", "https:"].includes(url.protocol)) {
      return NextResponse.json({ error: "URL invalide" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  const canonicalUrl = storeUrl.startsWith("http") ? storeUrl : `https://${storeUrl}`;
  try {
    await saveWcConnection(user.id, {
      storeUrl: canonicalUrl,
      wcConsumerKey,
      wcConsumerSecret,
      wpUsername,
      wpAppPassword,
    });
    // Analyse de la structure du site en arrière-plan (sans bloquer la réponse)
    analyzeSiteProfile({
      storeUrl: canonicalUrl,
      consumerKey: wcConsumerKey || undefined,
      consumerSecret: wcConsumerSecret || undefined,
      wpUsername: wpUsername || undefined,
      wpAppPassword: wpAppPassword || undefined,
    }).then((profile) => saveSiteProfile(user.id, profile)).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteWcConnection(user.id);
  return NextResponse.json({ ok: true });
}
