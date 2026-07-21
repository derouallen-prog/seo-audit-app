import Anthropic from "@anthropic-ai/sdk";
import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname } from "./types";

// Uses Claude with the web_search built-in tool (Anthropic beta).
// We ask Claude a question, then inspect which URLs it searched/cited to determine
// if the tracked domain appears in its sources.

export class ClaudeConnector implements PlatformConnector {
  readonly platform = "claude" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const client = new Anthropic({ apiKey });

    // web_search_20250305 is Anthropic's built-in web search tool (beta).
    // Claude searches the web and includes citations in its response.
    type BetaResponse = {
      content?: {
        type?: string;
        content?: { source?: { url?: string }; url?: string; type?: string }[];
        citations?: { url?: string; source?: { url?: string } }[];
      }[];
    };
    type BetaCreate = { create: (opts: Record<string, unknown>) => Promise<BetaResponse> };

    const response = await (client.beta.messages as unknown as BetaCreate).create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: promptText }],
      betas: ["web-search-2025-03-05"],
    });

    // Collect all URLs from the response regardless of block type
    const urls: string[] = [];

    for (const block of response.content ?? []) {
      // tool_use blocks: Claude's search queries (not URLs themselves)
      // tool_result blocks: search results with URLs
      if (block.type === "tool_result") {
        const content = Array.isArray(block.content) ? block.content : [];
        for (const item of content) {
          if (item?.source?.url) urls.push(item.source.url);
          if (item?.url) urls.push(item.url);
          if (item?.type === "document" && item?.source?.url) urls.push(item.source.url);
        }
      }
      // Text blocks: may include inline citations
      if (block.type === "text") {
        const citations = (block as { citations?: { url?: string; source?: { url?: string } }[] }).citations ?? [];
        for (const c of citations) {
          if (c.url) urls.push(c.url);
          if (c.source?.url) urls.push(c.source.url as string);
        }
      }
    }

    // Deduplicate
    const unique = [...new Set(urls)];

    const citedIdx = unique.findIndex(u => domainMatches(u, trackedDomain));
    const competitorDomains = unique
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (unique[citedIdx] ?? null) : null,
      competitorDomains,
      rawResponse: response as unknown as Record<string, unknown>,
    };
  }
}
