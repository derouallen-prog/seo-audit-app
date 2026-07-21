import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const SEPARATOR = ".";

function getKey(): Buffer {
  const raw = process.env.GSC_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("GSC_TOKEN_ENCRYPTION_KEY manquante");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("GSC_TOKEN_ENCRYPTION_KEY doit être 32 octets en base64");
  return buf;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(SEPARATOR);
}

export function decryptToken(ciphertext: string): string {
  // Si la valeur ne contient pas le séparateur, c'est un token en clair (migration douce)
  if (!ciphertext.includes(SEPARATOR)) return ciphertext;

  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) throw new Error("Format de token chiffré invalide");
  const [ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64!, "base64");
  const authTag = Buffer.from(tagB64!, "base64");
  const data = Buffer.from(dataB64!, "base64");
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final("utf8");
}
