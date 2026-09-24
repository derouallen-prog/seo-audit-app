import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// Bing Copilot via Bing Web Search API v7.
// We query Bing with the prompt and check whether the tracked domain appears
// in the top web results — which are the exact sources Copilot grounds itself on.
// Citations = domain found in result URLs.
// Mentions  = brand/domain found in result snippets or titles.
// Required env var: BING_API_KEY (Bing Search v7, free: 1000 req/month)

interface BingWebPage {
  url: string;
  name: string;
  snippet: string;
  displayUrl?: string;
}

interface BingResponse {
  webPages?: { value: BingWebPage[] };
  error?: { message: string };
}

export class BingCopilotConnector implements PlatformConnector {
  readonly platform = "bing_copilot" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const apiKey = process.env.BING_API_KEY;
    if (!apiKey) throw new Error("BING_API_KEY not configured");

    const params = new URLSearchParams({ q: promptText, count: "10", mkt: "fr-FR", responseFilter: "Webpages" });
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Bing Search API error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as BingResponse;
    if (data.error) throw new Error(`Bing error: ${data.error.message}`);

    const pages = data.webPages?.value ?? [];
    const urls = pages.map(p => p.url);

    // Aggregate all text visible to Copilot for mention detection
    const aggregatedText = pages.map(p => `${p.name} ${p.snippet}`).join(" ");

    const citedIdx = urls.findIndex(u => domainMatches(u, trackedDomain));
    const competitorDomains = urls
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      mentioned: checkMentioned(aggregatedText, trackedDomain),
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (urls[citedIdx] ?? null) : null,
      competitorDomains,
      responseText: aggregatedText.slice(0, 1000),
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
