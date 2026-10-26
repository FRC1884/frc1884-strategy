import type { FastifyInstance } from "fastify";

import { entriesCsv, loadEventData, pitCsv, teamsCsv } from "../../hub/compile.js";
import { getPit, listPit, savePit } from "../../hub/pit.js";
import { touch } from "../../hub/presence.js";
import { loadTeams } from "../../hub/schedule.js";
import { requirePermission, scoutKey } from "../../hub/session.js";
import { getEvent } from "../../hub/settings.js";
import { can } from "../../shared/roles.js";

export async function hubPitRoutes(app: FastifyInstance) {
  const guard = { preHandler: requirePermission("scout") };

  // Which teams have been visited in the pits, and the caller's own entries.
  app.get<{ Params: { eventKey: string } }>("/events/:eventKey/pit", guard, async (request, reply) => {
    const user = request.hubUser!;
    const { eventKey } = request.params;
    if (!getEvent(eventKey)) return reply.code(404).send({ error: "event_not_found" });
    const key = scoutKey(user.name);
    const entries = listPit(eventKey).filter((e) => e.status !== "void");
    const seeAll = can(user.role, "manage") || can(user.role, "strategy");
    return {
      teams: loadTeams(eventKey).map((team) => {
        const forTeam = entries.filter((e) => e.teamNumber === team.teamNumber);
        const mine = forTeam.find((e) => e.scoutKey === key);
        return {
          teamNumber: team.teamNumber,
          name: team.name,
          done: forTeam.filter((e) => e.status === "submitted").length,
          scouts: forTeam.filter((e) => e.status === "submitted").map((e) => e.scout),
          mine: mine ? { id: mine.id, status: mine.status } : null,
          entries: seeAll ? forTeam : undefined,
        };
      }),
    };
  });

  app.get<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/pit/:id", guard, async (request, reply) => {
    const user = request.hubUser!;
    const entry = getPit(request.params.id);
    if (!entry || entry.eventKey !== request.params.eventKey) return reply.code(404).send({ error: "entry_not_found" });
    if (entry.scoutKey !== scoutKey(user.name) && !can(user.role, "manage") && !can(user.role, "strategy")) {
      return reply.code(403).send({ error: "not_your_entry" });
    }
    return { entry };
  });

  app.put<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/pit/:id", guard, async (request, reply) => {
    const user = request.hubUser!;
    const body = (request.body ?? {}) as { teamNumber?: unknown; data?: unknown; status?: unknown };
    if (!Number.isInteger(body.teamNumber)) return reply.code(400).send({ error: "invalid_entry" });
    touch(user.sid);
    const result = savePit({
      id: request.params.id,
      eventKey: request.params.eventKey,
      teamNumber: body.teamNumber as number,
      scout: user.name,
      data: body.data,
      status: body.status === "submitted" ? "submitted" : "draft",
    });
    if (!result.ok) return reply.code(result.status).send({ error: result.error, details: result.details });
    return { entry: result.entry };
  });

  // Spreadsheet downloads for managers and strategists.
  app.get<{ Params: { eventKey: string; file: string } }>(
    "/events/:eventKey/export/:file",
    { preHandler: requirePermission(["manage", "strategy"]) },
    async (request, reply) => {
      const { eventKey, file } = request.params;
      const data = loadEventData(eventKey);
      if (!data) return reply.code(404).send({ error: "event_not_found" });
      const builders: Record<string, () => string> = {
        "teams.csv": () => teamsCsv(data),
        "entries.csv": () => entriesCsv(data),
        "pit.csv": () => pitCsv(data),
      };
      const build = builders[file];
      if (!build) return reply.code(404).send({ error: "unknown_export" });
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${eventKey}-${file}"`)
        .send("﻿" + build());
    }
  );
}
