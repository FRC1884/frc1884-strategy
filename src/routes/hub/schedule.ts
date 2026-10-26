import type { FastifyInstance } from "fastify";

import { reassign } from "../../hub/assign.js";
import { publish } from "../../hub/changeFeed.js";
import { deleteManualMatch, loadSchedule, loadTeams, saveManualMatch, setMarkedPlayed } from "../../hub/schedule.js";
import { requirePermission } from "../../hub/session.js";
import { getEvent, getSetting } from "../../hub/settings.js";

function teamList(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const teams = value.map((v) => Number(v));
  if (teams.some((n) => !Number.isInteger(n) || n <= 0 || n > 99_999)) return null;
  return teams;
}

export async function hubScheduleRoutes(app: FastifyInstance) {
  app.get<{ Params: { eventKey: string } }>(
    "/events/:eventKey/schedule",
    { preHandler: requirePermission("scout") },
    async (request, reply) => {
      const { eventKey } = request.params;
      if (!getEvent(eventKey)) return reply.code(404).send({ error: "event_not_found" });
      return {
        eventKey,
        ourTeam: Number(getSetting("team_number") ?? 1884),
        serverTime: new Date().toISOString(),
        matches: loadSchedule(eventKey),
      };
    }
  );

  app.get<{ Params: { eventKey: string } }>(
    "/events/:eventKey/teams",
    { preHandler: requirePermission("scout") },
    async (request, reply) => {
      const { eventKey } = request.params;
      if (!getEvent(eventKey)) return reply.code(404).send({ error: "event_not_found" });
      return { eventKey, teams: loadTeams(eventKey) };
    }
  );

  // Matches typed in by hand, for before the official schedule is published.
  app.post<{ Params: { eventKey: string } }>(
    "/events/:eventKey/matches",
    { preHandler: requirePermission("manage") },
    async (request, reply) => {
      const { eventKey } = request.params;
      if (!getEvent(eventKey)) return reply.code(404).send({ error: "event_not_found" });
      const body = (request.body ?? {}) as Record<string, unknown>;
      const compLevel = body.compLevel === "pm" ? "pm" : body.compLevel === "qm" ? "qm" : null;
      const matchNumber = Number(body.matchNumber);
      const red = teamList(body.red);
      const blue = teamList(body.blue);
      const plannedAt = typeof body.plannedAt === "string" && !Number.isNaN(Date.parse(body.plannedAt)) ? new Date(body.plannedAt).toISOString() : null;
      if (!compLevel || !Number.isInteger(matchNumber) || matchNumber <= 0 || matchNumber > 999 || !red || !blue) {
        return reply.code(400).send({ error: "invalid_match" });
      }
      if (new Set([...red, ...blue]).size !== 6) return reply.code(400).send({ error: "duplicate_team" });
      const matchKey = saveManualMatch(eventKey, { compLevel, matchNumber, plannedAt, red, blue });
      publish({ eventKey, entity: "schedule", key: matchKey, audience: ["scout"] });
      reassign(eventKey);
      return { matchKey };
    }
  );

  app.delete<{ Params: { eventKey: string; matchKey: string } }>(
    "/events/:eventKey/matches/:matchKey",
    { preHandler: requirePermission("manage") },
    async (request, reply) => {
      const { eventKey, matchKey } = request.params;
      if (!deleteManualMatch(eventKey, matchKey)) return reply.code(404).send({ error: "manual_match_not_found" });
      publish({ eventKey, entity: "schedule", key: matchKey, op: "delete", audience: ["scout"] });
      return { ok: true };
    }
  );

  // Lets a manager move scouting on when a match was played but no result has arrived.
  app.put<{ Params: { eventKey: string; matchKey: string } }>(
    "/events/:eventKey/matches/:matchKey/played",
    { preHandler: requirePermission("manage") },
    async (request, reply) => {
      const { eventKey, matchKey } = request.params;
      const played = (request.body as { played?: unknown } | null)?.played !== false;
      if (!setMarkedPlayed(eventKey, matchKey, played)) return reply.code(404).send({ error: "match_not_found" });
      publish({ eventKey, entity: "schedule", key: matchKey, audience: ["scout"] });
      reassign(eventKey);
      return { ok: true };
    }
  );
}
