import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromToken, pollPendingScripts, ackScript } from "@/lib/wpBridge";

export const dynamic = "force-dynamic";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400, headers: CORS });
  }

  const userId = await getUserIdFromToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401, headers: CORS });
  }

  const scripts = await pollPendingScripts(userId);
  return NextResponse.json({ scripts }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  let body: { token?: string; id?: string; success?: boolean; result?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400, headers: CORS });
  }

  if (!body.token || !body.id) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400, headers: CORS });
  }

  const userId = await getUserIdFromToken(body.token);
  if (!userId) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401, headers: CORS });
  }

  await ackScript(body.id, body.success !== false, body.result);
  return NextResponse.json({ ok: true }, { headers: CORS });
}
