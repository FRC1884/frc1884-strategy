import { db } from "../db/client.js";
import type {
  StatboticsEvent,
  StatboticsMatch,
  StatboticsTeam,
  StatboticsTeamEvent
} from "../types/domain.js";

const STATBOTICS_BASE_URL = process.env.STATBOTICS_BASE_URL ?? "https://api.statbotics.io/v3";

async function fetchStatboticsJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${STATBOTICS_BASE_URL}${pathname}`);

  if (!response.ok) {
    throw new Error(`Statbotics request failed: ${response.status} ${response.statusText} for ${pathname}`);
  }

  return response.json() as Promise<T>;
}

function toIsoFromUnix(seconds?: number | null): string | null {
  if (!seconds) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function storeSnapshot(
  provider: string,
  entityType: string,
  entityKey: string,
  payload: unknown,
  fetchedAt: string
): void {
  db.prepare(`
    INSERT OR IGNORE INTO external_snapshots (provider, entity_type, entity_key, payload_json, fetched_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(provider, entityType, entityKey, JSON.stringify(payload), fetchedAt);
}

function upsertEventFromStatbotics(event: StatboticsEvent): void {
  const locationParts = [event.state, event.country].filter(Boolean);

  db.prepare(`
    INSERT INTO events (event_key, name, season, location, start_date, end_date, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'statbotics', CURRENT_TIMESTAMP)
    ON CONFLICT(event_key) DO UPDATE SET
      name = excluded.name,
      season = excluded.season,
      location = excluded.location,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    event.key,
    event.name,
    event.year,
    locationParts.length > 0 ? locationParts.join(", ") : null,
    event.start_date,
    event.end_date
  );
}

function upsertTeamFromStatbotics(team: StatboticsTeam): void {
  db.prepare(`
    INSERT INTO teams (team_number, name, location, country, source, updated_at)
    VALUES (?, ?, ?, ?, 'statbotics', CURRENT_TIMESTAMP)
    ON CONFLICT(team_number) DO UPDATE SET
      name = excluded.name,
      location = COALESCE(excluded.location, teams.location),
      country = COALESCE(excluded.country, teams.country),
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    team.team,
    team.name,
    team.state ?? null,
    team.country ?? null
  );
}

function ensureTeamExists(teamNumber: number, name?: string | null): void {
  db.prepare(`
    INSERT INTO teams (team_number, name, location, country, source)
    VALUES (?, ?, NULL, NULL, 'statbotics')
    ON CONFLICT(team_number) DO UPDATE SET
      name = COALESCE(excluded.name, teams.name),
      updated_at = CURRENT_TIMESTAMP
  `).run(teamNumber, name ?? `Team ${teamNumber}`);
}

function upsertEventTeam(eventKey: string, teamNumber: number): void {
  db.prepare(`
    INSERT OR IGNORE INTO event_teams (event_key, team_number)
    VALUES (?, ?)
  `).run(eventKey, teamNumber);
}

function writeAnalyticsMetric(
  eventKey: string | null,
  teamNumber: number,
  metricName: string,
  metricValue: number | null | undefined,
  sourceRun: string
): void {
  if (metricValue == null || Number.isNaN(metricValue)) {
    return;
  }

  db.prepare(`
    INSERT OR IGNORE INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventKey, teamNumber, metricName, metricValue, sourceRun);
}

function upsertMatchFromStatbotics(match: StatboticsMatch): void {
  db.prepare(`
    INSERT INTO matches (match_key, event_key, comp_level, match_number, scheduled_at, red_score, blue_score, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'statbotics', CURRENT_TIMESTAMP)
    ON CONFLICT(match_key) DO UPDATE SET
      event_key = excluded.event_key,
      comp_level = excluded.comp_level,
      match_number = excluded.match_number,
      scheduled_at = excluded.scheduled_at,
      red_score = excluded.red_score,
      blue_score = excluded.blue_score,
      source = excluded.source,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    match.key,
    match.event,
    match.comp_level,
    match.match_number,
    toIsoFromUnix(match.time),
    match.result?.red_score ?? null,
    match.result?.blue_score ?? null
  );

  const matchRow = db.prepare(`SELECT id FROM matches WHERE match_key = ?`).get(match.key) as { id: number };
  const matchId = matchRow.id;

  const allianceConfigs = [
    {
      color: "red",
      teamKeys: match.alliances.red.team_keys,
      score: match.result?.red_score ?? null,
      rankingPoints:
        Number(Boolean(match.result?.red_rp_1)) +
        Number(Boolean(match.result?.red_rp_2)) +
        Number(Boolean(match.result?.red_rp_3))
    },
    {
      color: "blue",
      teamKeys: match.alliances.blue.team_keys,
      score: match.result?.blue_score ?? null,
      rankingPoints:
        Number(Boolean(match.result?.blue_rp_1)) +
        Number(Boolean(match.result?.blue_rp_2)) +
        Number(Boolean(match.result?.blue_rp_3))
    }
  ] as const;

  for (const alliance of allianceConfigs) {
    db.prepare(`
      INSERT INTO match_alliances (match_id, alliance_color, score, ranking_points)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(match_id, alliance_color) DO UPDATE SET
        score = excluded.score,
        ranking_points = excluded.ranking_points
    `).run(matchId, alliance.color, alliance.score, alliance.rankingPoints);

    const allianceRow = db
      .prepare(`
        SELECT id
        FROM match_alliances
        WHERE match_id = ? AND alliance_color = ?
      `)
      .get(matchId, alliance.color) as { id: number };

    db.prepare(`DELETE FROM match_alliance_teams WHERE alliance_id = ?`).run(allianceRow.id);

    alliance.teamKeys.forEach((teamNumber, index) => {
      db.prepare(`
        INSERT INTO match_alliance_teams (alliance_id, team_number, station)
        VALUES (?, ?, ?)
      `).run(allianceRow.id, teamNumber, index + 1);
    });
  }
}

