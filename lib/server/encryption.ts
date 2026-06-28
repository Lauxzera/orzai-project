import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Derives a 32-byte AES key from ENCRYPTION_SECRET.
 *
 * Strategy: SHA-256 hash of the raw secret bytes.
 * This works correctly regardless of whether the secret is plain text,
 * base64, or any other encoding — the hash always produces exactly 32 bytes.
 */
function getKey(): Buffer {
  const secret = (process.env.ENCRYPTION_SECRET || "").trim();
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET não configurado. Defina esta variável de ambiente antes de usar criptografia.");
  }
  // SHA-256 of the secret → always 32 bytes, independent of secret format
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: iv.ciphertext.authTag (all hex-encoded).
 */
export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit auth tag
  return `${iv.toString("hex")}.${encrypted.toString("hex")}.${tag.toString("hex")}`;
}

/**
 * Decrypts a token previously encrypted with encryptToken().
 * Throws if the data is tampered with (GCM auth tag mismatch).
 */
export function decryptToken(encryptedValue: string): string {
  const parts = encryptedValue.split(".");
  if (parts.length !== 3) {
    throw new Error("Formato de token criptografado inválido.");
  }
  const [ivHex, dataHex, tagHex] = parts;
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
