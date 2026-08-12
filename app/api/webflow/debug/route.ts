import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWebflowConnection } from "@/lib/webflowConnections";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getWebflowConnection(user.id);
  if (!conn) return NextResponse.json({ error: "Non connecté" }, { status: 404 });

  const token = conn.accessToken;

  // Fetch sites brut
  const sitesRes = await fetch("https://api.webflow.com/v2/sites", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const sitesData = await sitesRes.json();

  // Pour chaque site, fetch domains brut
  const domainsData: Record<string, unknown> = {};
  for (const site of sitesData.sites ?? []) {
    const domRes = await fetch(`https://api.webflow.com/v2/sites/${site.id}/domains`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    domainsData[site.id] = { status: domRes.status, body: await domRes.json().catch(() => null) };
  }

  return NextResponse.json({ sites: sitesData, domains: domainsData });
}