export async function ingestStatboticsEvent(eventKey: string): Promise<{
  eventKey: string;
  fetchedAt: string;
  teamCount: number;
  teamEventCount: number;
  matchCount: number;
}> {
  const fetchedAt = new Date().toISOString();

  const [event, teamEvents, matches] = await Promise.all([
    fetchStatboticsJson<StatboticsEvent>(`/event/${eventKey}`),
    fetchStatboticsJson<StatboticsTeamEvent[]>(
      `/team_events?event=${encodeURIComponent(eventKey)}&limit=1000`
    ),
    fetchStatboticsJson<StatboticsMatch[]>(`/matches?event=${encodeURIComponent(eventKey)}&limit=1000`)
  ]);

  const uniqueTeamNumbers = [...new Set(teamEvents.map((teamEvent) => teamEvent.team))];
  const teams = await Promise.all(
    uniqueTeamNumbers.map((teamNumber) =>
      fetchStatboticsJson<StatboticsTeam>(`/team/${encodeURIComponent(teamNumber)}`)
    )
  );

  const transaction = db.transaction(() => {
    upsertEventFromStatbotics(event);
    storeSnapshot("statbotics", "event", eventKey, event, fetchedAt);
    storeSnapshot("statbotics", "teams", eventKey, teams, fetchedAt);
    storeSnapshot("statbotics", "team_events", eventKey, teamEvents, fetchedAt);
    storeSnapshot("statbotics", "matches", eventKey, matches, fetchedAt);

    db.prepare(`DELETE FROM event_teams WHERE event_key = ?`).run(eventKey);
    db.prepare(`DELETE FROM analytics_metrics WHERE event_key = ?`).run(eventKey);

    teams.forEach((team) => {
      upsertTeamFromStatbotics(team);
      upsertEventTeam(eventKey, team.team);
      writeAnalyticsMetric(eventKey, team.team, "statbotics.norm_epa.current", team.norm_epa?.current, fetchedAt);
      writeAnalyticsMetric(eventKey, team.team, "statbotics.norm_epa.recent", team.norm_epa?.recent, fetchedAt);
      writeAnalyticsMetric(eventKey, team.team, "statbotics.record.winrate", team.record?.winrate, fetchedAt);
    });

    teamEvents.forEach((teamEvent) => {
      ensureTeamExists(teamEvent.team, teamEvent.team_name);
      upsertEventTeam(eventKey, teamEvent.team);
      writeAnalyticsMetric(
        eventKey,
        teamEvent.team,
        "statbotics.event_epa.norm",
        teamEvent.epa?.norm,
        fetchedAt
      );
      writeAnalyticsMetric(
        eventKey,
        teamEvent.team,
        "statbotics.event_epa.total_points_mean",
        teamEvent.epa?.total_points?.mean,
        fetchedAt
      );
      writeAnalyticsMetric(
        eventKey,
        teamEvent.team,
        "statbotics.event_record.total_winrate",
        teamEvent.record?.total?.winrate,
        fetchedAt
      );
      writeAnalyticsMetric(
        eventKey,
        teamEvent.team,
        "statbotics.event_record.qual_rank",
        teamEvent.record?.qual?.rank,
        fetchedAt
      );
      writeAnalyticsMetric(
        eventKey,
        teamEvent.team,
        "statbotics.district_points",
        teamEvent.district_points,
        fetchedAt
      );
    });

    matches.forEach((match) => {
      match.alliances.red.team_keys.forEach((teamNumber) => {
        ensureTeamExists(teamNumber);
        upsertEventTeam(eventKey, teamNumber);
      });
      match.alliances.blue.team_keys.forEach((teamNumber) => {
        ensureTeamExists(teamNumber);
        upsertEventTeam(eventKey, teamNumber);
      });
      upsertMatchFromStatbotics(match);
    });
  });

  transaction();

  return {
    eventKey,
    fetchedAt,
    teamCount: teams.length,
    teamEventCount: teamEvents.length,
    matchCount: matches.length
  };
}
