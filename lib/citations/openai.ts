import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// Uses OpenAI Responses API with web_search_preview tool.
// The response annotations contain url_citation entries with the sources cited.
// Docs: https://platform.openai.com/docs/guides/tools/web-search

interface UrlCitationAnnotation {
  type: "url_citation";
  url: string;
  title?: string;
  start_index: number;
  end_index: number;
}

interface OutputTextContent {
  type: "output_text";
  text: string;
  annotations?: UrlCitationAnnotation[];
}

interface MessageOutput {
  type: "message";
  role: string;
  content: OutputTextContent[];
}

interface OpenAIResponseOutput {
  type: string;
  [key: string]: unknown;
}

interface OpenAIResponse {
  output?: OpenAIResponseOutput[];
  error?: { message: string };
}

export class OpenAIConnector implements PlatformConnector {
  readonly platform = "openai" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: promptText,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Responses API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as OpenAIResponse;

    if (data.error) throw new Error(`OpenAI error: ${data.error.message}`);

    const urls: string[] = [];
    let responseText = "";

    for (const item of data.output ?? []) {
      if (item.type === "message") {
        const msg = item as unknown as MessageOutput;
        for (const part of msg.content ?? []) {
          if (part.type === "output_text") {
            responseText += part.text ?? "";
            for (const ann of part.annotations ?? []) {
              if (ann.type === "url_citation" && ann.url) {
                urls.push(ann.url);
              }
            }
          }
        }
      }
    }

    const unique = [...new Set(urls)];
    const citedIdx = unique.findIndex(u => domainMatches(u, trackedDomain));
    const competitorDomains = unique
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      mentioned: checkMentioned(responseText, trackedDomain),
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (unique[citedIdx] ?? null) : null,
      competitorDomains,
      responseText: responseText.slice(0, 1000),
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
