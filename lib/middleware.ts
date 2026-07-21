import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Rate limiting global sur les routes API coûteuses (appels LLM / APIs tierces
 * facturées). Les quotas sont volontairement généreux pour un usage humain
 * normal mais coupent le bruteforce / scraping automatisé.
 */

const WINDOW_MS = 60_000; // 1 minute

// Quota par minute et par IP, selon le coût de la route.
const LIMITS: { pattern: RegExp; limit: number }[] = [
  { pattern: /^\/api\/assistant/, limit: 15 },
  { pattern: /^\/api\/analyze/, limit: 10 },
  { pattern: /^\/api\/keywords/, limit: 10 },
  { pattern: /^\/api\/generate-tags/, limit: 20 },
  { pattern: /^\/api\/lead/, limit: 5 },
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = LIMITS.find(r => r.pattern.test(path));
  if (!rule) return NextResponse.next();

  const ip = clientIp(req);
  const result = rateLimit(`${ip}:${rule.pattern.source}`, rule.limit, WINDOW_MS);

  const headers = new Headers({
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  });

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    headers.set("Retry-After", String(retryAfter));
    return NextResponse.json(
      { error: `Trop de requêtes. Réessayez dans ${retryAfter}s.` },
      { status: 429, headers }
    );
  }

  const res = NextResponse.next();
  headers.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: ["/api/assistant/:path*", "/api/analyze/:path*", "/api/keywords/:path*", "/api/generate-tags/:path*", "/api/lead/:path*"],
};
