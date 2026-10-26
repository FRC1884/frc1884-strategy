import { db } from "../db/client.js";
import { DEFAULT_GAME_ID, getGame } from "../shared/games/index.js";

export function getSetting(key: string): string | null {
  const row = db.prepare(`SELECT value FROM hub_settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO hub_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, value);
}

export interface ActiveEvent {
  eventKey: string;
  name: string;
  season: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  gameId: string;
}

interface EventRow {
  event_key: string;
  name: string;
  season: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  game_id: string | null;
}

function toActiveEvent(row: EventRow): ActiveEvent {
  return {
    eventKey: row.event_key,
    name: row.name,
    season: row.season,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    gameId: getGame(row.game_id ?? DEFAULT_GAME_ID).id,
  };
}

const EVENT_COLUMNS = `event_key, name, season, location, start_date, end_date, game_id`;

export function getEvent(eventKey: string): ActiveEvent | null {
  const row = db.prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE event_key = ?`).get(eventKey) as EventRow | undefined;
  return row ? toActiveEvent(row) : null;
}

// The event everyone is working on. A lead picks it in Admin; until then the
// most recent event in the database is used.
export function getActiveEvent(): ActiveEvent | null {
  const chosen = getSetting("active_event_key");
  if (chosen) {
    const event = getEvent(chosen);
    if (event) return event;
  }
  const row = db
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events ORDER BY COALESCE(start_date, '') DESC, id DESC LIMIT 1`)
    .get() as EventRow | undefined;
  return row ? toActiveEvent(row) : null;
}
