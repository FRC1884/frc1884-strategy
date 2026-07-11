import { db } from "../db/client.js";

// Zebra MotionWorks ingest: real per-robot (x,y) field positions over time from
// TBA, where the event has the tracking system. This is genuine ground-truth
// movement data — no CV, no OCR, no training. Coverage is partial (only equipped
// events) and coordinates are field feet, not video pixels.

const TBA_BASE_URL = "https://www.thebluealliance.com/api/v3";

export class TbaKeyMissingError extends Error {
  constructor() {
    super("TBA_API_KEY is not set");
    this.name = "TbaKeyMissingError";
  }
}
function getApiKey(): string {
  const k = process.env.TBA_API_KEY;
  if (!k) throw new TbaKeyMissingError();
  return k;
}

async function fetchTba<T>(pathname: string): Promise<T | null> {
  const res = await fetch(`${TBA_BASE_URL}${pathname}`, { headers: { "X-TBA-Auth-Key": getApiKey() } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TBA ${pathname} -> ${res.status} ${res.statusText}`);
  // TBA returns the JSON literal `null` for matches with no zebra data.
  return (await res.json()) as T | null;
}

interface ZebraTeam {
  team_key: string;
  xs: Array<number | null>;
  ys: Array<number | null>;
}
interface ZebraData {
  key: string;
  times: number[];
  alliances: { red: ZebraTeam[]; blue: ZebraTeam[] };
}

export interface RobotPath {
  teamNumber: number;
  alliance: "red" | "blue";
  times: number[];
  xs: Array<number | null>;
  ys: Array<number | null>;
  distanceFt: number; // total path length over tracked segments
  trackedFraction: number; // share of samples with a valid position
}

function teamNum(key: string): number | null {
  if (!key.startsWith("frc")) return null;
  const n = Number(key.slice(3));
  return Number.isInteger(n) ? n : null;
}

function deriveMetrics(team: ZebraTeam, times: number[]): { distanceFt: number; trackedFraction: number } {
  let dist = 0;
  let tracked = 0;
  for (let i = 0; i < times.length; i++) {
    const x = team.xs[i];
    const y = team.ys[i];
    if (x != null && y != null) tracked++;
    if (i > 0) {
      const px = team.xs[i - 1];
      const py = team.ys[i - 1];
      if (x != null && y != null && px != null && py != null) {
        dist += Math.hypot(x - px, y - py);
      }
    }
  }
  return {
    distanceFt: Math.round(dist * 10) / 10,
    trackedFraction: times.length ? Math.round((tracked / times.length) * 100) / 100 : 0,
  };
}

function storeSnapshot(matchKey: string, payload: unknown, fetchedAt: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
     VALUES ('tba', 'zebra', ?, ?, ?)`
  ).run(matchKey, JSON.stringify(payload), fetchedAt);
}

export interface ZebraIngestResult {
  eventKey: string;
  matchesChecked: number;
  matchesWithData: number;
  pathsStored: number;
}

// Pull zebra data for every match of an event that's in the matches table.
export async function ingestZebraForEvent(eventKey: string): Promise<ZebraIngestResult> {
  getApiKey(); // fail fast if unconfigured
  const matchKeys = (
    db.prepare(`SELECT match_key FROM matches WHERE event_key = ? ORDER BY match_number ASC`).all(eventKey) as Array<{
      match_key: string;
    }>
  ).map((r) => r.match_key);

  let withData = 0;
  let pathsStored = 0;
  const fetchedAt = new Date().toISOString();

  const metricStmt = db.prepare(
    `INSERT INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(event_key, team_number, metric_name, source_run) DO UPDATE SET metric_value = excluded.metric_value`
  );

  for (const matchKey of matchKeys) {
    let data: ZebraData | null = null;
    try {
      data = await fetchTba<ZebraData>(`/match/${matchKey}/zebra_motionworks`);
    } catch {
      continue; // network/transient: skip this match, keep going
    }
    if (!data || !data.times || !data.alliances) continue;
    withData++;
    storeSnapshot(matchKey, data, fetchedAt);

    for (const alliance of ["red", "blue"] as const) {
      for (const t of data.alliances[alliance] ?? []) {
        const n = teamNum(t.team_key);
        if (n == null) continue;
        const m = deriveMetrics(t, data.times);
        metricStmt.run(eventKey, n, "zebra.distance_ft", m.distanceFt, matchKey);
        pathsStored++;
      }
    }
  }

  return { eventKey, matchesChecked: matchKeys.length, matchesWithData: withData, pathsStored };
}

// Read parsed per-robot paths for one match (for plotting on a field diagram).
export function getMatchPaths(matchKey: string): RobotPath[] | null {
  const snap = db
    .prepare(
      `SELECT payload_json FROM external_snapshots
       WHERE provider='tba' AND entity_type='zebra' AND entity_key=?
       ORDER BY fetched_at DESC LIMIT 1`
    )
    .get(matchKey) as { payload_json: string } | undefined;
  if (!snap) return null;

  const data = JSON.parse(snap.payload_json) as ZebraData;
  const out: RobotPath[] = [];
  for (const alliance of ["red", "blue"] as const) {
    for (const t of data.alliances?.[alliance] ?? []) {
      const n = teamNum(t.team_key);
      if (n == null) continue;
      const m = deriveMetrics(t, data.times);
      out.push({ teamNumber: n, alliance, times: data.times, xs: t.xs, ys: t.ys, ...m });
    }
  }
  return out;
}
