import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

// Stored format (all base64url, params embedded so they can be raised later):
//   scrypt$N$r$p$<salt>$<hash>
// Defaults: N=16384, r=8, p=1, 16-byte salt, 32-byte key — the standard
// interactive-login parameters. Verification takes ~50ms, fine for logins.

const N = 16384, R = 8, P = 1, SALT_LEN = 16, KEY_LEN = 32;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(plain, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function isHashed(stored: string): boolean {
  return stored.startsWith("scrypt$");
}

// Verifies against either a scrypt hash or (legacy) a plaintext cell, so the
// sheet can be migrated row by row. Returns false on any malformed hash.
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) {
    // Legacy plaintext row — still accepted, but should be migrated (see docs).
    const a = Buffer.from(plain), b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const n = Number(nStr), r = Number(rStr), p = Number(pStr);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const key = await scrypt(plain, salt, expected.length, { N: n, r, p });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
