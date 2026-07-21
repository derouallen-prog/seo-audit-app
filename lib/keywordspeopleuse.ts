/**
 * Keywords People Use (KPU) API client
 * Documentation: https://keywordspeopleuse.stoplight.io/docs/keywordspeopleuse-api
 * Requires env: KPU_API_KEY (Standard plan or higher)
 *
 * Endpoint paths below match the REST API documented in Stoplight.
 * If your account uses a different base URL, update KPU_BASE_URL accordingly.
 */

const KPU_BASE_URL = "https://api.keywordspeopleuse.com";
const TIMEOUT_MS = 12_000;

function getKey(): string {
  const key = process.env.KPU_API_KEY;
  if (!key) throw new Error("KPU_API_KEY not set");
  return key;
}

async function kpuFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${KPU_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getKey(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`KPU API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export interface KpuPaaQuestion {
  question: string;
  depth?: number;
  related?: KpuPaaQuestion[];
}

export interface KpuPaaResult {
  keyword: string;
  questions: KpuPaaQuestion[];
}

/**
 * Fetch People Also Ask questions for a keyword.
 * Returns a flat list of all questions (including nested).
 */
export async function getKpuPeopleAlsoAsk(
  keyword: string,
  country = "fr",
  language = "fr",
  depth = 2,
): Promise<KpuPaaResult> {
  const raw = await kpuFetch<{ data?: KpuPaaQuestion[] } | KpuPaaQuestion[]>(
    "/paa",
    { keyword, country, language, depth },
  );
  const questions = Array.isArray(raw) ? raw : (raw as { data?: KpuPaaQuestion[] }).data ?? [];
  return { keyword, questions };
}

export interface KpuSuggestion {
  keyword: string;
  type?: string;
}

export interface KpuSuggestionsResult {
  keyword: string;
  autocomplete: KpuSuggestion[];
  semantic: KpuSuggestion[];
  questions: KpuSuggestion[];
}

/**
 * Fetch Google Autocomplete suggestions + semantic keywords for a keyword.
 * Runs three KPU endpoints in parallel.
 */
export async function getKpuSuggestions(
  keyword: string,
  country = "fr",
  language = "fr",
): Promise<KpuSuggestionsResult> {
  type Raw = { data?: KpuSuggestion[] } | KpuSuggestion[];
  const normalize = (raw: Raw): KpuSuggestion[] =>
    Array.isArray(raw) ? raw : (raw as { data?: KpuSuggestion[] }).data ?? [];

  const [autocomplete, semantic, questions] = await Promise.allSettled([
    kpuFetch<Raw>("/autocomplete", { keyword, country, language }),
    kpuFetch<Raw>("/semantic", { keyword, country, language }),
    kpuFetch<Raw>("/questions", { keyword, country, language }),
  ]);

  return {
    keyword,
    autocomplete: autocomplete.status === "fulfilled" ? normalize(autocomplete.value) : [],
    semantic: semantic.status === "fulfilled" ? normalize(semantic.value) : [],
    questions: questions.status === "fulfilled" ? normalize(questions.value) : [],
  };
}

/** Format PAA result for the assistant context */
export function formatPaaForAssistant(result: KpuPaaResult): string {
  function flattenQuestions(qs: KpuPaaQuestion[], depth = 0): string[] {
    const out: string[] = [];
    for (const q of qs) {
      out.push(`${"  ".repeat(depth)}- ${q.question}`);
      if (q.related?.length) out.push(...flattenQuestions(q.related, depth + 1));
    }
    return out;
  }

  if (!result.questions.length) {
    return `Aucune question "People Also Ask" trouvée pour "${result.keyword}".`;
  }

  const lines = [
    `## People Also Ask — "${result.keyword}"`,
    `${result.questions.length} question(s) extraites de Google PAA\n`,
    ...flattenQuestions(result.questions),
  ];
  return lines.join("\n");
}

/** Format suggestions result for the assistant context */
export function formatSuggestionsForAssistant(result: KpuSuggestionsResult): string {
  const lines: string[] = [`## Keywords People Use — Suggestions pour "${result.keyword}"\n`];

  if (result.autocomplete.length) {
    lines.push(`### Google Autocomplete (${result.autocomplete.length})`);
    for (const s of result.autocomplete.slice(0, 20)) lines.push(`- ${s.keyword}`);
    lines.push("");
  }
  if (result.semantic.length) {
    lines.push(`### Mots-clés sémantiques (${result.semantic.length})`);
    for (const s of result.semantic.slice(0, 20)) lines.push(`- ${s.keyword}`);
    lines.push("");
  }
  if (result.questions.length) {
    lines.push(`### Questions Reddit/Quora (${result.questions.length})`);
    for (const s of result.questions.slice(0, 15)) lines.push(`- ${s.keyword}`);
  }

  if (lines.length === 1) return `Aucune suggestion KPU trouvée pour "${result.keyword}".`;
  return lines.join("\n");
}
