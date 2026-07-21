import type { Analysis } from "./types";

/**
 * Cache d'audit en mémoire (TTL court) par URL normalisée.
 *
 * Objectif : éviter de re-taper PSI + Semrush + GSC (lents et facturés) quand
 * la même URL est ré-analysée à quelques minutes d'intervalle. En serverless
 * multi-instances le cache est par instance — bénéfice réel sur les bursts et
 * en instance unique ; pour un cache partagé, brancher Redis/Upstash.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 200;

interface Entry {
  value: Analysis;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function normalizeCacheKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

export function getCachedAnalysis(url: string): Analysis | null {
  const key = normalizeCacheKey(url);
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedAnalysis(url: string, value: Analysis): void {
  const key = normalizeCacheKey(url);
  // Purge la plus ancienne entrée si on dépasse la capacité (éviction FIFO simple)
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}
