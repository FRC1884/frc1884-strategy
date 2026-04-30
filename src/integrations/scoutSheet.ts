import { db } from "../db/client.js";
import { parseCsv } from "./csv.js";

const SCOUT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1HWL3TAa39k_uPIAFoDrSjsNUR554-9mNVzBdgTqsIBE/export?format=csv";

const COL = {
  timestamp: 0,
  email: 1,
  scout_team_name: 2,
  scout_name: 3,
  team_number: 4,
  match_number: 5,
  alliance: 6,
  leaves_alliance_zone: 7,
  inactive_behaviour: 8,
  active_behaviour: 9,
  ferry_style: 10,
  reentry_method: 11,
  scoring_cycles: 12,
  opposing_zone: 13,
  defence_quality: 14,
  can_climb: 15,
  other_notes: 16,
  difficulties: 17,
  climb_level: 18,
  ferrying_cycles: 19
} as const;

function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function parsePositiveInt(raw: string): number | null {
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseNumeric(raw: string): number | null {
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseTimestamp(raw: string, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
}

const NEWTON_PRACTICE_DATE = "2026-04-29";
const HOUSTON_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

// Accepted match-number formats (case-insensitive, surrounding whitespace ok):
//   Practice: "P5", "p5", "P 5", "Practice 5", "practice 5"        -> phase=practice
//   Quals:    "Q5", "q5", "Q 5", "Qual 5", "Quals 5",
//             "Qualification 5", "Qualifications 5"                 -> phase=qm
//   Bare int: "5"  -> phase decided by Houston-local date of timestamp
//             (Wed 2026-04-29 -> practice, otherwise qm). This catches
//             stragglers entering Wed practice rows late on Thu+.
//   Anything else -> null (row skipped).
function parseMatchNumber(
  rawMatch: string,
  rawTimestamp: string
): { phase: "practice" | "qm"; number: number } | null {
  const trimmed = (rawMatch ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const practice = /^p(?:ractice)?\s*(\d+)$/i.exec(trimmed);
  if (practice) {
    const n = Number(practice[1]);
    return Number.isInteger(n) && n > 0 ? { phase: "practice", number: n } : null;
  }
  const quals = /^q(?:ual(?:ification)?s?)?\s*(\d+)$/i.exec(trimmed);
  if (quals) {
    const n = Number(quals[1]);
    return Number.isInteger(n) && n > 0 ? { phase: "qm", number: n } : null;
  }
  const bare = parsePositiveInt(trimmed);
  if (bare === null) {
    return null;
  }
  const ms = Date.parse(rawTimestamp);
  if (Number.isFinite(ms)) {
    const houstonDate = HOUSTON_DATE_FORMATTER.format(new Date(ms));
    if (houstonDate === NEWTON_PRACTICE_DATE) {
      return { phase: "practice", number: bare };
    }
  }
  return { phase: "qm", number: bare };
}

function rowToNotes(row: string[]): string {
  const payload: Record<string, string | number> = {};
  for (const [key, idx] of Object.entries(COL)) {
    const v = cell(row, idx);
    if (v) {
      payload[key] = v;
    }
  }
  return JSON.stringify(payload);
}

export interface ScoutSheetIngestResult {
  eventKey: string;
  fetchedAt: string;
  rowCount: number;
  skippedRowCount: number;
  observationCount: number;
  teamCount: number;
  matchCount: number;
  metricCount: number;
  snapshotCount: number;
}

export async function ingestScoutSheet(eventKey = "2026new"): Promise<ScoutSheetIngestResult> {
  const response = await fetch(SCOUT_SHEET_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Scout sheet fetch failed: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const fetchedAt = new Date().toISOString();
  const rows = parseCsv(csvText);

  const dataRows = rows.filter(
    (r) =>
      parsePositiveInt(cell(r, COL.team_number)) !== null &&
      parseMatchNumber(cell(r, COL.match_number), cell(r, COL.timestamp)) !== null
  );
  const totalNonHeaderRows = Math.max(0, rows.length - 1);
  const skippedRowCount = Math.max(0, totalNonHeaderRows - dataRows.length);

  let observationCount = 0;
  let metricCount = 0;
  let snapshotCount = 0;
  const teamSet = new Set<number>();
  const matchSet = new Set<string>();

  type AggBucket = {
    obsCount: number;
    scoringCycles: number[];
    ferryingCycles: number[];
    climbAttempts: number;
    climbSuccesses: number;
  };
  const perTeam = new Map<number, AggBucket>();

  function bucket(team: number): AggBucket {
    let b = perTeam.get(team);
    if (!b) {
      b = { obsCount: 0, scoringCycles: [], ferryingCycles: [], climbAttempts: 0, climbSuccesses: 0 };
      perTeam.set(team, b);
    }
    return b;
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, source)
      VALUES (?, 'Newton Division', 2026, 'Houston, TX, USA', 'pre-scouting')
      ON CONFLICT(event_key) DO NOTHING
    `).run(eventKey);

    db.prepare(`
      INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
      VALUES ('scout-sheet', 'csv_dump', ?, ?, ?)
    `).run(eventKey, JSON.stringify({ csv: csvText, byteLength: csvText.length }), fetchedAt);
    snapshotCount += 1;

    db.prepare(`
      DELETE FROM match_observations
      WHERE source = 'scout-sheet'
        AND match_id IN (SELECT id FROM matches WHERE event_key = ?)
    `).run(eventKey);

    db.prepare(`
      DELETE FROM analytics_metrics WHERE event_key = ? AND metric_name LIKE 'scout.%'
    `).run(eventKey);

    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (team_number, name, source)
      VALUES (?, ?, 'scout-sheet')
    `);
    const insertEventTeam = db.prepare(`
      INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)
    `);
    const insertStubMatch = db.prepare(`
      INSERT OR IGNORE INTO matches (match_key, event_key, comp_level, match_number, source)
      VALUES (?, ?, ?, ?, 'scout-pending')
    `);
    const selectMatchId = db.prepare(`SELECT id FROM matches WHERE match_key = ?`);
    const insertObservation = db.prepare(`
      INSERT INTO match_observations (match_id, team_number, phase, scouter, fuel_scored, climb_points, notes, source, observed_at)
      VALUES (?, ?, 'teleop', ?, ?, NULL, ?, 'scout-sheet', ?)
    `);
    const insertMetric = db.prepare(`
      INSERT OR IGNORE INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const row of dataRows) {
      const teamNumber = parsePositiveInt(cell(row, COL.team_number)) as number;
      const parsedMatch = parseMatchNumber(cell(row, COL.match_number), cell(row, COL.timestamp)) as {
        phase: "practice" | "qm";
        number: number;
      };
      const matchNumber = parsedMatch.number;
      const compLevel = parsedMatch.phase === "practice" ? "pm" : "qm";
      const matchKey = `${eventKey}_${compLevel}${matchNumber}`;

      insertTeam.run(teamNumber, `Team ${teamNumber}`);
      insertEventTeam.run(eventKey, teamNumber);
      insertStubMatch.run(matchKey, eventKey, compLevel, matchNumber);

      const matchRow = selectMatchId.get(matchKey) as { id: number } | undefined;
      if (!matchRow) {
        continue;
      }

      const scouter = cell(row, COL.scout_name) || null;
      const scoringCycles = parseNumeric(cell(row, COL.scoring_cycles));
      const ferryingCycles = parseNumeric(cell(row, COL.ferrying_cycles));
      const observedAt = parseTimestamp(cell(row, COL.timestamp), fetchedAt);

      insertObservation.run(
        matchRow.id,
        teamNumber,
        scouter,
        scoringCycles,
        rowToNotes(row),
        observedAt
      );

      observationCount += 1;
      teamSet.add(teamNumber);
      matchSet.add(matchKey);

      const b = bucket(teamNumber);
      b.obsCount += 1;
      if (scoringCycles !== null) {
        b.scoringCycles.push(scoringCycles);
      }
      if (ferryingCycles !== null) {
        b.ferryingCycles.push(ferryingCycles);
      }
      if (cell(row, COL.can_climb)) {
        b.climbAttempts += 1;
        if (cell(row, COL.climb_level)) {
          b.climbSuccesses += 1;
        }
      }
    }

    function mean(xs: number[]): number {
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    }

    for (const [team, b] of perTeam) {
      insertMetric.run(eventKey, team, "scout.matches_observed", b.obsCount, fetchedAt);
      metricCount += 1;

      if (b.scoringCycles.length > 0) {
        insertMetric.run(eventKey, team, "scout.avg_scoring_cycles", mean(b.scoringCycles), fetchedAt);
        metricCount += 1;
      }
      if (b.ferryingCycles.length > 0) {
        insertMetric.run(eventKey, team, "scout.avg_ferrying_cycles", mean(b.ferryingCycles), fetchedAt);
        metricCount += 1;
      }
      if (b.climbAttempts > 0) {
        insertMetric.run(eventKey, team, "scout.climb_attempts", b.climbAttempts, fetchedAt);
        metricCount += 1;
        insertMetric.run(
          eventKey,
          team,
          "scout.climb_success_rate",
          b.climbSuccesses / b.climbAttempts,
          fetchedAt
        );
        metricCount += 1;
      }
    }
  });

  transaction();

  return {
    eventKey,
    fetchedAt,
    rowCount: dataRows.length,
    skippedRowCount,
    observationCount,
    teamCount: teamSet.size,
    matchCount: matchSet.size,
    metricCount,
    snapshotCount
  };
}
