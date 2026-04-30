import { db } from "../db/client.js";
import { parseCsv } from "./csv.js";

const SHEET_ID = "1HWL3TAa39k_uPIAFoDrSjsNUR554-9mNVzBdgTqsIBE";
// Tab-name-based gviz endpoint — survives gid changes if the tab is renumbered.
const PIT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=pit%20scouting%20responses`;

// Header substring -> capability name. Substring match (normalized lowercase, collapsed whitespace)
// so trivial form-question wording tweaks don't break ingestion.
const FIELD_MAP: Array<{ matcher: string; name: string }> = [
  { matcher: "what has changed about this robot", name: "pit_changes_since_regionals" },
  { matcher: "how many cycles can this robot do", name: "pit_cycles_per_period" },
  { matcher: "average fuel scored per cycle", name: "pit_avg_fuel_per_cycle" },
  { matcher: "hopper capacity", name: "pit_hopper_capacity" },
  { matcher: "what does the robot's auto do", name: "pit_auto_description" },
  { matcher: "can the robot climb", name: "pit_climb_capability" },
  { matcher: "robot's been struggling with", name: "pit_struggling_with" },
  { matcher: "upload a photo", name: "pit_photo_urls" }
];

function normalizeHeader(raw: string): string {
  return (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function findColIndex(headers: string[], substr: string): number {
  const target = substr.toLowerCase();
  for (let i = 0; i < headers.length; i += 1) {
    if (normalizeHeader(headers[i]).includes(target)) {
      return i;
    }
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0) {
    return "";
  }
  return (row[idx] ?? "").trim();
}

function parsePositiveInt(raw: string): number | null {
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export interface PitScoutingIngestResult {
  eventKey: string;
  fetchedAt: string;
  rowCount: number;
  skippedRowCount: number;
  teamCount: number;
  capabilityCount: number;
  snapshotCount: number;
}

export async function ingestPitScoutingSheet(eventKey = "2026new"): Promise<PitScoutingIngestResult> {
  const response = await fetch(PIT_SHEET_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Pit sheet fetch failed: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const fetchedAt = new Date().toISOString();
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error("Pit sheet is empty");
  }

  const headers = rows[0];
  const teamCol = findColIndex(headers, "team number");
  if (teamCol < 0) {
    throw new Error("Pit sheet missing 'Team Number' column");
  }
  const fieldCols = FIELD_MAP.map((f) => ({ name: f.name, idx: findColIndex(headers, f.matcher) }));

  const dataRowsRaw = rows.slice(1);
  const validRows = dataRowsRaw.filter((r) => {
    if (parsePositiveInt(cell(r, teamCol)) === null) {
      return false;
    }
    return r.some((c) => (c ?? "").trim() !== "");
  });
  const skippedRowCount = dataRowsRaw.length - validRows.length;

  const teamSet = new Set<number>();
  let capabilityCount = 0;
  let snapshotCount = 0;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, source)
      VALUES (?, 'Newton Division', 2026, 'Houston, TX, USA', 'pit-scouting')
      ON CONFLICT(event_key) DO NOTHING
    `).run(eventKey);

    db.prepare(`
      INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
      VALUES ('pit-sheet', 'csv_dump', ?, ?, ?)
    `).run(eventKey, JSON.stringify({ csv: csvText, byteLength: csvText.length }), fetchedAt);
    snapshotCount += 1;

    db.prepare(`
      DELETE FROM team_capabilities WHERE event_key = ? AND source = 'pit-scouting'
    `).run(eventKey);

    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (team_number, name, source)
      VALUES (?, ?, 'pit-scouting')
    `);
    const insertEventTeam = db.prepare(`
      INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)
    `);
    const insertCapability = db.prepare(`
      INSERT INTO team_capabilities (event_key, team_number, capability_name, capability_value, source, observed_at)
      VALUES (?, ?, ?, ?, 'pit-scouting', ?)
      ON CONFLICT(event_key, team_number, capability_name, source) DO UPDATE SET
        capability_value = excluded.capability_value,
        observed_at = excluded.observed_at
    `);

    for (const row of validRows) {
      const teamNumber = parsePositiveInt(cell(row, teamCol)) as number;
      insertTeam.run(teamNumber, `Team ${teamNumber}`);
      insertEventTeam.run(eventKey, teamNumber);
      teamSet.add(teamNumber);
      for (const fc of fieldCols) {
        const v = cell(row, fc.idx);
        if (!v) {
          continue;
        }
        insertCapability.run(eventKey, teamNumber, fc.name, v, fetchedAt);
        capabilityCount += 1;
      }
    }
  });

  transaction();

  return {
    eventKey,
    fetchedAt,
    rowCount: validRows.length,
    skippedRowCount,
    teamCount: teamSet.size,
    capabilityCount,
    snapshotCount
  };
}
