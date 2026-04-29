import fs from "node:fs";

import { db } from "../db/client.js";
import { parseCsv } from "./csv.js";

const CAPABILITY_COLUMNS: Array<{ idx: number; name: string }> = [
  { idx: 2, name: "drivetrain" },
  { idx: 3, name: "robot_weight" },
  { idx: 4, name: "bumper_weight" },
  { idx: 5, name: "robot_height" },
  { idx: 6, name: "robot_width" },
  { idx: 7, name: "robot_length" },
  { idx: 8, name: "intake_type" },
  { idx: 9, name: "hopper_type" },
  { idx: 10, name: "hopper_capacity" },
  { idx: 11, name: "indexer_type" },
  { idx: 12, name: "shooter_type" },
  { idx: 13, name: "shooter_hood" },
  { idx: 14, name: "trench_bump" },
  { idx: 15, name: "fuel_acquisition" },
  { idx: 16, name: "fuel_scoring_position" },
  { idx: 17, name: "fuel_passing" },
  { idx: 18, name: "bps" },
  { idx: 19, name: "neutral_zone_auto" },
  { idx: 20, name: "neutral_zone_start" },
  { idx: 21, name: "alliance_zone_auto" },
  { idx: 22, name: "alliance_zone_start" },
  { idx: 23, name: "auto_climb" },
  { idx: 24, name: "endgame_climb" },
  { idx: 25, name: "comments" }
];

const EPA_COLUMNS: Array<{ idx: number; name: string }> = [
  { idx: 26, name: "total" },
  { idx: 27, name: "auto" },
  { idx: 28, name: "teleop" },
  { idx: 29, name: "endgame" },
  { idx: 30, name: "rp_energized" },
  { idx: 31, name: "rp_supercharged" },
  { idx: 32, name: "rp_traversal" }
];

function cell(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

function parseTeamNumber(raw: string): number | null {
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

export interface PreScoutingIngestResult {
  eventKey: string;
  fetchedAt: string;
  teamCount: number;
  capabilityCount: number;
  metricCount: number;
  snapshotCount: number;
}

export async function ingestNewtonPreScoutingCsv(
  filePath: string,
  eventKey = "2026new"
): Promise<PreScoutingIngestResult> {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  const fetchedAt = new Date().toISOString();

  const teamRows = rows.filter((r) => parseTeamNumber(cell(r, 0)) !== null);

  let teamCount = 0;
  let capabilityCount = 0;
  let metricCount = 0;
  let snapshotCount = 0;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, source)
      VALUES (?, 'Newton Division', 2026, 'Houston, TX, USA', 'pre-scouting')
      ON CONFLICT(event_key) DO NOTHING
    `).run(eventKey);

    db.prepare(`
      DELETE FROM team_capabilities WHERE event_key = ? AND source = 'pre-scouting'
    `).run(eventKey);

    db.prepare(`
      DELETE FROM analytics_metrics WHERE event_key = ? AND metric_name LIKE 'prescouting.%'
    `).run(eventKey);

    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (team_number, name, source)
      VALUES (?, ?, 'pre-scouting')
    `);
    const insertEventTeam = db.prepare(`
      INSERT OR IGNORE INTO event_teams (event_key, team_number)
      VALUES (?, ?)
    `);
    const insertCapability = db.prepare(`
      INSERT INTO team_capabilities (event_key, team_number, capability_name, capability_value, source, observed_at)
      VALUES (?, ?, ?, ?, 'pre-scouting', ?)
      ON CONFLICT(event_key, team_number, capability_name, source) DO UPDATE SET
        capability_value = excluded.capability_value,
        observed_at = excluded.observed_at
    `);
    const insertMetric = db.prepare(`
      INSERT OR IGNORE INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertSnapshot = db.prepare(`
      INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
      VALUES ('pre-scouting', 'team_row', ?, ?, ?)
    `);

    for (const row of teamRows) {
      const teamNumber = parseTeamNumber(cell(row, 0)) as number;
      const teamName = cell(row, 1) || `Team ${teamNumber}`;

      insertTeam.run(teamNumber, teamName);
      insertEventTeam.run(eventKey, teamNumber);
      teamCount += 1;

      for (const col of CAPABILITY_COLUMNS) {
        const value = cell(row, col.idx);
        if (!value) {
          continue;
        }
        insertCapability.run(eventKey, teamNumber, col.name, value, fetchedAt);
        capabilityCount += 1;
      }

      for (const col of EPA_COLUMNS) {
        const value = parseNumeric(cell(row, col.idx));
        if (value === null) {
          continue;
        }
        insertMetric.run(eventKey, teamNumber, `prescouting.epa.${col.name}`, value, fetchedAt);
        metricCount += 1;
      }

      const payload: Record<string, string> = { team_number: String(teamNumber), team_name: teamName };
      for (const col of [...CAPABILITY_COLUMNS, ...EPA_COLUMNS]) {
        const v = cell(row, col.idx);
        if (v) {
          payload[col.name] = v;
        }
      }
      insertSnapshot.run(String(teamNumber), JSON.stringify(payload), fetchedAt);
      snapshotCount += 1;
    }
  });

  transaction();

  return { eventKey, fetchedAt, teamCount, capabilityCount, metricCount, snapshotCount };
}
