import { db } from "../db/client.js";

// Pulls every TBA-linked match video + official score breakdown that's already
// sitting in external_snapshots (your TBA ingest stores the full raw match
// payload). This is the foundation for CALIBRATING the vision AI against ground
// truth — NOT for training it (see INTEGRATION-video.md for why that wall is
// hard). It also surfaces the real REBUILT score_breakdown field names so we
// can find where the official per-alliance fuel count lives.

interface SnapshotRow {
  payload_json: string;
  fetched_at: string;
}

interface RawMatch {
  key: string;
  comp_level: string;
  videos?: Array<{ type?: string; key?: string }>;
  score_breakdown?: { red?: Record<string, unknown>; blue?: Record<string, unknown> } | null;
  alliances?: {
    red?: { team_keys?: string[]; score?: number | null };
    blue?: { team_keys?: string[]; score?: number | null };
  };
}

export interface MatchVideoEntry {
  matchKey: string;
  compLevel: string;
  youtube: string[]; // watch URLs (TBA "conveniently links" these)
  hasBreakdown: boolean;
  redScore: number | null;
  blueScore: number | null;
}

export interface DatasetManifest {
  eventKey: string;
  snapshotAt: string | null;
  matchCount: number;
  withVideo: number;
  withBreakdown: number;
  // Every key seen inside score_breakdown sides — this is how you discover the
  // actual REBUILT field that holds the official fuel count, which the
  // calibration loop then compares the AI's estimate against.
  breakdownKeys: string[];
  entries: MatchVideoEntry[];
}

function latestMatchesSnapshot(eventKey: string): SnapshotRow | undefined {
  return db
    .prepare(
      `SELECT payload_json, fetched_at FROM external_snapshots
       WHERE provider='tba' AND entity_type='matches' AND entity_key=?
       ORDER BY fetched_at DESC LIMIT 1`
    )
    .get(eventKey) as SnapshotRow | undefined;
}

export function buildVideoDataset(eventKey: string): DatasetManifest {
  const snap = latestMatchesSnapshot(eventKey);
  if (!snap) {
    return {
      eventKey,
      snapshotAt: null,
      matchCount: 0,
      withVideo: 0,
      withBreakdown: 0,
      breakdownKeys: [],
      entries: [],
    };
  }

  const matches = JSON.parse(snap.payload_json) as RawMatch[];
  const breakdownKeys = new Set<string>();

  const entries: MatchVideoEntry[] = matches.map((m) => {
    const youtube = (m.videos ?? [])
      .filter((v) => v.type === "youtube" && v.key)
      .map((v) => `https://www.youtube.com/watch?v=${v.key}`);

    for (const side of [m.score_breakdown?.red, m.score_breakdown?.blue]) {
      if (side) Object.keys(side).forEach((k) => breakdownKeys.add(k));
    }

    return {
      matchKey: m.key,
      compLevel: m.comp_level,
      youtube,
      hasBreakdown: Boolean(m.score_breakdown),
      redScore: m.alliances?.red?.score ?? null,
      blueScore: m.alliances?.blue?.score ?? null,
    };
  });

  return {
    eventKey,
    snapshotAt: snap.fetched_at,
    matchCount: entries.length,
    withVideo: entries.filter((e) => e.youtube.length > 0).length,
    withBreakdown: entries.filter((e) => e.hasBreakdown).length,
    breakdownKeys: [...breakdownKeys].sort(),
    entries,
  };
}

// Read the official per-alliance value for a given breakdown field (e.g. the
// REBUILT fuel total) for one match — the ground-truth side of calibration.
// fieldName comes from breakdownKeys above once you've identified the fuel field.
export function officialBreakdownValue(
  eventKey: string,
  matchKey: string,
  fieldName: string
): { red: number | null; blue: number | null } | null {
  const snap = latestMatchesSnapshot(eventKey);
  if (!snap) return null;
  const matches = JSON.parse(snap.payload_json) as RawMatch[];
  const m = matches.find((x) => x.key === matchKey);
  if (!m?.score_breakdown) return null;
  const toNum = (v: unknown): number | null => (typeof v === "number" ? v : null);
  return {
    red: toNum(m.score_breakdown.red?.[fieldName]),
    blue: toNum(m.score_breakdown.blue?.[fieldName]),
  };
}
