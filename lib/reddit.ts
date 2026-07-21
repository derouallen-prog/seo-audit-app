// Reddit data via public RSS feeds (no API key required)
// OAuth upgrade: set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in .env.local for 100 req/min + vote counts.
// Public RSS rate limit: ~30 req/min — sufficient for SEO research use case (3-5 calls per analysis).

const USER_AGENT = "SEOAuditApp/1.0 (SEO keyword research)";
const RSS_HEADERS = { "User-Agent": USER_AGENT, Accept: "application/atom+xml,application/xml;q=0.9,*/*;q=0.8" };

// ─── OAuth optional upgrade ───────────────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;
  try {
    const creds = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const d = await res.json() as { access_token: string; expires_in: number };
    _tokenCache = { token: d.access_token, expiresAt: Date.now() + (d.expires_in - 60) * 1000 };
    return _tokenCache.token;
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;       // 0 when using RSS (unavailable)
  numComments: number; // extracted from content when available
  permalink: string;
  subreddit: string;
  upvoteRatio: number; // 0 when using RSS (unavailable)
}

// ─── RSS parsing ─────────────────────────────────────────────────────────────

function htmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#32;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRedditRSS(xml: string): RedditPost[] {
  if (!xml || xml.length < 100) return [];

  const entries = xml.split("<entry>").slice(1);
  const posts: RedditPost[] = [];

  for (const block of entries) {
    // Filter to posts only (t3_) — skip subreddits (t5_), comments (t1_)
    const idMatch = block.match(/<id>([^<]+)<\/id>/);
    const id = idMatch?.[1] ?? "";
    if (!id.startsWith("t3_")) continue;

    // Title (first <title> in block)
    const title = htmlDecode(block.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim();
    if (!title) continue;

    // Subreddit from <category term="...">
    const subreddit = (block.match(/category\s+term="([^"]+)"/) ?? [])[1]?.trim() ?? "";

    // Post permalink from <link href="..."/> — the actual Reddit post URL
    const permalink = (block.match(/<link\s+href="([^"]+)"/) ?? [])[1] ?? "";
    if (!permalink || !permalink.includes("reddit.com")) continue;

    // Content: HTML-encoded post body
    const rawContent = block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "";
    const decoded = htmlDecode(rawContent);

    // Comment count — search RSS includes "[N comments]", subreddit RSS just "[comments]"
    const numComments = parseInt(decoded.match(/\[(\d+)\s+comments?\]/)?.[1] ?? "0");

    // Selftext: text inside .md div (self-posts only)
    const mdMatch = decoded.match(/class="md">([\s\S]*?)<\/div>/);
    const selftext = mdMatch?.[1] ? stripTags(mdMatch[1]).slice(0, 600) : "";

    posts.push({
      id: id.replace("t3_", ""),
      title,
      selftext,
      score: 0,
      numComments,
      permalink,
      subreddit,
      upvoteRatio: 0,
    });
  }

  return posts;
}

// ─── RSS fetch with retry on empty body ──────────────────────────────────────

async function fetchRSS(url: string): Promise<RedditPost[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000)); // 2s backoff on retry
    try {
      const res = await fetch(url, { headers: RSS_HEADERS });
      if (!res.ok) { console.warn("[reddit] RSS", res.status, url); return []; }
      const xml = await res.text();
      if (xml.length < 200) continue; // empty / rate-limited → retry once
      const posts = parseRedditRSS(xml);
      if (posts.length > 0 || attempt > 0) return posts;
    } catch (e) {
      console.warn("[reddit] fetch error:", e);
      return [];
    }
  }
  return [];
}

// ─── JSON API (OAuth path) ────────────────────────────────────────────────────

function mapJsonPost(d: Record<string, unknown>): RedditPost {
  return {
    id: String(d.id ?? ""),
    title: String(d.title ?? ""),
    selftext: String(d.selftext ?? "").slice(0, 600),
    score: Number(d.score ?? 0),
    numComments: Number(d.num_comments ?? 0),
    permalink: `https://reddit.com${String(d.permalink ?? "")}`,
    subreddit: String(d.subreddit ?? ""),
    upvoteRatio: Number(d.upvote_ratio ?? 0),
  };
}

async function jsonSearch(path: string, token: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const d = await res.json() as { data: { children: { kind: string; data: Record<string, unknown> }[] } };
    return d.data.children.filter(c => c.kind === "t3").map(c => mapJsonPost(c.data));
  } catch { return []; }
}

// ─── Public surface ───────────────────────────────────────────────────────────

export async function searchRedditPosts(
  query: string,
  options: { subreddits?: string[]; sort?: "relevance" | "top" | "new"; timeFilter?: "week" | "month" | "year" | "all"; limit?: number } = {}
): Promise<RedditPost[]> {
  const { sort = "relevance", timeFilter = "year", limit = 25 } = options;
  const token = await getOAuthToken();

  if (token) {
    const p = new URLSearchParams({ q: query, sort, t: timeFilter, limit: String(Math.min(limit, 100)), type: "link" });
    const base = options.subreddits?.length ? `/r/${options.subreddits.join("+")}/search.json` : "/search.json";
    if (options.subreddits?.length) p.set("restrict_sr", "true");
    return jsonSearch(`${base}?${p}`, token);
  }

  // RSS fallback
  const p = new URLSearchParams({ q: query, sort, t: timeFilter, limit: String(Math.min(limit, 100)) });
  const base = options.subreddits?.length
    ? `https://www.reddit.com/r/${options.subreddits.join("+")}/search.rss`
    : "https://www.reddit.com/search.rss";
  if (options.subreddits?.length) p.set("restrict_sr", "true");
  return fetchRSS(`${base}?${p}`);
}

