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
};
