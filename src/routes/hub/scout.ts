import type { FastifyInstance } from "fastify";

import { db } from "../../db/client.js";
import { recordActivity } from "../../hub/activity.js";
import { HORIZON, loadAssignments, reassign } from "../../hub/assign.js";
import { publish } from "../../hub/changeFeed.js";
import { entriesForScout, getEntry, saveEntry } from "../../hub/entries.js";
import { touch } from "../../hub/presence.js";
import { loadSchedule } from "../../hub/schedule.js";
import { requirePermission, scoutKey } from "../../hub/session.js";
import { getEvent } from "../../hub/settings.js";
import { getGame } from "../../shared/games/index.js";
import { can } from "../../shared/roles.js";
import { matchClock, teamsIn } from "../../shared/schedule.js";

function scoutState(key: string): { scouting: boolean; onBreak: boolean } {
  const row = db
    .prepare(`SELECT MAX(scouting) AS scouting, MAX(on_break) AS on_break FROM scout_sessions WHERE scout_key = ? AND signed_out_at IS NULL`)
    .get(key) as { scouting: number | null; on_break: number | null };
  return { scouting: row.scouting === 1, onBreak: row.on_break === 1 };
}

export async function hubScoutRoutes(app: FastifyInstance) {
  const guard = { preHandler: requirePermission("scout") };

  // Everything a scout's home screen needs: their robots for the next matches
  // and the entries they have started.
  app.get<{ Params: { eventKey: string } }>("/events/:eventKey/my", guard, async (request, reply) => {
    const user = request.hubUser!;
    const { eventKey } = request.params;
    const event = getEvent(eventKey);
    if (!event) return reply.code(404).send({ error: "event_not_found" });
    touch(user.sid);
    const now = Date.now();
    reassign(eventKey, now);

    const key = scoutKey(user.name);
    const schedule = loadSchedule(eventKey);
    const byKey = new Map(schedule.map((m) => [m.matchKey, m]));
    const clock = matchClock(schedule, now, getGame(event.gameId).matchSeconds);
    const horizon = clock.upcoming.slice(0, HORIZON);
    const entries = entriesForScout(eventKey, key);
    const mine = loadAssignments(eventKey, horizon.map((m) => m.matchKey)).filter((a) => a.scoutKey === key);

    const assignments = horizon.flatMap((match) => {
      const slot = mine.find((a) => a.matchKey === match.matchKey);
      if (!slot) return [];
      const team = teamsIn(match).find((t) => t.teamNumber === slot.teamNumber);
      const entry = entries.find((e) => e.matchKey === match.matchKey && e.teamNumber === slot.teamNumber);
      const start = clock.startsAt[match.matchKey] ?? null;
      return [
        {
          matchKey: match.matchKey,
          label: match.label,
          alliance: slot.alliance,
          station: slot.station,
          teamNumber: slot.teamNumber,
          teamName: team?.name ?? null,
          startsAt: start,
          started: start !== null && start <= now,
          entry: entry ? { id: entry.id, status: entry.status, updatedAt: entry.updatedAt } : null,
        },
      ];
    });

    const state = scoutState(key);
    return {
      serverTime: new Date(now).toISOString(),
      scout: { name: user.name, role: user.role, ...state },
      nextMatch: horizon[0] ? { matchKey: horizon[0].matchKey, label: horizon[0].label, startsAt: clock.startsAt[horizon[0].matchKey] ?? null } : null,
      assignments,
      entries: entries.slice(0, 40).map((entry) => ({
        id: entry.id,
        matchKey: entry.matchKey,
        label: byKey.get(entry.matchKey)?.label ?? entry.matchKey,
        teamNumber: entry.teamNumber,
        status: entry.status,
        updatedAt: entry.updatedAt,
        submittedAt: entry.submittedAt,
      })),
    };
  });

  app.get<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/entries/:id", guard, async (request, reply) => {
    const user = request.hubUser!;
    const entry = getEntry(request.params.id);
    if (!entry || entry.eventKey !== request.params.eventKey) return reply.code(404).send({ error: "entry_not_found" });
    if (entry.scoutKey !== scoutKey(user.name) && !can(user.role, "manage")) return reply.code(403).send({ error: "not_your_entry" });
    return { entry };
  });

  // Save a draft or submit. Phones call this every few seconds while a scout types.
  app.put<{ Params: { eventKey: string; id: string } }>("/events/:eventKey/entries/:id", guard, async (request, reply) => {
    const user = request.hubUser!;
    const body = (request.body ?? {}) as { matchKey?: unknown; teamNumber?: unknown; data?: unknown; status?: unknown };
    if (typeof body.matchKey !== "string" || !Number.isInteger(body.teamNumber)) {
      return reply.code(400).send({ error: "invalid_entry" });
    }
    touch(user.sid);
    const result = saveEntry({
      id: request.params.id,
      eventKey: request.params.eventKey,
      matchKey: body.matchKey,
      teamNumber: body.teamNumber as number,
      scout: user.name,
      data: body.data,
      status: body.status === "submitted" ? "submitted" : "draft",
    });
    if (!result.ok) return reply.code(result.status).send({ error: result.error, details: result.details });
    return { entry: result.entry };
  });

  // Take a break, or (for people who are not scouts by role) join the scouting rota.
  app.put("/me", guard, async (request) => {
    const user = request.hubUser!;
    const key = scoutKey(user.name);
    const body = (request.body ?? {}) as { onBreak?: unknown; scouting?: unknown; eventKey?: unknown };
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : null;
    if (typeof body.onBreak === "boolean") {
      db.prepare(`UPDATE scout_sessions SET on_break = ? WHERE scout_key = ? AND signed_out_at IS NULL`).run(body.onBreak ? 1 : 0, key);
      recordActivity({ eventKey, scout: user.name, kind: body.onBreak ? "break_on" : "break_off" });
    }
    if (typeof body.scouting === "boolean") {
      db.prepare(`UPDATE scout_sessions SET scouting = ? WHERE scout_key = ? AND signed_out_at IS NULL`).run(body.scouting ? 1 : 0, key);
    }
    publish({ eventKey: null, entity: "presence", key: user.sid, audience: ["manage"] });
    if (eventKey && getEvent(eventKey)) reassign(eventKey);
    return { scout: { name: user.name, role: user.role, ...scoutState(key) } };
  });
}
