import { NextRequest, NextResponse } from "next/server";
import { deleteGscConnection } from "@/lib/gscOAuth";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("gsc_session")?.value;
  if (sessionId) {
    await deleteGscConnection(sessionId);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("gsc_session");
  return res;
}
