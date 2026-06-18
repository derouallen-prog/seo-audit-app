import Parser from "rss-parser";
import { kv } from "@vercel/kv";
import Anthropic from "@anthropic-ai/sdk";

const KV_KEY = "seo-news-digest";
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
  const existing = (await kv.get<SeoNewsItem[]>(KV_KEY)) || [];
  const seenLinks = new Set(existing.map(i => i.link));

  const fetchedArrays = await Promise.all(SOURCES.map(fetchSourceItems));
  const newItems = fetchedArrays.flat().filter(i => !seenLinks.has(i.link));

  const summarized = await Promise.all(
    newItems.map(async i => ({ ...i, summary: await summarizeItem(i) }))
  );

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const merged = [...summarized, ...existing]
    .filter(i => new Date(i.publishedAt).getTime() >= cutoff || Number.isNaN(new Date(i.publishedAt).getTime()))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_ITEMS);

  await kv.set(KV_KEY, merged);
  return { added: summarized.length, total: merged.length };
}

export async function getSeoNewsDigest(limit = 15): Promise<SeoNewsItem[]> {
  try {
    const items = (await kv.get<SeoNewsItem[]>(KV_KEY)) || [];
    return items.slice(0, limit);
  } catch (err) {
    console.warn("[seoNews] KV unavailable:", err);
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
