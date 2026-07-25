import { PerplexityConnector } from "./citations/perplexity";
import { GeminiConnector } from "./citations/gemini";
import { ClaudeConnector } from "./citations/claude";
import { OpenAIConnector } from "./citations/openai";
import type { CitationResult, Platform, PlatformConnector } from "./citations/types";
import { extractHostname } from "./citations/types";

const CONNECTORS: Partial<Record<Platform, PlatformConnector>> = {
  perplexity: new PerplexityConnector(),
  gemini: new GeminiConnector(),
  claude: new ClaudeConnector(),
  openai: new OpenAIConnector(),
};

const PLATFORM_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  gemini: "Gemini (Google Search)",
  openai: "ChatGPT (OpenAI web search)",
  claude: "Claude (claude.ai)",
};

export interface GeoCheckParams {
  keyword: string;
  site_url: string;
  platforms?: Platform[];
}

export async function checkGeoVisibility(p: GeoCheckParams): Promise<string> {
  const { keyword, site_url } = p;
  const platforms: Platform[] = p.platforms?.length ? p.platforms : ["perplexity", "gemini", "openai"];

  const domain = extractHostname(site_url);

  const results: { platform: string; result?: CitationResult; error?: string }[] = [];

  // Run platforms in parallel
  await Promise.all(
    platforms.map(async (platform) => {
      const connector = CONNECTORS[platform];
      if (!connector) {
        results.push({ platform, error: `Connecteur "${platform}" non disponible.` });
        return;
      }
      try {
        const result = await connector.run(keyword, domain);
        results.push({ platform, result });
      } catch (e) {
        results.push({ platform, error: e instanceof Error ? e.message : String(e) });
      }
    })
  );

  // Format output
  const lines: string[] = [
    `## Visibilité GEO — "${keyword}"`,
    `Domaine analysé : **${domain}**\n`,
  ];

  for (const { platform, result, error } of results) {
    const label = PLATFORM_LABELS[platform] ?? platform;
    lines.push(`### ${label}`);

    if (error) {
      lines.push(`❌ Erreur : ${error}\n`);
      continue;
    }

    if (!result) continue;

    if (result.cited) {
      lines.push(`✅ **Cité en position #${result.citationPosition ?? "?"}**`);
      if (result.citedUrl) lines.push(`- URL citée : ${result.citedUrl}`);
    } else if (result.mentioned) {
      lines.push(`⚠️ **Mentionné dans le texte** (non cité comme source)`);
    } else {
      lines.push(`❌ **Non cité, non mentionné**`);
    }

    if (result.responseText) {
      lines.push(`\n**Extrait de la réponse :**`);
      lines.push(`> ${result.responseText.slice(0, 500).replace(/\n/g, "\n> ")}`);
    }

    if (result.competitorDomains.length > 0) {
      lines.push(`\n**Sources concurrentes citées :** ${result.competitorDomains.slice(0, 6).join(", ")}`);
    }

    lines.push("");
  }

  // Summary
  const cited = results.filter(r => r.result?.cited).map(r => PLATFORM_LABELS[r.platform] ?? r.platform);
  const mentioned = results.filter(r => !r.result?.cited && r.result?.mentioned).map(r => PLATFORM_LABELS[r.platform] ?? r.platform);
  const absent = results.filter(r => r.result && !r.result.cited && !r.result.mentioned).map(r => PLATFORM_LABELS[r.platform] ?? r.platform);

  lines.push("---");
  lines.push("**Synthèse :**");
  if (cited.length) lines.push(`- Cité sur : ${cited.join(", ")}`);
  if (mentioned.length) lines.push(`- Mentionné (sans source) sur : ${mentioned.join(", ")}`);
  if (absent.length) lines.push(`- Absent de : ${absent.join(", ")}`);

  return lines.join("\n");
}
