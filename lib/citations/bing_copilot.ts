import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// Bing Copilot via Azure OpenAI with Bing Search grounding.
// Required env vars:
//   AZURE_OPENAI_API_KEY      — Azure OpenAI resource key
//   AZURE_OPENAI_ENDPOINT     — e.g. https://my-resource.openai.azure.com
//   AZURE_OPENAI_DEPLOYMENT   — e.g. gpt-4o
//   BING_SEARCH_API_KEY       — Bing Search v7 API key (for grounding)

interface AzureMessage {
  role: string;
  content: string;
}

interface AzureChoice {
  message: AzureMessage;
  context?: {
    citations?: { url?: string; content?: string }[];
    messages?: { content?: string }[];
  };
}

interface AzureResponse {
  choices?: AzureChoice[];
  error?: { message: string };
}

export class BingCopilotConnector implements PlatformConnector {
  readonly platform = "bing_copilot" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
    const bingKey = process.env.BING_SEARCH_API_KEY;

    if (!apiKey || !endpoint) throw new Error("AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT not configured");
    if (!bingKey) throw new Error("BING_SEARCH_API_KEY not configured");

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-05-01-preview`;

    const body: Record<string, unknown> = {
      messages: [{ role: "user", content: promptText }],
      max_tokens: 1000,
      temperature: 0,
      data_sources: [
        {
          type: "bing_search",
          parameters: {
            endpoint: "https://api.bing.microsoft.com",
            authentication: { type: "api_key", key: bingKey },
            count: 8,
            strictness: 3,
            top_n_documents: 5,
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Azure OpenAI Bing Copilot error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as AzureResponse;
    if (data.error) throw new Error(`Azure OpenAI error: ${data.error.message}`);

    const choice = data.choices?.[0];
    const responseText = choice?.message?.content ?? "";

    // Citations from Azure "on your data" context block
    const citations: string[] = [];
    const ctx = choice?.context;
    if (ctx?.citations) {
      for (const c of ctx.citations) {
        if (c.url) citations.push(c.url);
      }
    }

    const unique = [...new Set(citations)];
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
