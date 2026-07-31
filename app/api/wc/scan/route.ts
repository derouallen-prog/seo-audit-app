import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWcConnection, saveSiteProfile } from "@/lib/wcConnections";
import { analyzeSiteProfile } from "@/lib/wcSiteProfile";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getWcConnection(user.id);
  if (!conn) return NextResponse.json({ error: "Aucune boutique connectée" }, { status: 404 });

  try {
    const profile = await analyzeSiteProfile({
      storeUrl: conn.storeUrl,
      consumerKey: conn.wcConsumerKey || undefined,
      consumerSecret: conn.wcConsumerSecret || undefined,
      wpUsername: conn.wpUsername || undefined,
      wpAppPassword: conn.wpAppPassword || undefined,
    });
    await saveSiteProfile(user.id, profile);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur analyse" }, { status: 500 });
  }
}
