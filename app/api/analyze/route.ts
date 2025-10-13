import { NextRequest } from "next/server";
import { analyzeUrl } from "../../../lib/analyzers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
  }
  try {
    const result = await analyzeUrl(url);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
