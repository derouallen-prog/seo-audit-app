import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Garde anti-SSRF. Valide qu'une URL fournie par l'utilisateur est publiquement
 * routable avant qu'on la fetch côté serveur — empêche de viser le loopback,
 * les plages privées, le link-local (métadonnées cloud 169.254.169.254), etc.
 */

export interface SafeUrlResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // loopback
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;// 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT 100.64.0.0/10
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;         // loopback / unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true;                  // link-local
    // IPv4-mapped (::ffff:a.b.c.d)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]!);
    return false;
  }
  return true; // format inconnu → on refuse par prudence
}

/**
 * Valide et normalise une URL utilisateur. Résout le DNS et refuse toute cible
 * qui pointe vers une adresse non-publique. Retourne l'URL normalisée si OK.
 */
export async function assertSafeUrl(rawUrl: string): Promise<SafeUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "URL invalide." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Seuls les protocoles http et https sont autorisés." };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // enlève les crochets IPv6

  // Refus direct si le hostname est déjà une IP privée
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, reason: "Adresse IP non routable publiquement." };
  }

  // Bloque les hostnames locaux évidents
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(hostname)) {
    return { ok: false, reason: "Hôte local non autorisé." };
  }

  // Résout le DNS et vérifie chaque adresse retournée
  if (!net.isIP(hostname)) {
    try {
      const addrs = await lookup(hostname, { all: true });
      if (addrs.length === 0) return { ok: false, reason: "Nom d'hôte non résolu." };
      for (const a of addrs) {
        if (isPrivateIp(a.address)) {
          return { ok: false, reason: "Le nom d'hôte résout vers une adresse non-publique." };
        }
      }
    } catch {
      return { ok: false, reason: "Résolution DNS impossible." };
    }
  }

  return { ok: true, url: parsed.toString() };
}
