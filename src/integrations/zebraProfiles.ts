import { db } from "../db/client.js";
import { getMatchRoster } from "./currentMatch.js";

// Per-second "average location" profiles built from ingested Zebra MotionWorks
// snapshots, and a predicted-match assembly that pairs them with a roster.
//
// HONESTY NOTES (read before relying on this):
// - Zebra is rare at modern events. Profiles exist ONLY for teams that appear
//   in ingested zebra snapshots (POST /events/:eventKey/ingest-zebra first).
//   The API reports coverage explicitly; the frontend must show its fallback
//   (archetype-informed synthesis) as synthetic, not as tracking data.
// - Positions are normalised to a canonical RED-alliance frame before
//   averaging: FRC fields are 180°-rotationally symmetric, so blue-side
//   samples are rotated (x' = L - x, y' = W - y). Without this, a team that
//   played both colours would average to the middle of the field.
// - An average location is a tendency, not a trajectory: it smooths away
//   collisions, defence, and one-off paths. Good for "where does this robot
//   usually operate at t=37s", bad for claiming "this is what they will do".

const FIELD_LEN_FT = 54; // REBUILT field length (x), feet — matches Zebra units
const FIELD_WID_FT = 27; // field width (y), feet

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

export interface ProfileSample {
  t: number; // seconds from match start
  x: number | null; // canonical red-frame feet; null when no data at this second
  y: number | null;
  n: number; // how many matches contributed to this sample
}

export interface TeamZebraProfile {
  teamNumber: number;
  matchesUsed: number;
  samples: ProfileSample[];
}

function rotateToRed(x: number, y: number): [number, number] {
  return [FIELD_LEN_FT - x, FIELD_WID_FT - y];
}

// Build one team's per-second average location across all ingested zebra
// matches (optionally limited to one event via entity_key prefix, e.g. "2026").
export function buildTeamZebraProfile(teamNumber: number, matchKeyPrefix?: string): TeamZebraProfile {
  const rows = (
    matchKeyPrefix
      ? db
          .prepare(
            `SELECT entity_key, payload_json FROM external_snapshots
             WHERE provider='tba' AND entity_type='zebra' AND entity_key LIKE ?`
          )
          .all(`${matchKeyPrefix}%`)
      : db
          .prepare(
            `SELECT entity_key, payload_json FROM external_snapshots
             WHERE provider='tba' AND entity_type='zebra'`
          )
          .all()
  ) as Array<{ entity_key: string; payload_json: string }>;

  const key = `frc${teamNumber}`;
  const sumX: number[] = [];
  const sumY: number[] = [];
  const count: number[] = [];
  let matchesUsed = 0;

  for (const row of rows) {
    let data: ZebraData;
    try {
      data = JSON.parse(row.payload_json) as ZebraData;
    } catch {
      continue;
    }
    if (!data?.times || !data?.alliances) continue;

    for (const alliance of ["red", "blue"] as const) {
      const team = (data.alliances[alliance] ?? []).find((t) => t.team_key === key);
      if (!team) continue;
      matchesUsed += 1;
      for (let i = 0; i < data.times.length; i += 1) {
        const t = Math.floor(data.times[i]);
        let x = team.xs[i];
        let y = team.ys[i];
        if (x == null || y == null) continue;
        if (alliance === "blue") [x, y] = rotateToRed(x, y);
        sumX[t] = (sumX[t] ?? 0) + x;
        sumY[t] = (sumY[t] ?? 0) + y;
        count[t] = (count[t] ?? 0) + 1;
      }
    }
  }

  const horizon = Math.max(count.length, 0);
  const samples: ProfileSample[] = [];
  for (let t = 0; t < horizon; t += 1) {
    const n = count[t] ?? 0;
    samples.push({
      t,
      x: n ? Math.round((sumX[t] / n) * 10) / 10 : null,
      y: n ? Math.round((sumY[t] / n) * 10) / 10 : null,
      n,
    });
  }
  return { teamNumber, matchesUsed, samples };
}

export interface PredictedRobot {
  teamNumber: number;
  alliance: "red" | "blue";
  station: number;
  hasZebra: boolean;
  matchesUsed: number;
  // Canonical red-frame path; the caller mirrors for blue robots when drawing.
  path: ProfileSample[] | null;
}

export interface PredictedMatch {
  matchKey: string;
  fieldFt: { length: number; width: number };
  robots: PredictedRobot[];
  coverage: { withZebra: number; withoutZebra: number };
}

// Assemble the expected-pathways payload for one match: each rostered robot's
// average-location profile where zebra data exists, and an explicit gap where
// it doesn't (the UI falls back to labelled synthesis — never fake tracking).
export function buildPredictedMatch(matchKey: string): PredictedMatch | null {
  const roster = getMatchRoster(matchKey);
  if (!roster.length) return null;

  const robots: PredictedRobot[] = roster.map((r) => {
    const profile = buildTeamZebraProfile(r.teamNumber);
    const has = profile.matchesUsed > 0;
    return {
      teamNumber: r.teamNumber,
      alliance: r.alliance,
      station: r.station,
      hasZebra: has,
      matchesUsed: profile.matchesUsed,
      path: has ? profile.samples : null,
    };
  });

  return {
    matchKey,
    fieldFt: { length: FIELD_LEN_FT, width: FIELD_WID_FT },
    robots,
    coverage: {
      withZebra: robots.filter((r) => r.hasZebra).length,
      withoutZebra: robots.filter((r) => !r.hasZebra).length,
    },
  };
}
