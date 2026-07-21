import { createClient } from "@supabase/supabase-js";
import { PerplexityConnector } from "./perplexity";
import { ClaudeConnector } from "./claude";
import { GeminiConnector } from "./gemini";
import type { Platform, CitationResult } from "./types";
import { PLATFORMS } from "./types";

const CONNECTORS = [new PerplexityConnector(), new ClaudeConnector(), new GeminiConnector()];

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface RunOptions {
  platforms?: Platform[];
  source?: "auto" | "manual";
}

export interface RunSummary {
  promptId: string;
  platform: Platform;
  cited: boolean;
  citationPosition: number | null;
  error?: string;
}

/**
 * Run a single prompt against all (or selected) platforms and store results in Supabase.
 */
export async function runPrompt(
  promptId: string,
  promptText: string,
  trackedDomain: string,
  opts: RunOptions = {}
): Promise<RunSummary[]> {
  const { platforms = PLATFORMS, source = "auto" } = opts;
  const sb = getSupabase();
  const summaries: RunSummary[] = [];

  const connectors = CONNECTORS.filter(c => platforms.includes(c.platform));

  // Run each platform sequentially to avoid rate limits
  for (const connector of connectors) {
    let result: CitationResult;
    let error: string | undefined;

    try {
      result = await connector.run(promptText, trackedDomain);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error(`[citations] ${connector.platform} error for prompt ${promptId}:`, e);
      result = {
        cited: false,
        citationPosition: null,
        citedUrl: null,
        competitorDomains: [],
        rawResponse: { error },
      };
    }

    const { error: dbError } = await sb.from("citation_runs").insert({
      prompt_id: promptId,
      platform: connector.platform,
      cited: result.cited,
      citation_position: result.citationPosition,
      cited_url: result.citedUrl,
      competitor_domains: result.competitorDomains,
      raw_response: result.rawResponse,
      source,
    });

    if (dbError) {
      console.error(`[citations] DB insert error for ${connector.platform}:`, dbError.message);
    }

    summaries.push({
      promptId,
      platform: connector.platform,
      cited: result.cited,
      citationPosition: result.citationPosition,
      ...(error ? { error } : {}),
    });

    // Small delay between platforms to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  return summaries;
}

/**
 * Run all active prompts for a user (used by cron).
 * Returns a summary of runs executed.
 */
export async function runAllActivePrompts(userId?: string): Promise<{ ran: number; errors: number }> {
  const sb = getSupabase();

  let query = sb
    .from("prompt_sets")
    .select("id, prompt_text, tracked_url")
    .eq("active", true);

  if (userId) query = query.eq("user_id", userId);

  const { data: prompts, error } = await query;
  if (error || !prompts) {
    console.error("[citations] cron: could not fetch prompts:", error?.message);
    return { ran: 0, errors: 1 };
  }

  let ran = 0;
  let errors = 0;

  for (const p of prompts) {
    const results = await runPrompt(p.id, p.prompt_text, p.tracked_url, { source: "auto" });
    ran += results.length;
    errors += results.filter(r => r.error).length;
    // Space out prompts to avoid API rate limits
    if (prompts.indexOf(p) < prompts.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { ran, errors };
}
