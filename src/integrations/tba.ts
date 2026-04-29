import { db } from "../db/client.js";

const TBA_BASE_URL = "https://www.thebluealliance.com/api/v3";

export class TbaCredentialsMissingError extends Error {
  constructor() {
    super("TBA_API_KEY environment variable is not set");
    this.name = "TbaCredentialsMissingError";
  }
}

// Read at call time, not module load: server must boot without TBA_API_KEY set so Phase 3 routes can return 503 cleanly.
function getApiKey(): string {
  const key = process.env.TBA_API_KEY;
  if (!key) {
    throw new TbaCredentialsMissingError();
  }
  return key;
}

export function isTbaConfigured(): boolean {
  return Boolean(process.env.TBA_API_KEY);
}

async function fetchTba<T>(pathname: string): Promise<T> {
  const response = await fetch(`${TBA_BASE_URL}${pathname}`, {
    headers: { "X-TBA-Auth-Key": getApiKey() }
  });

  if (!response.ok) {
    throw new Error(`TBA request failed: ${response.status} ${response.statusText} for ${pathname}`);
  }

  return response.json() as Promise<T>;
}

function parseTeamKey(raw: string): number | null {
  if (typeof raw !== "string" || !raw.startsWith("frc")) {
    return null;
  }
  const n = Number(raw.slice(3));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function safeMetricKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toIsoFromUnix(seconds?: number | null): string | null {
  if (!seconds) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function storeSnapshot(
  entityType: string,
  entityKey: string,
  payload: unknown,
  fetchedAt: string
): void {
  db.prepare(`
    INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
    VALUES ('tba', ?, ?, ?, ?)
  `).run(entityType, entityKey, JSON.stringify(payload), fetchedAt);
}

interface TbaAlliance {
  team_keys: string[];
  score?: number | null;
}

interface TbaScoreBreakdownSide {
  rp?: number | null;
  [key: string]: unknown;
}

interface TbaMatch {
  key: string;
  event_key: string;
  comp_level: string;
  match_number: number;
  time?: number | null;
  predicted_time?: number | null;
  actual_time?: number | null;
  alliances: { red: TbaAlliance; blue: TbaAlliance };
  score_breakdown?: { red?: TbaScoreBreakdownSide; blue?: TbaScoreBreakdownSide } | null;
}

type TbaOprPayload = {
  oprs?: Record<string, number> | null;
  dprs?: Record<string, number> | null;
  ccwms?: Record<string, number> | null;
};

type TbaCoprPayload = Record<string, Record<string, number>>;

export interface TbaEventIngestResult {
  eventKey: string;
  fetchedAt: string;
  qmMatchCount: number;
  droppedNonQmCount: number;
  teamUpsertCount: number;
}

export interface TbaOprIngestResult {
  eventKey: string;
  fetchedAt: string;
  oprMetricCount: number;
  dprMetricCount: number;
  coprStatCount: number;
  coprMetricCount: number;
  coprStatNames: string[];
}

export async function ingestTbaEvent(eventKey: string): Promise<TbaEventIngestResult> {
  const fetchedAt = new Date().toISOString();
  const matches = await fetchTba<TbaMatch[]>(`/event/${encodeURIComponent(eventKey)}/matches`);

  const qmMatches = matches.filter((m) => m.comp_level === "qm");
  const droppedNonQmCount = matches.length - qmMatches.length;

  let teamUpsertCount = 0;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, source)
      VALUES (?, 'Newton Division', 2026, 'Houston, TX, USA', 'tba')
      ON CONFLICT(event_key) DO NOTHING
    `).run(eventKey);

    storeSnapshot("matches", eventKey, matches, fetchedAt);

    const upsertMatch = db.prepare(`
      INSERT INTO matches (match_key, event_key, comp_level, match_number, scheduled_at, red_score, blue_score, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'tba', CURRENT_TIMESTAMP)
      ON CONFLICT(match_key) DO UPDATE SET
        event_key = excluded.event_key,
        comp_level = excluded.comp_level,
        match_number = excluded.match_number,
        scheduled_at = excluded.scheduled_at,
        red_score = excluded.red_score,
        blue_score = excluded.blue_score,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `);
    const selectMatchId = db.prepare(`SELECT id FROM matches WHERE match_key = ?`);
    const upsertAlliance = db.prepare(`
      INSERT INTO match_alliances (match_id, alliance_color, score, ranking_points)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(match_id, alliance_color) DO UPDATE SET
        score = excluded.score,
        ranking_points = excluded.ranking_points
    `);
    const selectAllianceId = db.prepare(`
      SELECT id FROM match_alliances WHERE match_id = ? AND alliance_color = ?
    `);
    const deleteAllianceTeams = db.prepare(`DELETE FROM match_alliance_teams WHERE alliance_id = ?`);
    const insertAllianceTeam = db.prepare(`
      INSERT INTO match_alliance_teams (alliance_id, team_number, station)
      VALUES (?, ?, ?)
    `);
    const upsertTeam = db.prepare(`
      INSERT INTO teams (team_number, name, source)
      VALUES (?, ?, 'tba')
      ON CONFLICT(team_number) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
    `);
    const upsertEventTeam = db.prepare(`
      INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)
    `);

    for (const match of qmMatches) {
      const scheduledAt =
        toIsoFromUnix(match.actual_time) ??
        toIsoFromUnix(match.predicted_time) ??
        toIsoFromUnix(match.time);

      const redScoreRaw = match.alliances.red.score;
      const blueScoreRaw = match.alliances.blue.score;
      const redScore = typeof redScoreRaw === "number" && redScoreRaw >= 0 ? redScoreRaw : null;
      const blueScore = typeof blueScoreRaw === "number" && blueScoreRaw >= 0 ? blueScoreRaw : null;

      upsertMatch.run(
        match.key,
        match.event_key,
        match.comp_level,
        match.match_number,
        scheduledAt,
        redScore,
        blueScore
      );

      const matchRow = selectMatchId.get(match.key) as { id: number };

      const allianceConfigs = [
        {
          color: "red" as const,
          teamKeys: match.alliances.red.team_keys,
          score: redScore,
          rp: match.score_breakdown?.red?.rp ?? null
        },
        {
          color: "blue" as const,
          teamKeys: match.alliances.blue.team_keys,
          score: blueScore,
          rp: match.score_breakdown?.blue?.rp ?? null
        }
      ];

      for (const alliance of allianceConfigs) {
        upsertAlliance.run(matchRow.id, alliance.color, alliance.score, alliance.rp);
        const allianceRow = selectAllianceId.get(matchRow.id, alliance.color) as { id: number };
        deleteAllianceTeams.run(allianceRow.id);

        alliance.teamKeys.forEach((rawKey, index) => {
          const teamNumber = parseTeamKey(rawKey);
          if (teamNumber === null) {
            return;
          }
          upsertTeam.run(teamNumber, `Team ${teamNumber}`);
          upsertEventTeam.run(eventKey, teamNumber);
          insertAllianceTeam.run(allianceRow.id, teamNumber, index + 1);
          teamUpsertCount += 1;
        });
      }
    }
  });

  transaction();

  return {
    eventKey,
    fetchedAt,
    qmMatchCount: qmMatches.length,
    droppedNonQmCount,
    teamUpsertCount
  };
}

export async function ingestTbaOprs(eventKey: string): Promise<TbaOprIngestResult> {
  const fetchedAt = new Date().toISOString();

  const [oprPayload, coprPayload] = await Promise.all([
    fetchTba<TbaOprPayload>(`/event/${encodeURIComponent(eventKey)}/oprs`),
    fetchTba<TbaCoprPayload>(`/event/${encodeURIComponent(eventKey)}/coprs`)
  ]);

  console.info("[tba] oprs payload top-level keys:", Object.keys(oprPayload ?? {}));
  console.info("[tba] coprs payload top-level keys:", Object.keys(coprPayload ?? {}));

  let oprMetricCount = 0;
  let dprMetricCount = 0;
  let coprMetricCount = 0;
  const coprStatNames: string[] = [];

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO events (event_key, name, season, location, source)
      VALUES (?, 'Newton Division', 2026, 'Houston, TX, USA', 'tba')
      ON CONFLICT(event_key) DO NOTHING
    `).run(eventKey);

    storeSnapshot("oprs", eventKey, oprPayload, fetchedAt);
    storeSnapshot("coprs", eventKey, coprPayload, fetchedAt);

    db.prepare(`
      DELETE FROM analytics_metrics WHERE event_key = ? AND metric_name LIKE 'tba.%'
    `).run(eventKey);

    const ensureTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (team_number, name, source)
      VALUES (?, ?, 'tba')
    `);
    const ensureEventTeam = db.prepare(`
      INSERT OR IGNORE INTO event_teams (event_key, team_number) VALUES (?, ?)
    `);
    const insertMetric = db.prepare(`
      INSERT OR IGNORE INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
      VALUES (?, ?, ?, ?, ?)
    `);

    function writeTeamMap(map: Record<string, number> | null | undefined, metricName: string): number {
      if (!map || typeof map !== "object") {
        return 0;
      }
      let count = 0;
      for (const [teamKey, value] of Object.entries(map)) {
        const teamNumber = parseTeamKey(teamKey);
        if (teamNumber === null || typeof value !== "number" || !Number.isFinite(value)) {
          continue;
        }
        ensureTeam.run(teamNumber, `Team ${teamNumber}`);
        ensureEventTeam.run(eventKey, teamNumber);
        insertMetric.run(eventKey, teamNumber, metricName, value, fetchedAt);
        count += 1;
      }
      return count;
    }

    oprMetricCount = writeTeamMap(oprPayload?.oprs, "tba.opr");
    dprMetricCount = writeTeamMap(oprPayload?.dprs, "tba.dpr");

    if (coprPayload && typeof coprPayload === "object") {
      for (const [statName, teamMap] of Object.entries(coprPayload)) {
        coprStatNames.push(statName);
        const safeName = safeMetricKey(statName);
        if (!safeName) {
          continue;
        }
        coprMetricCount += writeTeamMap(teamMap as Record<string, number>, `tba.copr.${safeName}`);
      }
    }
  });

  transaction();

  return {
    eventKey,
    fetchedAt,
    oprMetricCount,
    dprMetricCount,
    coprStatCount: coprStatNames.length,
    coprMetricCount,
    coprStatNames
  };
}
