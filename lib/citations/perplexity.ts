import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// Uses Perplexity Sonar chat completions API — model returns citations as a flat array of URLs.
// Docs: https://docs.perplexity.ai/reference/post_chat_completions

interface PerplexityResponse {
  id: string;
  model: string;
  choices: { message: { role: string; content: string } }[];
  citations?: string[];
}

export class PerplexityConnector implements PlatformConnector {
  readonly platform = "perplexity" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured");

    const body = {
      model: "sonar",
      messages: [{ role: "user", content: promptText }],
      return_citations: true,
      max_tokens: 512,
    };

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perplexity API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as PerplexityResponse;
    const citations: string[] = data.citations ?? [];
    const responseText = data.choices?.[0]?.message?.content ?? "";

    // Find if tracked domain appears in citations and at what position
    let citedIdx = -1;
    for (let i = 0; i < citations.length; i++) {
      if (citations[i] && domainMatches(citations[i]!, trackedDomain)) {
        citedIdx = i;
        break;
      }
    }

    const competitorDomains = citations
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      mentioned: checkMentioned(responseText, trackedDomain),
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (citations[citedIdx] ?? null) : null,
      competitorDomains,
      responseText: responseText.slice(0, 1000),
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
