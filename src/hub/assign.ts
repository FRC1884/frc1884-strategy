import { db } from "../db/client.js";
import { planAssignments, teamPriorities, type Assignment, type PlanMatch, type PlanScout } from "../shared/assign.js";
import { getGame } from "../shared/games/index.js";
import { matchClock, teamsIn } from "../shared/schedule.js";
import { recordActivity } from "./activity.js";
import { publish } from "./changeFeed.js";
import { loadSchedule } from "./schedule.js";
import { getEvent, getSetting } from "./settings.js";

// How many matches ahead scouts are given robots for.
export const HORIZON = 3;
// A phone that goes to sleep drops its connection. Its scout keeps their
// robots for this long before they are handed to someone else.
export const GRACE_MS = 3 * 60_000;

interface SessionRow {
  name: string;
  scout_key: string;
  connected: number;
  on_break: number;
  last_seen_at: string;
  signed_in_at: string;
}

export interface AvailableScout {
  key: string;
  name: string;
  online: boolean;
  signedInAt: string;
}

// Scouts who can be given a robot right now.
export function availableScouts(now: number): AvailableScout[] {
  const rows = db
    .prepare(
      `SELECT name, scout_key, connected, on_break, last_seen_at, signed_in_at
       FROM scout_sessions
       WHERE signed_out_at IS NULL AND scouting = 1
       ORDER BY signed_in_at ASC`
    )
    .all() as SessionRow[];
  const byKey = new Map<string, { scout: AvailableScout; onBreak: boolean; reachable: boolean }>();
  for (const row of rows) {
    const reachable = row.connected === 1 || now - Date.parse(row.last_seen_at) < GRACE_MS;
    const current = byKey.get(row.scout_key);
    if (!current) {
      byKey.set(row.scout_key, {
        scout: { key: row.scout_key, name: row.name, online: row.connected === 1, signedInAt: row.signed_in_at },
        onBreak: row.on_break === 1,
        reachable,
      });
    } else {
      current.scout.online ||= row.connected === 1;
      current.onBreak ||= row.on_break === 1;
      current.reachable ||= reachable;
      current.scout.name = row.name;
    }
  }
  return [...byKey.values()].filter((s) => s.reachable && !s.onBreak).map((s) => s.scout);
}

interface AssignmentRow {
  match_key: string;
  alliance: "red" | "blue";
  station: number;
  team_number: number;
  scout: string | null;
  scout_key: string | null;
  source: "auto" | "manager";
  locked: number;
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    matchKey: row.match_key,
    alliance: row.alliance,
    station: row.station,
    teamNumber: row.team_number,
    scout: row.scout,
    scoutKey: row.scout_key,
    source: row.source,
    locked: row.locked === 1,
  };
}

export function loadAssignments(eventKey: string, matchKeys?: string[]): Assignment[] {
  if (matchKeys && matchKeys.length === 0) return [];
  const filter = matchKeys ? `AND match_key IN (${matchKeys.map(() => "?").join(",")})` : "";
  const rows = db
    .prepare(
      `SELECT match_key, alliance, station, team_number, scout, scout_key, source, locked
       FROM scout_assignments WHERE event_key = ? ${filter}
       ORDER BY match_key, alliance DESC, station`
    )
    .all(eventKey, ...(matchKeys ?? [])) as AssignmentRow[];
  return rows.map(toAssignment);
}

