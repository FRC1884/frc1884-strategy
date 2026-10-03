import { db } from "../db/client.js";
import { publish } from "./changeFeed.js";

// Who is online. A person counts as online while at least one of their
// browser tabs holds the live stream open.

const openStreams = new Map<string, number>();

function announce(sid: string): void {
  publish({ eventKey: null, entity: "presence", key: sid, audience: ["manage"] });
}

export function streamOpened(sid: string): void {
  const count = (openStreams.get(sid) ?? 0) + 1;
  openStreams.set(sid, count);
  db.prepare(`UPDATE scout_sessions SET connected = 1, last_seen_at = ? WHERE id = ?`).run(new Date().toISOString(), sid);
  if (count === 1) announce(sid);
}

export function streamClosed(sid: string): void {
  const count = (openStreams.get(sid) ?? 1) - 1;
  if (count > 0) {
    openStreams.set(sid, count);
    return;
  }
  openStreams.delete(sid);
  db.prepare(`UPDATE scout_sessions SET connected = 0, last_seen_at = ? WHERE id = ?`).run(new Date().toISOString(), sid);
  announce(sid);
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
  db.prepare(`UPDATE scout_sessions SET connected = 0 WHERE connected = 1`).run();
}
