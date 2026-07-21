import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// Uses Gemini with Google Search grounding.
// The grounding metadata in the response contains the web sources Gemini cited.
// Docs: https://ai.google.dev/gemini-api/docs/grounding

interface GroundingChunk {
  web?: { uri: string; title?: string };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
      webSearchQueries?: string[];
    };
  }[];
  error?: { message: string; code: number };
}

export class GeminiConnector implements PlatformConnector {
  readonly platform = "gemini" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const body = {
      contents: [{ parts: [{ text: promptText }], role: "user" }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 512 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as GeminiResponse;

    if (data.error) throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract all cited URLs from groundingChunks
    const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const urls = chunks
      .map(c => c.web?.uri)
      .filter((u): u is string => !!u);

    const citedIdx = urls.findIndex(u => domainMatches(u, trackedDomain));

    const competitorDomains = urls
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      mentioned: checkMentioned(responseText, trackedDomain),
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (urls[citedIdx] ?? null) : null,
      competitorDomains,
      responseText: responseText.slice(0, 1000),
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