// Brings assignments up to date with the schedule, the clock and who is here.
// Safe to call as often as needed; it only writes when something changes.
export function reassign(eventKey: string, now = Date.now()): boolean {
  const event = getEvent(eventKey);
  if (!event) return false;
  const game = getGame(event.gameId);
  const schedule = loadSchedule(eventKey);
  const clock = matchClock(schedule, now, game.matchSeconds);
  const horizon = clock.upcoming.slice(0, HORIZON);
  if (horizon.length === 0) return false;

  const matches: PlanMatch[] = horizon.map((match) => {
    const start = clock.startsAt[match.matchKey];
    return {
      matchKey: match.matchKey,
      started: start !== null && start !== undefined && start <= now,
      slots: teamsIn(match).map((team) => ({ matchKey: match.matchKey, alliance: team.alliance, station: team.station, teamNumber: team.teamNumber })),
    };
  });
  const horizonKeys = matches.map((m) => m.matchKey);
  const existing = loadAssignments(eventKey, horizonKeys);

  const scouts = availableScouts(now);
  const history = db
    .prepare(
      `SELECT scout_key, team_number, COUNT(*) AS n
       FROM scout_assignments
       WHERE event_key = ? AND scout_key IS NOT NULL AND match_key NOT IN (${horizonKeys.map(() => "?").join(",")})
       GROUP BY scout_key, team_number`
    )
    .all(eventKey, ...horizonKeys) as Array<{ scout_key: string; team_number: number; n: number }>;
  const planScouts: PlanScout[] = scouts.map((scout) => {
    const mine = history.filter((h) => h.scout_key === scout.key);
    return {
      key: scout.key,
      name: scout.name,
      load: mine.reduce((sum, h) => sum + h.n, 0),
      teamsSeen: Object.fromEntries(mine.map((h) => [h.team_number, h.n])),
    };
  });

  const entryCounts = Object.fromEntries(
    (
      db
        .prepare(`SELECT team_number, COUNT(DISTINCT match_key) AS n FROM match_scout_entries WHERE event_key = ? AND status = 'submitted' GROUP BY team_number`)
        .all(eventKey) as Array<{ team_number: number; n: number }>
    ).map((r) => [r.team_number, r.n])
  );
  const priority = teamPriorities({
    ourTeam: Number(getSetting("team_number") ?? 1884),
    upcoming: clock.upcoming.slice(0, 12).map((m) => teamsIn(m).map((t) => t.teamNumber)),
    entryCounts,
  });

  const plan = planAssignments({ matches, existing, scouts: planScouts, priority });

  const before = new Map(existing.map((a) => [`${a.matchKey}|${a.alliance}|${a.station}`, a]));
  const startedKeys = new Set(matches.filter((m) => m.started).map((m) => m.matchKey));
  const stamp = new Date(now).toISOString();
  let changed = false;

  db.transaction(() => {
    const upsert = db.prepare(
      `INSERT INTO scout_assignments (event_key, match_key, alliance, station, team_number, scout, scout_key, source, locked, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(match_key, alliance, station) DO UPDATE SET
         team_number = excluded.team_number, scout = excluded.scout, scout_key = excluded.scout_key,
         source = excluded.source, locked = excluded.locked, assigned_at = excluded.assigned_at`
    );
    for (const next of plan) {
      const previous = before.get(`${next.matchKey}|${next.alliance}|${next.station}`);
      // Once a match starts every filled slot is locked in.
      const locked = next.locked || (startedKeys.has(next.matchKey) && next.scoutKey !== null);
      const same =
        previous &&
        previous.teamNumber === next.teamNumber &&
        previous.scoutKey === next.scoutKey &&
        previous.source === next.source &&
        previous.locked === locked;
      if (same) continue;
      changed = true;
      upsert.run(eventKey, next.matchKey, next.alliance, next.station, next.teamNumber, next.scout, next.scoutKey, next.source, locked ? 1 : 0, stamp);
      if (previous?.scoutKey !== next.scoutKey) {
        if (previous?.scout && previous.scoutKey) {
          recordActivity({ eventKey, scout: previous.scout, kind: "unassigned", matchKey: next.matchKey, teamNumber: previous.teamNumber, at: stamp });
        }
        if (next.scout && next.scoutKey) {
          recordActivity({ eventKey, scout: next.scout, kind: "assigned", matchKey: next.matchKey, teamNumber: next.teamNumber, at: stamp });
        }
      }
    }
  })();

  if (changed) publish({ eventKey, entity: "assignment", key: eventKey, audience: ["scout"] });
  return changed;
}

// A scout opening the form claims the slot: nobody else is moved onto it.
export function lockSlot(eventKey: string, matchKey: string, teamNumber: number, key: string): void {
  db.prepare(
    `UPDATE scout_assignments SET locked = 1 WHERE event_key = ? AND match_key = ? AND team_number = ? AND scout_key = ?`
  ).run(eventKey, matchKey, teamNumber, key);
}

// A manager putting a named scout on a robot (or clearing it).
export function setManualAssignment(
  eventKey: string,
  slot: { matchKey: string; alliance: "red" | "blue"; station: number; teamNumber: number },
  scout: { key: string; name: string } | null
): void {
  const stamp = new Date().toISOString();
  db.transaction(() => {
    if (scout) {
      // A scout watches one robot per match: free whatever else they held.
      db.prepare(
        `UPDATE scout_assignments SET scout = NULL, scout_key = NULL, source = 'auto', locked = 0
         WHERE match_key = ? AND scout_key = ? AND NOT (alliance = ? AND station = ?)`
      ).run(slot.matchKey, scout.key, slot.alliance, slot.station);
    }
    db.prepare(
      `INSERT INTO scout_assignments (event_key, match_key, alliance, station, team_number, scout, scout_key, source, locked, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manager', ?, ?)
       ON CONFLICT(match_key, alliance, station) DO UPDATE SET
         team_number = excluded.team_number, scout = excluded.scout, scout_key = excluded.scout_key,
         source = 'manager', locked = excluded.locked, assigned_at = excluded.assigned_at`
    ).run(eventKey, slot.matchKey, slot.alliance, slot.station, slot.teamNumber, scout?.name ?? null, scout?.key ?? null, scout ? 1 : 0, stamp);
    if (scout) recordActivity({ eventKey, scout: scout.name, kind: "assigned", matchKey: slot.matchKey, teamNumber: slot.teamNumber, at: stamp });
  })();
  publish({ eventKey, entity: "assignment", key: eventKey, audience: ["scout"] });
}

// Time moving on changes which match is next even when nobody does anything.
export function startAssignmentTicker(getActiveEventKey: () => string | null, log: (message: string) => void): () => void {
  const timer = setInterval(() => {
    try {
      const eventKey = getActiveEventKey();
      if (eventKey) reassign(eventKey);
    } catch (error) {
      log(`assignment tick failed: ${String(error)}`);
    }
  }, 20_000);
  timer.unref();
  return () => clearInterval(timer);
}
