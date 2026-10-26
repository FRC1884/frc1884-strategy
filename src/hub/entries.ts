import { db } from "../db/client.js";
import { getGame, validateEntry, type EntryData } from "../shared/games/index.js";
import { recordActivity } from "./activity.js";
import { recompileTeam } from "./aggregate.js";
import { lockSlot } from "./assign.js";
import { publish } from "./changeFeed.js";
import { scoutKey } from "./session.js";
import { getEvent } from "./settings.js";

export interface EntryRecord {
  id: string;
  eventKey: string;
  matchKey: string;
  teamNumber: number;
  scout: string;
  scoutKey: string;
  gameId: string;
  data: EntryData;
  status: "draft" | "submitted" | "void";
  revision: number;
  startedAt: string;
  updatedAt: string;
  submittedAt: string | null;
  editedBy: string | null;
}

interface Row {
  id: string;
  event_key: string;
  match_key: string;
  team_number: number;
  scout: string;
  scout_key: string;
  game_id: string;
  data_json: string;
  status: "draft" | "submitted" | "void";
  revision: number;
  started_at: string;
  updated_at: string;
  submitted_at: string | null;
  edited_by: string | null;
}

export function toEntry(row: Row): EntryRecord {
  return {
    id: row.id,
    eventKey: row.event_key,
    matchKey: row.match_key,
    teamNumber: row.team_number,
    scout: row.scout,
    scoutKey: row.scout_key,
    gameId: row.game_id,
    data: JSON.parse(row.data_json) as EntryData,
    status: row.status,
    revision: row.revision,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    editedBy: row.edited_by,
  };
}

export function getEntry(id: string): EntryRecord | null {
  const row = db.prepare(`SELECT * FROM match_scout_entries WHERE id = ?`).get(id) as Row | undefined;
  return row ? toEntry(row) : null;
}

export type SaveResult =
  | { ok: true; entry: EntryRecord; created: boolean }
  | { ok: false; status: number; error: string; details?: string[] };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Saves a scout's entry. The phone chooses the id, so sending the same entry
// twice (a retry after a dropped connection) never creates a duplicate.
export function saveEntry(input: {
  id: string;
  eventKey: string;
  matchKey: string;
  teamNumber: number;
  scout: string;
  data: unknown;
  status: "draft" | "submitted";
  // Set when a manager corrects someone else's entry.
  editedBy?: string;
}): SaveResult {
  if (!ID.test(input.id)) return { ok: false, status: 400, error: "invalid_id" };
  const event = getEvent(input.eventKey);
  if (!event) return { ok: false, status: 404, error: "event_not_found" };
  const game = getGame(event.gameId);

  const inMatch = db
    .prepare(
      `SELECT 1 FROM matches m
       JOIN match_alliances a ON a.match_id = m.id
       JOIN match_alliance_teams t ON t.alliance_id = a.id
       WHERE m.event_key = ? AND m.match_key = ? AND t.team_number = ?`
    )
    .get(input.eventKey, input.matchKey, input.teamNumber);
  if (!inMatch) return { ok: false, status: 400, error: "team_not_in_match" };

  const { data, errors } = validateEntry(game.matchForm, input.data, { complete: input.status === "submitted" });
  if (errors.length) return { ok: false, status: 400, error: "invalid_entry", details: errors };

  const key = scoutKey(input.scout);
  const now = new Date().toISOString();
  const byId = db.prepare(`SELECT * FROM match_scout_entries WHERE id = ?`).get(input.id) as Row | undefined;
  const bySlot = db
    .prepare(`SELECT * FROM match_scout_entries WHERE match_key = ? AND team_number = ? AND scout_key = ?`)
    .get(input.matchKey, input.teamNumber, key) as Row | undefined;
  // The same scout starting the same robot on a second device continues the first entry.
  const current = byId ?? bySlot;

  if (byId && (byId.match_key !== input.matchKey || byId.team_number !== input.teamNumber)) {
    return { ok: false, status: 409, error: "id_in_use" };
  }
  if (byId && byId.scout_key !== key && !input.editedBy) {
    return { ok: false, status: 403, error: "not_your_entry" };
  }
  if (current?.status === "void" && !input.editedBy) {
    return { ok: false, status: 409, error: "entry_voided" };
  }
  // A late autosave must not turn a submitted entry back into a draft.
  const status = current?.status === "submitted" && input.status === "draft" ? "submitted" : input.status;
  const firstSubmit = status === "submitted" && current?.status !== "submitted";

  let created = false;
  if (current) {
    db.prepare(
      `UPDATE match_scout_entries
       SET data_json = ?, status = ?, revision = revision + 1, updated_at = ?,
           submitted_at = CASE WHEN ? = 'submitted' THEN COALESCE(submitted_at, ?) ELSE submitted_at END,
           edited_by = COALESCE(?, edited_by)
       WHERE id = ?`
    ).run(JSON.stringify(data), status, now, status, now, input.editedBy ?? null, current.id);
  } else {
    created = true;
    db.prepare(
      `INSERT INTO match_scout_entries (id, event_key, match_key, team_number, scout, scout_key, game_id, data_json, status, started_at, updated_at, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(input.id, input.eventKey, input.matchKey, input.teamNumber, input.scout, key, game.id, JSON.stringify(data), status, now, now, status === "submitted" ? now : null);
    lockSlot(input.eventKey, input.matchKey, input.teamNumber, key);
    recordActivity({ eventKey: input.eventKey, scout: input.scout, kind: "opened", matchKey: input.matchKey, teamNumber: input.teamNumber, at: now });
  }

  const entry = getEntry(current?.id ?? input.id)!;
  if (firstSubmit) {
    recordActivity({ eventKey: input.eventKey, scout: entry.scout, kind: "submitted", matchKey: input.matchKey, teamNumber: input.teamNumber, at: now });
  } else if (input.editedBy) {
    recordActivity({ eventKey: input.eventKey, scout: input.editedBy, kind: "corrected", matchKey: input.matchKey, teamNumber: input.teamNumber, at: now });
  }
  publish({
    eventKey: input.eventKey,
    entity: "entry",
    key: entry.id,
    op: created ? "opened" : firstSubmit ? "submitted" : "saved",
    audience: ["manage"],
    payload: { matchKey: entry.matchKey, teamNumber: entry.teamNumber, scout: entry.scout, status: entry.status, updatedAt: entry.updatedAt },
  });
  if (entry.status === "submitted") recompileTeam(input.eventKey, input.teamNumber);
  return { ok: true, entry, created };
}

export function voidEntry(id: string, by: string, restore = false): EntryRecord | null {
  const entry = getEntry(id);
  if (!entry) return null;
  const status = restore ? (entry.submittedAt ? "submitted" : "draft") : "void";
  db.prepare(`UPDATE match_scout_entries SET status = ?, revision = revision + 1, updated_at = ?, edited_by = ? WHERE id = ?`).run(status, new Date().toISOString(), by, id);
  recordActivity({ eventKey: entry.eventKey, scout: by, kind: "voided", matchKey: entry.matchKey, teamNumber: entry.teamNumber });
  publish({ eventKey: entry.eventKey, entity: "entry", key: id, op: restore ? "restored" : "voided", audience: ["manage"] });
  recompileTeam(entry.eventKey, entry.teamNumber);
  return getEntry(id);
}

export function entriesForScout(eventKey: string, key: string): EntryRecord[] {
  const rows = db
    .prepare(`SELECT * FROM match_scout_entries WHERE event_key = ? AND scout_key = ? ORDER BY started_at DESC`)
    .all(eventKey, key) as Row[];
  return rows.map(toEntry);
}
