import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBridgeToken } from "@/lib/wpBridge";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const token = await getBridgeToken(user.id);
  return NextResponse.json({ token });
}
