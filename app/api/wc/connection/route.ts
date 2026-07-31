import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWcConnections, saveWcConnection, deleteWcConnection, setDefaultWcConnection, saveSiteProfile } from "@/lib/wcConnections";
import { analyzeSiteProfile } from "@/lib/wcSiteProfile";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await getWcConnections(user.id);
  return NextResponse.json({
    connected: connections.length > 0,
    connections: connections.map((c) => ({
      id: c.id,
      storeUrl: c.storeUrl,
      label: c.label,
      isDefault: c.isDefault,
      wpUsername: c.wpUsername,
      hasProfile: !!c.siteProfile,
    })),
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
    label?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { storeUrl, wcConsumerKey, wcConsumerSecret, wpUsername, wpAppPassword, label } = body;

  if (!storeUrl || !wcConsumerKey || !wcConsumerSecret || !wpUsername || !wpAppPassword) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

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
      label,
      wcConsumerKey,
      wcConsumerSecret,
      wpUsername,
      wpAppPassword,
    });

    // Analyse structure en arrière-plan
    analyzeSiteProfile({
      storeUrl: canonicalUrl,
      consumerKey: wcConsumerKey || undefined,
      consumerSecret: wcConsumerSecret || undefined,
      wpUsername: wpUsername || undefined,
      wpAppPassword: wpAppPassword || undefined,
    }).then((profile) => saveSiteProfile(user.id, profile, canonicalUrl)).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("id") ?? undefined;

  await deleteWcConnection(user.id, connectionId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  await setDefaultWcConnection(user.id, id);
  return NextResponse.json({ ok: true });
}
