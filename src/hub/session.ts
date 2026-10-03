import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

import { db } from "../db/client.js";
import { can, isRole, type Permission, type Role } from "../shared/roles.js";

// Sign-in is a shared code plus the person's name. The code decides the role.
// The session is a signed cookie; the session row records who is signed in.

export const SESSION_COOKIE = "hub_session";
const SESSION_DAYS = 7;

const CODE_ENV: Record<Role, string> = {
  scout: "SCOUT_CODE",
  manager: "MANAGER_CODE",
  strategist: "STRATEGIST_CODE",
  lead: "LEAD_CODE",
};

export interface HubUser {
  sid: string;
  name: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    hubUser?: HubUser;
  }
}

let generatedSecret: string | null = null;

function secret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  // No secret configured: sessions still work but end when the server restarts.
  generatedSecret ??= crypto.randomBytes(32).toString("hex");
  return generatedSecret;
}

export function configuredRoles(): Role[] {
  return (Object.keys(CODE_ENV) as Role[]).filter((role) => (process.env[CODE_ENV[role]] ?? "").trim().length > 0);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Which role a code unlocks. Checked from most to least privileged so a code
// reused by mistake never grants less than intended.
export function roleForCode(code: string): Role | null {
  const entered = code.trim();
  if (!entered) return null;
  let match: Role | null = null;
  for (const role of ["lead", "strategist", "manager", "scout"] as Role[]) {
    const expected = (process.env[CODE_ENV[role]] ?? "").trim();
    if (expected && safeEqual(entered, expected) && !match) match = role;
  }
  return match;
}

// One person may sign in on two devices, or sign in again later. They are the
// same scout as long as the name matches, whatever the capitals.
export function scoutKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 40) return null;
  return name;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(user: HubUser, issuedAt = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...user, iat: issuedAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): HubUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.sid !== "string" || typeof parsed.name !== "string" || !isRole(parsed.role)) return null;
    if (typeof parsed.iat !== "number" || now - parsed.iat > SESSION_DAYS * 86_400_000) return null;
    return { sid: parsed.sid, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

function readCookie(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

function cookieAttributes(request: FastifyRequest): string {
  const secure = request.protocol === "https" || request.headers["x-forwarded-proto"] === "https";
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, user: HubUser): void {
  const value = encodeURIComponent(encodeSession(user));
  reply.header("set-cookie", `${SESSION_COOKIE}=${value}; Max-Age=${SESSION_DAYS * 86_400}; ${cookieAttributes(request)}`);
}

export function clearSessionCookie(request: FastifyRequest, reply: FastifyReply): void {
  reply.header("set-cookie", `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(request)}`);
}

// The signed cookie proves who the person is; the session row must still be
// open, so signing out (or a lead ending a session) takes effect at once.
export function currentUser(request: FastifyRequest): HubUser | null {
  const user = decodeSession(readCookie(request, SESSION_COOKIE));
  if (!user) return null;
  const row = db
    .prepare(`SELECT signed_out_at FROM scout_sessions WHERE id = ?`)
    .get(user.sid) as { signed_out_at: string | null } | undefined;
  if (!row || row.signed_out_at) return null;
  return user;
}

export function createSession(name: string, role: Role): HubUser {
  const sid = crypto.randomUUID();
  const now = new Date().toISOString();
  // Scouts are given robots to watch. Other roles can opt in from the Scout tab.
  db.prepare(
    `INSERT INTO scout_sessions (id, name, role, signed_in_at, last_seen_at, scouting, scout_key) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sid, name, role, now, now, role === "scout" ? 1 : 0, scoutKey(name));
  return { sid, name, role };
}

export function endSession(sid: string): void {
  db.prepare(`UPDATE scout_sessions SET signed_out_at = ?, connected = 0 WHERE id = ?`).run(new Date().toISOString(), sid);
}

function sameOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

// Route guard. Use as `preHandler: requirePermission("manage")`.
export function requirePermission(permission: Permission) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) {
      return reply.code(403).send({ error: "cross_origin" });
    }
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: "not_signed_in" });
    if (!can(user.role, permission)) return reply.code(403).send({ error: "not_allowed" });
    request.hubUser = user;
  };
}

// Slows down guessing of sign-in codes: a few failed tries per address, then a wait.
const FAILURE_WINDOW_MS = 5 * 60_000;
const FAILURE_LIMIT = 8;
const failures = new Map<string, number[]>();

export function tooManyFailures(address: string, now = Date.now()): boolean {
  const recent = (failures.get(address) ?? []).filter((t) => now - t < FAILURE_WINDOW_MS);
  failures.set(address, recent);
  return recent.length >= FAILURE_LIMIT;
}

export function recordFailure(address: string, now = Date.now()): void {
  const recent = failures.get(address) ?? [];
  recent.push(now);
  failures.set(address, recent);
}

export function resetFailures(): void {
  failures.clear();
}
