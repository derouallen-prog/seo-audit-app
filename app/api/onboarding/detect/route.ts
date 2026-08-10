import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { detectTechStack } from "@/lib/techDetect";

export const runtime = "nodejs";
export const maxDuration = 30;

async function extractHomepageData(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const h1 = $("h1").first().text().trim();
    const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const ogDesc = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
    const firstP = $("p").first().text().trim().slice(0, 300);

    return { title, h1, metaDesc: metaDesc || ogDesc, firstP };
  } catch {
    return null;
  }
}

async function generatePositioning(pageData: {
  title: string;
  h1: string;
  metaDesc: string;
  firstP: string;
  url: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `À partir de ces informations extraites d'un site web, génère UNE SEULE phrase (max 25 mots) décrivant le positionnement de ce site/entreprise. Réponds uniquement avec la phrase, sans ponctuation finale ni guillemets.

URL: ${pageData.url}
Titre: ${pageData.title}
H1: ${pageData.h1}
Meta description: ${pageData.metaDesc}
Premier paragraphe: ${pageData.firstP}`,
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    return text;
  } catch {
    return null;
  }
}

async function countSitemapUrls(siteUrl: string): Promise<number> {
  try {
    const base = siteUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/sitemap.xml`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SearchMind/1.0)" },
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const count = (xml.match(/<loc>/g) ?? []).length;
    return count;
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ error: "URL requise" }, { status: 400 });

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  const [techStack, pageData, sitemapCount] = await Promise.all([
    detectTechStack(normalizedUrl),
    extractHomepageData(normalizedUrl),
    countSitemapUrls(normalizedUrl),
  ]);

  const positioning = pageData
    ? await generatePositioning({ ...pageData, url: normalizedUrl })
    : null;

  return NextResponse.json({
    techStack,
    positioning,
    sitemapCount,
    pageData: pageData ? { title: pageData.title, h1: pageData.h1, metaDesc: pageData.metaDesc } : null,
  });
}
