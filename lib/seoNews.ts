import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const TABLE = "seo_news_items";
const MAX_AGE_DAYS = 30;
const MAX_ITEMS = 40;

const SOURCES = [
  { name: "Search Engine Land", url: "https://searchengineland.com/feed" },
  { name: "Search Engine Journal", url: "https://www.searchenginejournal.com/feed/" },
  { name: "Abondance", url: "https://www.abondance.com/feed" },
  { name: "Search Engine Roundtable", url: "https://www.seroundtable.com/index.xml" },
  { name: "Google Search Central Blog", url: "https://developers.google.com/search/blog/feed.xml" },
  { name: "Neil Patel Blog", url: "https://neilpatel.com/feed/" },
];

export interface SeoNewsItem {
  source: string;
  title: string;
  link: string;
  publishedAt: string;
  summary: string;
}

const parser = new Parser({ timeout: 15000 });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchSourceItems(source: { name: string; url: string }): Promise<SeoNewsItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 10).map(item => ({
      source: source.name,
      title: item.title || "",
      link: item.link || "",
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      summary: (item.contentSnippet || item.summary || "").replace(/\s+/g, " ").trim().slice(0, 400),
    })).filter(i => i.title && i.link);
  } catch (err) {
    console.warn(`[seoNews] failed to fetch ${source.name}:`, err);
    return [];
  }
}

async function summarizeItem(item: SeoNewsItem): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: "Tu résumes une actualité SEO en une seule phrase factuelle et concise en français, orientée sur l'implication pratique pour un consultant SEO. Pas de tirets cadratins.",
      messages: [{
        role: "user",
        content: `Titre : ${item.title}\nExtrait : ${item.summary}\n\nRésume en une phrase.`,
      }],
    });
    const block = response.content.find(b => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : item.title;
  } catch {
    return item.title;
  }
}

export async function refreshSeoNewsDigest(): Promise<{ added: number; total: number }> {
  const supabase = getSupabase();
  if (!supabase) return { added: 0, total: 0 };

  const cutoffIso = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Purge les entrées trop anciennes
  await supabase.from(TABLE).delete().lt("published_at", cutoffIso);

  const { data: existingRows } = await supabase.from(TABLE).select("link");
  const seenLinks = new Set((existingRows || []).map(r => r.link as string));

  const fetchedArrays = await Promise.all(SOURCES.map(fetchSourceItems));
  const newItems = fetchedArrays.flat().filter(i => !seenLinks.has(i.link));

  const summarized = await Promise.all(
    newItems.map(async i => ({ ...i, summary: await summarizeItem(i) }))
  );

  if (summarized.length > 0) {
    const rows = summarized.map(i => ({
      source: i.source,
      title: i.title,
      link: i.link,
      published_at: i.publishedAt,
      summary: i.summary,
    }));
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "link", ignoreDuplicates: true });
    if (error) console.warn("[seoNews] upsert error:", error.message);
  }

  // Garde uniquement les MAX_ITEMS plus récents
  const { data: allRows } = await supabase
    .from(TABLE)
    .select("id")
    .order("published_at", { ascending: false });
  const idsToDelete = (allRows || []).slice(MAX_ITEMS).map(r => r.id);
  if (idsToDelete.length > 0) {
    await supabase.from(TABLE).delete().in("id", idsToDelete);
  }

  const total = Math.min(allRows?.length ?? 0, MAX_ITEMS);
  return { added: summarized.length, total };
}

export async function getSeoNewsDigest(limit = 15): Promise<SeoNewsItem[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(TABLE)
      .select("source, title, link, published_at, summary")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(r => ({
      source: r.source,
      title: r.title,
      link: r.link,
      publishedAt: r.published_at,
      summary: r.summary,
    }));
  } catch (err) {
    console.warn("[seoNews] Supabase unavailable:", err);
    return [];
  }
}

export function formatDigestForPrompt(items: SeoNewsItem[]): string {
  if (items.length === 0) return "";
  const lines = items
    .map(i => `- [${i.source}, ${new Date(i.publishedAt).toLocaleDateString("fr-FR")}] ${i.summary} (${i.link})`)
    .join("\n");
  return `Actualités SEO récentes (mises à jour automatiquement, dernières ${items.length} infos) :\n${lines}`;
}
