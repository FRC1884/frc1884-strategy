import { db } from "../db/client.js";
import { matchLabel, sortSchedule, type ScheduleMatch } from "../shared/schedule.js";

interface Row {
  match_key: string;
  comp_level: string;
  set_number: number | null;
  match_number: number;
  planned_at: string | null;
  predicted_at: string | null;
  actual_at: string | null;
  scheduled_at: string | null;
  red_score: number | null;
  blue_score: number | null;
  marked_played: number;
  source: string;
  alliance_color: "red" | "blue" | null;
  station: number | null;
  team_number: number | null;
  team_name: string | null;
}

// Every match of an event with its six teams, in playing order.
export function loadSchedule(eventKey: string): ScheduleMatch[] {
  const rows = db
    .prepare(
      `SELECT m.match_key, m.comp_level, m.set_number, m.match_number,
              m.planned_at, m.predicted_at, m.actual_at, m.scheduled_at,
              m.red_score, m.blue_score, m.marked_played, m.source,
              a.alliance_color, mat.station, t.team_number, t.name AS team_name
       FROM matches m
       LEFT JOIN match_alliances a ON a.match_id = m.id
       LEFT JOIN match_alliance_teams mat ON mat.alliance_id = a.id
       LEFT JOIN teams t ON t.team_number = mat.team_number
       WHERE m.event_key = ?
       ORDER BY m.id ASC, a.alliance_color ASC, mat.station ASC`
    )
    .all(eventKey) as Row[];

  const byKey = new Map<string, ScheduleMatch>();
  for (const row of rows) {
    let match = byKey.get(row.match_key);
    if (!match) {
      match = {
        matchKey: row.match_key,
        compLevel: row.comp_level,
        setNumber: row.set_number,
        matchNumber: row.match_number,
        label: matchLabel(row.comp_level, row.set_number, row.match_number),
        plannedAt: row.planned_at ?? row.scheduled_at,
        predictedAt: row.predicted_at,
        actualAt: row.actual_at,
        redScore: row.red_score,
        blueScore: row.blue_score,
        markedPlayed: row.marked_played === 1,
        source: row.source,
        red: [],
        blue: [],
      };
      byKey.set(row.match_key, match);
    }
    if (row.alliance_color && row.team_number !== null && row.station !== null) {
      match[row.alliance_color].push({ station: row.station, teamNumber: row.team_number, name: row.team_name });
    }
  }
  return sortSchedule([...byKey.values()]);
}

export function getScheduleMatch(eventKey: string, matchKey: string): ScheduleMatch | null {
  return loadSchedule(eventKey).find((m) => m.matchKey === matchKey) ?? null;
}

export interface ManualMatchInput {
  compLevel: "pm" | "qm";
  matchNumber: number;
  plannedAt: string | null;
  red: number[];
  blue: number[];
}

// A match typed in by hand, for when The Blue Alliance has not published the
// schedule yet. An import of the same match later replaces it.
export function saveManualMatch(eventKey: string, input: ManualMatchInput): string {
  const matchKey = `${eventKey}_${input.compLevel}${input.matchNumber}`;
  db.transaction(() => {
    db.prepare(
      `INSERT INTO matches (match_key, event_key, comp_level, match_number, scheduled_at, planned_at, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', CURRENT_TIMESTAMP)
       ON CONFLICT(match_key) DO UPDATE SET
         scheduled_at = excluded.scheduled_at,
         planned_at = excluded.planned_at,
         updated_at = CURRENT_TIMESTAMP`
    ).run(matchKey, eventKey, input.compLevel, input.matchNumber, input.plannedAt, input.plannedAt);
    const match = db.prepare(`SELECT id FROM matches WHERE match_key = ?`).get(matchKey) as { id: number };
    for (const [color, teams] of [["red", input.red], ["blue", input.blue]] as const) {
      db.prepare(
        `INSERT INTO match_alliances (match_id, alliance_color) VALUES (?, ?)
         ON CONFLICT(match_id, alliance_color) DO NOTHING`
      ).run(match.id, color);
      const alliance = db
        .prepare(`SELECT id FROM match_alliances WHERE match_id = ? AND alliance_color = ?`)
        .get(match.id, color) as { id: number };
      db.prepare(`DELETE FROM match_alliance_teams WHERE alliance_id = ?`).run(alliance.id);
      teams.forEach((teamNumber, index) => {
        db.prepare(`INSERT OR IGNORE INTO teams (team_number, name, source) VALUES (?, ?, 'manual')`).run(teamNumber, `Team ${teamNumber}`);
        db.prepare(`INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)`).run(eventKey, teamNumber);
        db.prepare(`INSERT INTO match_alliance_teams (alliance_id, team_number, station) VALUES (?, ?, ?)`).run(alliance.id, teamNumber, index + 1);
      });
    }
  })();
  return matchKey;
}

export function deleteManualMatch(eventKey: string, matchKey: string): boolean {
  const result = db
    .prepare(`DELETE FROM matches WHERE event_key = ? AND match_key = ? AND source = 'manual'`)
    .run(eventKey, matchKey);
  return result.changes > 0;
}

export function setMarkedPlayed(eventKey: string, matchKey: string, played: boolean): boolean {
  const result = db
    .prepare(`UPDATE matches SET marked_played = ?, updated_at = CURRENT_TIMESTAMP WHERE event_key = ? AND match_key = ?`)
    .run(played ? 1 : 0, eventKey, matchKey);
  return result.changes > 0;
}

export interface EventTeam {
  teamNumber: number;
  name: string;
  location: string | null;
}

export function loadTeams(eventKey: string): EventTeam[] {
  const rows = db
    .prepare(
      `SELECT t.team_number, t.name, t.location
       FROM event_teams et JOIN teams t ON t.team_number = et.team_number
       WHERE et.event_key = ?
       ORDER BY t.team_number ASC`
    )
    .all(eventKey) as Array<{ team_number: number; name: string; location: string | null }>;
  return rows.map((r) => ({ teamNumber: r.team_number, name: r.name, location: r.location }));
}
