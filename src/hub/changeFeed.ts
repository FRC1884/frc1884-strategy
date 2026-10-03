import { db } from "../db/client.js";
import { can, type Permission, type Role } from "../shared/roles.js";

// Every hub write is recorded here and pushed to connected browsers, which is
// how one phone's entry shows up on everyone else's screen. A change says what
// changed, not the full data: clients refetch what they are showing.

export interface Change {
  seq: number;
  eventKey: string | null;
  entity: string;
  key: string;
  op: string;
  audience: Permission[];
  payload: unknown;
  at: string;
}

export interface PublishInput {
  eventKey: string | null;
  entity: string;
  key: string | number;
  op?: string;
  // Who may be told about this change. Anyone holding one of these permissions.
  audience: Permission[];
  payload?: unknown;
}

type Listener = (change: Change) => void;

const listeners = new Set<Listener>();

export function canSee(role: Role, change: Pick<Change, "audience">): boolean {
  return change.audience.some((permission) => can(role, permission));
}

export function publish(input: PublishInput): Change {
  const at = new Date().toISOString();
  const op = input.op ?? "upsert";
  const payloadJson = input.payload === undefined ? null : JSON.stringify(input.payload);
  const result = db
    .prepare(
      `INSERT INTO change_log (event_key, entity, entity_key, op, audience, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(input.eventKey, input.entity, String(input.key), op, input.audience.join(","), payloadJson, at);
  const change: Change = {
    seq: Number(result.lastInsertRowid),
    eventKey: input.eventKey,
    entity: input.entity,
    key: String(input.key),
    op,
    audience: input.audience,
    payload: input.payload ?? null,
    at,
  };
  // Deliver after the current call stack so a surrounding transaction has committed.
  queueMicrotask(() => {
    for (const listener of listeners) {
      try {
        listener(change);
      } catch {
        // A broken connection must not stop delivery to the others.
      }
    }
  });
  return change;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function latestSeq(): number {
  const row = db.prepare(`SELECT MAX(seq) AS seq FROM change_log`).get() as { seq: number | null };
  return row.seq ?? 0;
}

interface ChangeRow {
  seq: number;
  event_key: string | null;
  entity: string;
  entity_key: string;
  op: string;
  audience: string;
  payload_json: string | null;
  created_at: string;
}

// Changes a browser missed while disconnected. Returns null when it missed
// more than `limit`, in which case the browser should reload everything.
export function changesSince(afterSeq: number, eventKey: string, role: Role, limit = 500): Change[] | null {
  const rows = db
    .prepare(
      `SELECT seq, event_key, entity, entity_key, op, audience, payload_json, created_at
       FROM change_log
       WHERE seq > ? AND (event_key = ? OR event_key IS NULL)
       ORDER BY seq ASC
       LIMIT ?`
    )
    .all(afterSeq, eventKey, limit + 1) as ChangeRow[];
  if (rows.length > limit) return null;
  return rows
    .map((row) => ({
      seq: row.seq,
      eventKey: row.event_key,
      entity: row.entity,
      key: row.entity_key,
      op: row.op,
      audience: row.audience.split(",") as Permission[],
      payload: row.payload_json ? JSON.parse(row.payload_json) : null,
      at: row.created_at,
    }))
    .filter((change) => canSee(role, change));
}

// Old changes are only needed for catching up after a short disconnect.
export function pruneChangeLog(keep = 20_000): void {
  db.prepare(`DELETE FROM change_log WHERE seq <= (SELECT MAX(seq) FROM change_log) - ?`).run(keep);
}
