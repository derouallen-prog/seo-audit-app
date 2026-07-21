import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const WINDOW_MS = 60_000;

const LIMITS: { pattern: RegExp; limit: number }[] = [
  { pattern: /^\/api\/assistant/, limit: 15 },
  { pattern: /^\/api\/analyze/, limit: 10 },
  { pattern: /^\/api\/keywords/, limit: 10 },
  { pattern: /^\/api\/generate-tags/, limit: 20 },
  { pattern: /^\/api\/lead/, limit: 5 },
];

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  // Refresh Supabase auth session so it doesn't expire mid-visit
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();

  // Rate limiting on expensive API routes
  const path = req.nextUrl.pathname;
  const rule = LIMITS.find(r => r.pattern.test(path));
  if (rule) {
    const ip = clientIp(req);
    const result = rateLimit(`${ip}:${rule.pattern.source}`, rule.limit, WINDOW_MS);

    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: `Trop de requêtes. Réessayez dans ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
