import { parseCsv } from "./csv.js";
import { verifyPassword } from "./passwords.js";

// =============================================================================
// Google Sheet auth roster
// -----------------------------------------------------------------------------
// The team manages logins in a Google Sheet (columns: name, username, password,
// role, active). The server fetches it as CSV — same pattern as scoutSheet.ts —
// caches it, and /api/login validates against it. Set the env var:
//
//   AUTH_SHEET_ID=<the long id from the sheet's URL>
//
// The sheet must be link-viewable ("Anyone with the link: Viewer") for the CSV
// export URL to work. See docs/AUTH_SHEET_SETUP.md for the 2-minute setup.
//
// SECURITY NOTE (be honest with yourselves about this): passwords in the sheet
// are plaintext and the sheet is link-viewable — the unguessable URL is the only
// thing protecting it. That's acceptable for gating a team scouting tool, NOT
// for anything sensitive. Use throwaway passwords, never reuse real ones.
// =============================================================================

export type Role = "scout" | "analyst";

export interface RosterEntry {
  name: string;
  username: string; // stored lowercase
  password: string;
  role: Role;
  active: boolean;
}

export class AuthSheetMissingError extends Error {
  constructor() {
    super("AUTH_SHEET_ID environment variable is not set");
    this.name = "AuthSheetMissingError";
  }
}

const CACHE_TTL_MS = 60_000; // re-fetch the sheet at most once a minute
let cache: { roster: RosterEntry[]; fetchedAt: number } | null = null;

export function isAuthSheetConfigured(): boolean {
  return Boolean(process.env.AUTH_SHEET_ID || process.env.AUTH_SHEET_URL);
}

function sheetUrl(): string {
  if (process.env.AUTH_SHEET_URL) return process.env.AUTH_SHEET_URL;
  const id = process.env.AUTH_SHEET_ID;
  if (!id) throw new AuthSheetMissingError();
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
}

function parseRole(raw: string): Role | null {
  const v = raw.trim().toLowerCase();
  if (v === "scout" || v === "analyst") return v;
  return null;
}

function parseActive(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  // blank counts as active so a row works without filling the column
  return v === "" || v === "yes" || v === "y" || v === "true" || v === "1" || v === "active";
}

function parseRoster(csvText: string): RosterEntry[] {
  const rows = parseCsv(csvText);
  const out: RosterEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [name, username, password, role, active] = [0, 1, 2, 3, 4].map((c) => (row[c] ?? "").trim());
    // skip the header row and any incomplete row
    if (i === 0 && username.toLowerCase() === "username") continue;
    if (!username || !password) continue;
    const parsedRole = parseRole(role);
    if (!parsedRole) continue; // a row with a bad/missing role grants nothing
    out.push({
      name: name || username,
      username: username.toLowerCase(),
      password,
      role: parsedRole,
      active: parseActive(active),
    });
  }
  return out;
}

export async function loadRoster(force = false): Promise<RosterEntry[]> {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.roster;
  try {
    const res = await fetch(sheetUrl(), { redirect: "follow" });
    if (!res.ok) throw new Error(`auth sheet fetch -> ${res.status} ${res.statusText}`);
    const text = await res.text();
    const roster = parseRoster(text);
    cache = { roster, fetchedAt: now };
    return roster;
  } catch (err) {
    if (err instanceof AuthSheetMissingError) throw err;
    // network hiccup: fall back to the last good roster so logins keep working
    if (cache) return cache.roster;
    throw err;
  }
}

export interface LoginResult {
  name: string;
  role: Role;
}

// Returns the user on success, null on bad credentials/inactive user.
// The password cell may hold an scrypt hash (preferred) or legacy plaintext.
export async function checkLogin(username: string, password: string): Promise<LoginResult | null> {
  const roster = await loadRoster();
  const u = username.trim().toLowerCase();
  const entry = roster.find((r) => r.username === u);
  if (!entry || !entry.active) return null;
  const ok = await verifyPassword(password, entry.password);
  if (!ok) return null;
  return { name: entry.name, role: entry.role };
}
