import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWebflowConnection, deleteWebflowConnection, saveWebflowConnection } from "@/lib/webflowConnections";
import { listSites } from "@/lib/webflowClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getWebflowConnection(user.id);
  if (!conn) return NextResponse.json({ connected: false, sites: [] });

  return NextResponse.json({
    connected: true,
    sites: conn.sites,
    connectedAt: conn.createdAt,
  });
}

// Refresh sites from Webflow API
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getWebflowConnection(user.id);
  if (!conn) return NextResponse.json({ error: "Non connecté" }, { status: 404 });

  try {
    const sites = await listSites(conn.accessToken);
    await saveWebflowConnection(user.id, conn.accessToken, sites);
    return NextResponse.json({ ok: true, sites });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteWebflowConnection(user.id);
  return NextResponse.json({ ok: true });
}
