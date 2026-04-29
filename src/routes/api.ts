import type { FastifyPluginAsync } from "fastify";

import { databasePath, db } from "../db/client.js";
import { hydrateMatchesForEvent } from "./helpers.js";

export const apiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    ok: true,
    databasePath,
    timestamp: new Date().toISOString()
  }));

  app.get("/events", async () => {
    const rows = db
      .prepare(`
        SELECT event_key, name, season, location, start_date, end_date, source
        FROM events
        ORDER BY season DESC, start_date DESC
      `)
      .all();

    return { events: rows };
  });

  app.get<{
    Params: { eventKey: string };
  }>("/events/:eventKey", async (request, reply) => {
    const event = db
      .prepare(`
        SELECT event_key, name, season, location, start_date, end_date, source
        FROM events
        WHERE event_key = ?
      `)
      .get(request.params.eventKey);

    if (!event) {
      return reply.code(404).send({ error: "event_not_found" });
    }

    const counts = db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM event_teams WHERE event_key = ?) AS teamCount,
          (SELECT COUNT(*) FROM matches WHERE event_key = ?) AS matchCount,
          (SELECT COUNT(*) FROM pit_observations WHERE event_key = ?) AS pitObservationCount,
          (SELECT COUNT(*) FROM strategy_plans WHERE event_key = ?) AS strategyPlanCount
      `)
      .get(
        request.params.eventKey,
        request.params.eventKey,
        request.params.eventKey,
        request.params.eventKey
      );

    return {
      event,
      counts,
      recentMatches: hydrateMatchesForEvent(request.params.eventKey).slice(0, 3)
    };
  });

  app.get<{
    Params: { eventKey: string; teamNumber: string };
  }>("/events/:eventKey/teams/:teamNumber/full", async (request, reply) => {
    const teamNumber = Number(request.params.teamNumber);
    if (!Number.isInteger(teamNumber)) {
      return reply.code(400).send({ error: "invalid_team_number" });
    }

    const { eventKey } = request.params;

    const team = db
      .prepare(`
        SELECT team_number, name, location, country, source, created_at, updated_at
        FROM teams
        WHERE team_number = ?
      `)
      .get(teamNumber);

    if (!team) {
      return reply.code(404).send({ error: "team_not_found" });
    }

    const capabilities = db
      .prepare(`
        SELECT capability_name, capability_value, source, observed_at
        FROM team_capabilities
        WHERE event_key = ? AND team_number = ?
        ORDER BY source ASC, capability_name ASC
      `)
      .all(eventKey, teamNumber);

    const metrics = db
      .prepare(`
        SELECT event_key, metric_name, metric_value, source_run, computed_at
        FROM analytics_metrics
        WHERE team_number = ? AND (event_key = ? OR event_key IS NULL)
        ORDER BY metric_name ASC, computed_at DESC
      `)
      .all(teamNumber, eventKey);

    const matchObservations = db
      .prepare(`
        SELECT
          m.match_key,
          m.match_number,
          m.comp_level,
          mo.phase,
          mo.scouter,
          mo.fuel_scored,
          mo.climb_points,
          mo.notes,
          mo.source,
          mo.observed_at
        FROM match_observations mo
        JOIN matches m ON m.id = mo.match_id
        WHERE m.event_key = ? AND mo.team_number = ?
        ORDER BY m.match_number ASC, mo.observed_at ASC
      `)
      .all(eventKey, teamNumber);

    const pitObservations = db
      .prepare(`
        SELECT scouter, stars, avg_fuel, climb_capability, warning_flag, notes, source, observed_at
        FROM pit_observations
        WHERE event_key = ? AND team_number = ?
        ORDER BY observed_at DESC
      `)
      .all(eventKey, teamNumber);

    return {
      eventKey,
      team,
      capabilities,
      metrics,
      matchObservations,
      pitObservations
    };
  });

  app.get<{
    Params: { eventKey: string };
  }>("/events/:eventKey/teams/live-summary", async (request) => {
    const { eventKey } = request.params;

    const rows = db
      .prepare(`
        SELECT mo.team_number AS team_number,
               COUNT(*) AS obs_count,
               MAX(mo.observed_at) AS last_observed_at
        FROM match_observations mo
        JOIN matches m ON m.id = mo.match_id
        WHERE m.event_key = ? AND mo.source = 'scout-sheet'
        GROUP BY mo.team_number
      `)
      .all(eventKey) as Array<{
      team_number: number;
      obs_count: number;
      last_observed_at: string | null;
    }>;

    const summary: Record<string, { obsCount: number; lastObservedAt: string | null }> = {};
    for (const row of rows) {
      summary[String(row.team_number)] = {
        obsCount: row.obs_count,
        lastObservedAt: row.last_observed_at
      };
    }

    return { eventKey, summary };
  });
};
