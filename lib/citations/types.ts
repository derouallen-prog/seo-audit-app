export type Platform = "perplexity" | "claude" | "openai" | "gemini" | "bing_copilot";
export type Intent = "Informational" | "Navigational" | "Commercial" | "Learn and Solve" | "Local" | "Others";

export const PLATFORMS: Platform[] = ["perplexity", "claude", "gemini"];
export const INTENTS: Intent[] = ["Informational", "Navigational", "Commercial", "Learn and Solve", "Local", "Others"];

export interface CitationResult {
  cited: boolean;
  citationPosition: number | null;
  citedUrl: string | null;
  competitorDomains: string[];
  rawResponse: Record<string, unknown>;
}

export interface PlatformConnector {
  platform: Platform;
  run(promptText: string, trackedDomain: string): Promise<CitationResult>;
}

export interface PromptSet {
  id: string;
  user_id: string;
  tracked_url: string;
  prompt_text: string;
  intent: Intent;
  topic: string | null;
  active: boolean;
  created_at: string;
}

export interface CitationRun {
  id: string;
  prompt_id: string;
  platform: Platform;
  run_at: string;
  cited: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[];
  source: string;
  created_at: string;
}

/** Extract the registrable domain (hostname) from a URL safely */
export function extractHostname(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? url;
  }
}

/** True if a URL belongs to a tracked domain */
export function domainMatches(url: string, trackedDomain: string): boolean {
  const normalizedUrl = extractHostname(url);
  const normalizedTarget = trackedDomain.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  return normalizedUrl === normalizedTarget || normalizedUrl.endsWith("." + normalizedTarget);
}
