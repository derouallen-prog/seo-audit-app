import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SEMRUSH_BASE = "https://api.semrush.com/";

interface ClientProfile {
  secteur: string;
  description: string;
  personas: string;
  arguments: string;
}

interface KeywordRow {
  keyword: string;
  searchVolume: number;
  kd: number;
  intent: string;
  position: number;
}

function intentLabel(raw: string): string {
  const map: Record<string, string> = {
    "0": "Informationnelle",
    "1": "Navigationnelle",
    "2": "Commerciale",
    "3": "Transactionnelle",
  };
  const parts = raw.split(",").map(p => map[p.trim()] ?? p.trim()).filter(Boolean);
  return parts.join(" + ") || "—";
}

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(";");
  return lines.slice(1).map(line => {
    const values = line.split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? "").trim(); });
    return row;
  });
}

async function fetchDomainKeywords(domain: string, limit = 100): Promise<KeywordRow[]> {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({
    type: "domain_organic",
    key: apiKey,
    domain,
    database: "fr",
    display_limit: String(limit),
    display_sort: "nq_desc",
    export_columns: "Ph,Po,Nq,Kd,In",
  });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`${SEMRUSH_BASE}?${params}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const text = await res.text();
    if (text.startsWith("ERROR")) {
      console.warn("[keywords/semrush] error:", text.slice(0, 120));
      return [];
    }
    return parseCsv(text).map(r => ({
      keyword: r["Keyword"] || r["Ph"] || "",
      position: parseInt(r["Position"] || r["Po"] || "0", 10),
      searchVolume: parseInt(r["Search Volume"] || r["Nq"] || "0", 10),
      kd: parseInt(r["Keyword Difficulty"] || r["Kd"] || "0", 10),
      intent: intentLabel(r["Intent"] || r["In"] || ""),
    })).filter(k => k.keyword);
  } catch {
    return [];
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)" },
    });
    clearTimeout(t);
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const title = $("title").text().trim();
    const h1 = $("h1").first().text().trim();
    const body = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1500);
    return `Title: ${title}\nH1: ${h1}\n\n${body}`;
  } catch {
    return "";
  }
}

function extractDomain(input: string): string {
  const s = input.trim();
  try {
    const u = s.startsWith("http") ? new URL(s) : new URL(`https://${s}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0] || s;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, clientProfile, competitors } = await req.json() as {
      url: string;
      clientProfile: ClientProfile;
      competitors: string[];
    };

    if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

    const mainDomain = extractDomain(url);
    const competitorDomains = (competitors || [])
      .map(c => extractDomain(c))
      .filter(Boolean)
      .slice(0, 4);

    // Fetch keywords in parallel
    const [mainKws, ...compKwsArrays] = await Promise.all([
      fetchDomainKeywords(mainDomain, 100),
      ...competitorDomains.map(d => fetchDomainKeywords(d, 50)),
    ]);

    // Merge + deduplicate
    const seen = new Set<string>();
    const allKws: KeywordRow[] = [];
    for (const kw of [...mainKws, ...compKwsArrays.flat()]) {
      const key = kw.keyword.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allKws.push(kw);
      }
    }
    const merged = allKws.slice(0, 200);

    if (merged.length === 0) {
      return NextResponse.json({ error: "Aucun mot-clé trouvé via Semrush pour ce domaine." }, { status: 422 });
    }

    const pageContent = await fetchPageContent(url);

    const kwList = merged
      .map((k, i) => `${i + 1}. "${k.keyword}" | Vol: ${k.searchVolume} | KD: ${k.kd} | Intent: ${k.intent}`)
      .join("\n");

    const systemPrompt = `Tu es un expert SEO senior. Tu analyses une liste de mots-clés Semrush et tu assignes le mot-clé principal et des mots-clés secondaires pertinents pour une page web donnée.

Critères de sélection (par ordre de priorité) :
1. Pertinence sémantique avec le contenu réel de la page
2. Alignement avec les personas et le secteur d'activité
3. Cohérence avec le positionnement et les arguments différenciants
4. Volume de recherche et difficulté (préférer KD < 60 sauf si très pertinent)

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "mot_cle_principal": "...",
  "volume": 0,
  "kd": 0,
  "intent": "...",
  "mots_cles_secondaires": [
    { "keyword": "...", "volume": 0, "kd": 0, "intent": "..." }
  ],
  "justification": "..."
}
Les mots_cles_secondaires doivent contenir entre 3 et 5 entrées.`;

    const userPrompt = `Contenu de la page :
${pageContent || "Non disponible"}

Profil client :
- Secteur : ${clientProfile?.secteur || "Non précisé"}
- Description : ${clientProfile?.description || "Non précisée"}
- Personas : ${clientProfile?.personas || "Non précisés"}
- Arguments différenciants : ${clientProfile?.arguments || "Non précisés"}

Mots-clés disponibles (${merged.length}) :
${kwList}

Assigne le mot-clé principal et 3 à 5 mots-clés secondaires les plus pertinents pour cette page.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (response.content[0] as { text: string }).text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const result = JSON.parse(raw);
    return NextResponse.json(result);
  } catch (e) {
    console.error("keywords error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
