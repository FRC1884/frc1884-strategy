import { db } from "../db/client.js";
import { recordActivity } from "./activity.js";
import { publish } from "./changeFeed.js";

// Who is online. A person counts as online while at least one of their
// browser tabs holds the live stream open.

const openStreams = new Map<string, number>();

function announce(sid: string, kind: "online" | "offline"): void {
  const row = db.prepare(`SELECT name FROM scout_sessions WHERE id = ?`).get(sid) as { name: string } | undefined;
  if (row) recordActivity({ scout: row.name, kind });
  publish({ eventKey: null, entity: "presence", key: sid, audience: ["manage"] });
}

// A page reload or a brief loss of signal closes the stream for a moment.
// Wait a little before calling someone offline so the record is not full of
// flicker.
const OFFLINE_DELAY_MS = 8_000;
const pendingOffline = new Map<string, ReturnType<typeof setTimeout>>();

export function streamOpened(sid: string): void {
  const count = (openStreams.get(sid) ?? 0) + 1;
  openStreams.set(sid, count);
  const pending = pendingOffline.get(sid);
  if (pending) {
    clearTimeout(pending);
    pendingOffline.delete(sid);
    touch(sid);
    return;
  }
  db.prepare(`UPDATE scout_sessions SET connected = 1, last_seen_at = ? WHERE id = ?`).run(new Date().toISOString(), sid);
  if (count === 1) announce(sid, "online");
}

export function streamClosed(sid: string): void {
  const count = (openStreams.get(sid) ?? 1) - 1;
  if (count > 0) {
    openStreams.set(sid, count);
    return;
  }
  openStreams.delete(sid);
  const closedAt = new Date().toISOString();
  db.prepare(`UPDATE scout_sessions SET last_seen_at = ? WHERE id = ?`).run(closedAt, sid);
  const timer = setTimeout(() => {
    pendingOffline.delete(sid);
    if (isOnline(sid)) return;
    db.prepare(`UPDATE scout_sessions SET connected = 0 WHERE id = ?`).run(sid);
    announce(sid, "offline");
  }, OFFLINE_DELAY_MS);
  timer.unref();
  pendingOffline.set(sid, timer);
}

export function touch(sid: string): void {
  db.prepare(`UPDATE scout_sessions SET last_seen_at = ? WHERE id = ?`).run(new Date().toISOString(), sid);
}

export function isOnline(sid: string): boolean {
  return (openStreams.get(sid) ?? 0) > 0;
}

// After a restart nobody is connected yet, whatever the table says.
export function resetPresence(): void {
  openStreams.clear();
  for (const timer of pendingOffline.values()) clearTimeout(timer);
  pendingOffline.clear();
  db.prepare(`UPDATE scout_sessions SET connected = 0 WHERE connected = 1`).run();
}
