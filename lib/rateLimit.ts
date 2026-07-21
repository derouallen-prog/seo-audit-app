/**
 * Rate limiter en mémoire (fenêtre glissante par IP + clé de route).
 *
 * Limite : mitige les abus et protège les budgets API (Claude, Semrush,
 * FetchSERP). En serverless multi-instances, le compteur est par instance —
 * c'est une première ligne de défense, pas une garantie globale. Pour un
 * plafond strict multi-instances, brancher un store partagé (Upstash/Redis).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Purge paresseuse des buckets expirés pour éviter une fuite mémoire.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of store) {
    if (b.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = store.get(identifier);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, limit };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt, limit };
}

/** Extrait une IP client exploitable derrière un proxy (Vercel). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
