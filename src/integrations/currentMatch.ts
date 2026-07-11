import { db } from "../db/client.js";

export interface CurrentMatchTeam {
  alliance: "red" | "blue";
  station: number;
  teamNumber: number;
  name: string | null;
}

export interface CurrentMatch {
  matchKey: string;
  matchNumber: number;
  compLevel: string;
  scheduledAt: string | null;
  teams: CurrentMatchTeam[];
}

function teamsForMatchId(matchId: number): CurrentMatchTeam[] {
  const rows = db
    .prepare(
      `SELECT a.alliance_color AS alliance, mat.station, t.team_number, t.name
       FROM match_alliances a
       JOIN match_alliance_teams mat ON mat.alliance_id = a.id
       JOIN teams t ON t.team_number = mat.team_number
       WHERE a.match_id = ?
       ORDER BY a.alliance_color ASC, mat.station ASC`
    )
    .all(matchId) as Array<{ alliance: "red" | "blue"; station: number; team_number: number; name: string | null }>;
  return rows.map((t) => ({ alliance: t.alliance, station: t.station, teamNumber: t.team_number, name: t.name }));
}

// The six teams in a given match, by match_key. Used by the ratings step (which
// must cover every robot) and by the video pipeline's roster.
export function getMatchRoster(matchKey: string): CurrentMatchTeam[] {
  const m = db.prepare(`SELECT id FROM matches WHERE match_key = ?`).get(matchKey) as { id: number } | undefined;
  if (!m) return [];
  return teamsForMatchId(m.id);
}

// A competition runs one match at a time and quals play in order, so the
// "current" match is simply the earliest qual with no score posted yet.
// Read straight from the matches table (populated by the TBA ingest); refresh
// TBA first if you want it live. Returns null when the schedule isn't loaded
// or all quals are scored.
export function getCurrentMatch(eventKey: string): CurrentMatch | null {
  const row = db
    .prepare(
      `SELECT id, match_key, match_number, comp_level, scheduled_at
       FROM matches
       WHERE event_key = ?
         AND comp_level = 'qm'
         AND red_score IS NULL
         AND blue_score IS NULL
       ORDER BY match_number ASC
       LIMIT 1`
    )
    .get(eventKey) as
    | { id: number; match_key: string; match_number: number; comp_level: string; scheduled_at: string | null }
    | undefined;

  if (!row) return null;

  return {
    matchKey: row.match_key,
    matchNumber: row.match_number,
    compLevel: row.comp_level,
    scheduledAt: row.scheduled_at,
    teams: teamsForMatchId(row.id),
  };
}
