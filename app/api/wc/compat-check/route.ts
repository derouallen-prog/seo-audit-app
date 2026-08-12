import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWcConnections, saveSeoCompatStatus } from "@/lib/wcConnections";
import { runCompatCheck } from "@/lib/wpCompatCheck";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeUrl } = await req.json() as { storeUrl?: string };

  const connections = await getWcConnections(user.id);
  const conn = storeUrl
    ? connections.find(c => c.storeUrl === storeUrl.replace(/\/$/, ""))
    : connections.find(c => c.isDefault) ?? connections[0];

  if (!conn) return NextResponse.json({ error: "Connexion introuvable" }, { status: 404 });
  if (!conn.wpUsername || !conn.wpAppPassword) {
    return NextResponse.json({ error: "Identifiants WordPress manquants" }, { status: 400 });
  }

  const result = await runCompatCheck({
    storeUrl: conn.storeUrl,
    wpUsername: conn.wpUsername,
    wpAppPassword: conn.wpAppPassword,
  });

  await saveSeoCompatStatus(user.id, conn.storeUrl, result.plugin, result.status);

  return NextResponse.json({
    plugin: result.plugin,
    status: result.status,
    aioSeoRestDisabled: result.aioSeoRestDisabled ?? false,
  });
}
