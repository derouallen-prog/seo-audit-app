import type { CitationResult, PlatformConnector } from "./types";
import { domainMatches, extractHostname, checkMentioned } from "./types";

// DataForSEO Gemini LLM Scraper — scrapes the actual Gemini web interface.
// Returns what users really see: AI response + Google-grounded sources.
// Required env vars: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD

interface DFSSearchResult {
  url?: string;
  title?: string;
  snippet?: string;
}

interface DFSResult {
  markdown?: string;
  search_results?: DFSSearchResult[];
}

interface DFSTask {
  status_code?: number;
  status_message?: string;
  result?: DFSResult[];
}

interface DFSResponse {
  tasks?: DFSTask[];
  status_code?: number;
}

function dfsAuth(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured");
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export class DataForSEOGeminiConnector implements PlatformConnector {
  readonly platform = "gemini" as const;

  async run(promptText: string, trackedDomain: string): Promise<CitationResult> {
    const auth = dfsAuth();

    const res = await fetch("https://api.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify([{
        keyword: promptText,
        location_code: 2250,   // France
        language_code: "fr",
      }]),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DataForSEO Gemini error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as DFSResponse;
    const task = data.tasks?.[0];
    if (task?.status_code && task.status_code !== 20000) {
      throw new Error(`DataForSEO task error ${task.status_code}: ${task.status_message}`);
    }

    const result = task?.result?.[0];
    const markdown = result?.markdown ?? "";
    const searchResults = result?.search_results ?? [];

    const urls = searchResults.map(r => r.url ?? "").filter(Boolean);
    const mdUrls = [...markdown.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(m => m[1] ?? "");
    const allUrls = [...new Set([...urls, ...mdUrls])];

    const plainText = markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

    const citedIdx = allUrls.findIndex(u => domainMatches(u, trackedDomain));
    const competitorDomains = allUrls
      .filter((_, i) => i !== citedIdx)
      .map(extractHostname)
      .filter((v, i, a) => v && a.indexOf(v) === i);

    return {
      cited: citedIdx >= 0,
      mentioned: checkMentioned(plainText, trackedDomain),
      citationPosition: citedIdx >= 0 ? citedIdx + 1 : null,
      citedUrl: citedIdx >= 0 ? (allUrls[citedIdx] ?? null) : null,
      competitorDomains,
      responseText: plainText.slice(0, 1000),
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}
