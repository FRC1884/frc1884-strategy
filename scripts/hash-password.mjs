#!/usr/bin/env node
// Generate an scrypt hash for the roster sheet's password column.
// Usage: npm run hash-password -- "the-password"
//    or: node scripts/hash-password.mjs "the-password"
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const plain = process.argv[2];
if (!plain || plain.length < 6) {
  console.error('Usage: node scripts/hash-password.mjs "password" (min 6 chars)');
  process.exit(1);
}
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
scrypt(plain, salt, 32, { N, r, p }, (err, key) => {
  if (err) { console.error(err.message); process.exit(1); }
  const stored = `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  // self-verify before printing
  const parts = stored.split("$");
  const s2 = Buffer.from(parts[4], "base64url");
  scrypt(plain, s2, 32, { N, r, p }, (e2, k2) => {
    if (e2 || !timingSafeEqual(k2, key)) { console.error("self-check failed"); process.exit(1); }
    console.log(stored);
  });
});