export async function getSubredditTopPosts(
  subreddit: string,
  sort: "hot" | "top" | "new" = "top",
  timeFilter: "week" | "month" | "year" = "month",
  limit = 25
): Promise<RedditPost[]> {
  const token = await getOAuthToken();
  if (token) {
    const p = new URLSearchParams({ limit: String(limit), t: timeFilter });
    return jsonSearch(`/r/${subreddit}/${sort}.json?${p}`, token);
  }
  const p = new URLSearchParams({ limit: String(limit), t: timeFilter });
  return fetchRSS(`https://www.reddit.com/r/${subreddit}/${sort}.rss?${p}`);
}

// ─── Semantic Corpus ──────────────────────────────────────────────────────────

export interface SemanticCorpus {
  totalPosts: number;
  topTerms: { term: string; count: number }[];
  questions: string[];
  painPoints: string[];
  topSubreddits: { name: string; posts: number }[];
  contentIdeas: { title: string; score: number; comments: number; url: string; subreddit: string }[];
}

const STOP = new Set([
  "the","a","an","is","it","in","on","at","to","for","of","and","or","but","with","this","that",
  "i","my","me","we","our","you","your","they","their","he","she","his","her","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could","should","may","might",
  "can","from","by","as","are","not","what","how","when","where","why","who","which","there","here",
  "so","if","about","up","out","just","more","also","like","get","use","got","its","any","all","now",
  "new","one","two","some","than","then","into","no","ve","don","re","ll","t","s","m","d","am","im",
  "know","think","want","need","going","good","really","actually","still","even","much","very",
  "people","thing","things","make","way","time","see","come","look","used","using","feel","work","try",
  "les","des","une","est","pour","qui","que","pas","dans","sur","avec","par","du","au","en","il",
  "elle","on","nous","vous","ils","elles","je","tu","se","lui","leur","ce","cette","ces","son","sa",
  "ses","mon","ma","mes","un","le","la","de","et","ou","mais","donc","or","ni","car","si","ne","plus",
  "très","tout","bien","faire","être","avoir","comme","même","aussi","alors","après","avant","quant",
  "dont","où","ça","trop","déjà","encore","toujours","jamais","peut","faut","fait","ont","sont","était",
]);

export function extractSemanticCorpus(posts: RedditPost[]): SemanticCorpus {
  const termFreq: Record<string, number> = {};
  const questions: string[] = [];
  const painPoints: string[] = [];
  const subCount: Record<string, number> = {};

  for (const post of posts) {
    if (post.subreddit) subCount[post.subreddit] = (subCount[post.subreddit] || 0) + 1;

    const text = `${post.title} ${post.selftext}`.toLowerCase();
    for (const tok of text.match(/\b[a-zàâéèêëîïôùûüçœæ]{3,}\b/g) ?? []) {
      if (!STOP.has(tok)) termFreq[tok] = (termFreq[tok] || 0) + 1;
    }

    if (post.title.includes("?") || /^(how|what|why|when|where|which|who|is|are|can|does|should|would|best|recommend|comment|pourquoi|quel|quelle|est-ce|faut-il|peut-on|combien)/i.test(post.title))
      questions.push(post.title);

    if (/(problem|issue|fail|broken|not working|help|stuck|confused|frustrated|worst|hate|terrible|struggle|difficult|hard time|error|bug|doesn't work|won't work|problème|aide|bloqué|difficile|marche pas|fonctionne pas|erreur)/i.test(`${post.title} ${post.selftext}`))
      painPoints.push(post.title);
  }

  return {
    totalPosts: posts.length,
    topTerms: Object.entries(termFreq).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([term, count]) => ({ term, count })),
    questions: questions.slice(0, 15),
    painPoints: painPoints.slice(0, 10),
    topSubreddits: Object.entries(subCount).sort((a, b) => b[1] - a[1]).map(([name, posts]) => ({ name, posts })),
    contentIdeas: [...posts]
      .sort((a, b) => (b.score + b.numComments * 3) - (a.score + a.numComments * 3))
      .slice(0, 12)
      .map(p => ({ title: p.title, score: p.score, comments: p.numComments, url: p.permalink, subreddit: p.subreddit })),
  };
}

// ─── Ninja Linking Opportunities ─────────────────────────────────────────────

export interface LinkOpportunity {
  type: "question" | "brand_mention" | "expertise_gap";
  postTitle: string;
  url: string;
  subreddit: string;
  score: number;
  comments: number;
  context: string;
  relevanceScore: number;
}

export function findLinkOpportunities(posts: RedditPost[], brand: string, keywords: string[]): LinkOpportunity[] {
  const brandRe = brand ? new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const kwRe = keywords.length ? new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : null;
  const opps: LinkOpportunity[] = [];

  for (const post of posts) {
    const full = `${post.title} ${post.selftext}`;
    const hasBrand = brandRe ? brandRe.test(full) : false;
    const hasKw = kwRe ? kwRe.test(full) : false;
    const isQ = post.title.includes("?") || /^(how|what|why|where|which|best|recommend|looking for|anyone know|comment|quel|quelle|pourquoi|est-ce|faut-il|cherche)/i.test(post.title);

    if (!hasBrand && !hasKw && !isQ) continue;

    let type: LinkOpportunity["type"] = "expertise_gap";
    if (hasBrand) type = "brand_mention";
    else if (isQ && hasKw) type = "question";

    let rel = 0;
    if (hasBrand) rel += 4;
    if (hasKw) rel += 2;
    if (isQ) rel += 2;
    rel += Math.min(post.numComments / 5, 2);

    opps.push({ type, postTitle: post.title, url: post.permalink, subreddit: post.subreddit, score: post.score, comments: post.numComments, context: post.selftext.slice(0, 200) || post.title, relevanceScore: rel });
  }

  return opps.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);
}
