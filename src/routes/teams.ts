import type { FastifyPluginAsync } from "fastify";

import { db } from "../db/client.js";

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { eventKey: string };
    Querystring: { q?: string };
  }>("/events/:eventKey/teams", async (request) => {
    const search = request.query.q?.trim().toLowerCase();

    const rows = db
      .prepare(`
        SELECT
          t.team_number,
          t.name,
          t.location,
          t.country,
          et.imported_at
        FROM event_teams et
        JOIN teams t ON t.team_number = et.team_number
        WHERE et.event_key = ?
        ORDER BY t.team_number ASC
      `)
      .all(request.params.eventKey) as Array<{
      team_number: number;
      name: string;
      location: string | null;
      country: string | null;
      imported_at: string;
    }>;

    const filteredRows = search
      ? rows.filter((row) => {
          return (
            row.team_number.toString().includes(search) ||
            row.name.toLowerCase().includes(search) ||
            (row.location ?? "").toLowerCase().includes(search)
          );
        })
      : rows;

    return { teams: filteredRows };
  });

  app.get<{
    Params: { teamNumber: string };
    Querystring: { eventKey?: string };
  }>("/teams/:teamNumber", async (request, reply) => {
    const teamNumber = Number(request.params.teamNumber);

    if (!Number.isInteger(teamNumber)) {
      return reply.code(400).send({ error: "invalid_team_number" });
    }

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

    const analytics = db
      .prepare(`
        SELECT event_key, metric_name, metric_value, source_run, computed_at
        FROM analytics_metrics
        WHERE team_number = ?
          AND (? IS NULL OR event_key = ?)
        ORDER BY computed_at DESC, metric_name ASC
      `)
      .all(teamNumber, request.query.eventKey ?? null, request.query.eventKey ?? null);

    return {
      team,
      analytics
    };
  });
};
