import { NextRequest, NextResponse } from "next/server";
import { searchLLMMentions } from "@/lib/dataforseo_llm_mentions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      domain?: string;
      keyword?: string;
      language_code?: string;
      location_code?: number;
      platform?: "chat_gpt" | "google";
      limit?: number;
      offset?: number;
    };

    const result = await searchLLMMentions(body);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
