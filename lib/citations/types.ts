export type Platform = "perplexity" | "claude" | "openai" | "gemini" | "bing_copilot";
export type Intent = "Informational" | "Navigational" | "Commercial" | "Learn and Solve" | "Local" | "Others";

export const PLATFORMS: Platform[] = ["perplexity", "claude", "gemini"];
export const INTENTS: Intent[] = ["Informational", "Navigational", "Commercial", "Learn and Solve", "Local", "Others"];

export interface CitationResult {
  cited: boolean;
  mentioned: boolean;
  citationPosition: number | null;
  citedUrl: string | null;
  competitorDomains: string[];
  responseText: string;
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
  language: string;
  active: boolean;
  created_at: string;
}

export interface CitationRun {
  id: string;
  prompt_id: string;
  platform: Platform;
  run_at: string;
  cited: boolean;
  mentioned: boolean;
  citation_position: number | null;
  cited_url: string | null;
  competitor_domains: string[];
  response_text: string | null;
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

/**
 * True if the brand name or hostname appears in the response text.
 * "Mention" = brand evoked in prose, even without a URL citation.
 * Example: "protilab.fr" → checks for "protilab.fr" OR "protilab" in text.
 */
export function checkMentioned(text: string, trackedDomain: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const hostname = extractHostname(trackedDomain);
  if (lower.includes(hostname.toLowerCase())) return true;
  // Brand = second-to-last label of hostname (before TLD)
  const parts = hostname.replace(/^www\./, "").split(".");
  const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  // Skip very short labels that would cause false positives
  if (brand && brand.length > 3) {
    return lower.includes(brand.toLowerCase());
  }
  return false;
}
