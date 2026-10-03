import { db } from "../db/client.js";
import { getGame, validateEntry, type EntryData } from "../shared/games/index.js";
import { publish } from "./changeFeed.js";
import { scoutKey } from "./session.js";
import { getEvent } from "./settings.js";

export interface PitRecord {
  id: string;
  eventKey: string;
  teamNumber: number;
  scout: string;
  scoutKey: string;
  data: EntryData;
  status: "draft" | "submitted" | "void";
  revision: number;
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

interface Row {
  id: string;
  event_key: string;
  team_number: number;
  scout: string;
  scout_key: string;
  data_json: string;
  status: "draft" | "submitted" | "void";
  revision: number;
  started_at: string;
  updated_at: string;
  submitted_at: string | null;
}

function toPit(row: Row): PitRecord {
  return {
    id: row.id,
    eventKey: row.event_key,
    teamNumber: row.team_number,
    scout: row.scout,
    scoutKey: row.scout_key,
    data: JSON.parse(row.data_json) as EntryData,
    status: row.status,
    revision: row.revision,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

export function getPit(id: string): PitRecord | null {
  const row = db.prepare(`SELECT * FROM pit_entries WHERE id = ?`).get(id) as Row | undefined;
  return row ? toPit(row) : null;
}

export function listPit(eventKey: string): PitRecord[] {
  return (db.prepare(`SELECT * FROM pit_entries WHERE event_key = ? ORDER BY updated_at DESC`).all(eventKey) as Row[]).map(toPit);
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PitSaveResult = { ok: true; entry: PitRecord } | { ok: false; status: number; error: string; details?: string[] };

export function savePit(input: { id: string; eventKey: string; teamNumber: number; scout: string; data: unknown; status: "draft" | "submitted" }): PitSaveResult {
  if (!ID.test(input.id)) return { ok: false, status: 400, error: "invalid_id" };
  const event = getEvent(input.eventKey);
  if (!event) return { ok: false, status: 404, error: "event_not_found" };
  const atEvent = db.prepare(`SELECT 1 FROM event_teams WHERE event_key = ? AND team_number = ?`).get(input.eventKey, input.teamNumber);
  if (!atEvent) return { ok: false, status: 400, error: "team_not_at_event" };

  const game = getGame(event.gameId);
  const { data, errors } = validateEntry(game.pitForm, input.data, { complete: input.status === "submitted" });
  if (errors.length) return { ok: false, status: 400, error: "invalid_entry", details: errors };

  const key = scoutKey(input.scout);
  const now = new Date().toISOString();
  const byId = db.prepare(`SELECT * FROM pit_entries WHERE id = ?`).get(input.id) as Row | undefined;
  const bySlot = db.prepare(`SELECT * FROM pit_entries WHERE event_key = ? AND team_number = ? AND scout_key = ?`).get(input.eventKey, input.teamNumber, key) as Row | undefined;
  const current = byId ?? bySlot;
  if (byId && (byId.scout_key !== key || byId.team_number !== input.teamNumber)) return { ok: false, status: 403, error: "not_your_entry" };
  const status = current?.status === "submitted" && input.status === "draft" ? "submitted" : input.status;

  if (current) {
    db.prepare(
      `UPDATE pit_entries SET data_json = ?, status = ?, revision = revision + 1, updated_at = ?,
         submitted_at = CASE WHEN ? = 'submitted' THEN COALESCE(submitted_at, ?) ELSE submitted_at END
       WHERE id = ?`
    ).run(JSON.stringify(data), status, now, status, now, current.id);
  } else {
    db.prepare(
      `INSERT INTO pit_entries (id, event_key, team_number, scout, scout_key, game_id, data_json, status, started_at, updated_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(input.id, input.eventKey, input.teamNumber, input.scout, key, game.id, JSON.stringify(data), status, now, now, status === "submitted" ? now : null);
  }
  const entry = getPit(current?.id ?? input.id)!;
  publish({ eventKey: input.eventKey, entity: "pit", key: input.teamNumber, audience: ["scout"] });
  if (entry.status === "submitted") publish({ eventKey: input.eventKey, entity: "compiled", key: input.teamNumber, audience: ["strategy", "manage"] });
  return { ok: true, entry };
}

// One answer sheet per team: when several scouts visited the pit, the most
// recent answer to each question wins.
export function mergedPit(entries: PitRecord[]): EntryData | null {
  const submitted = entries.filter((e) => e.status === "submitted").sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (submitted.length === 0) return null;
  const merged: EntryData = {};
  for (const entry of submitted) {
    for (const [key, value] of Object.entries(entry.data)) {
      if (value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) merged[key] = value;
    }
  }
  return merged;
}
