import type { FastifyInstance } from "fastify";

import { getActiveEvent } from "../../hub/settings.js";
import {
  cleanName,
  clearSessionCookie,
  configuredRoles,
  createSession,
  currentUser,
  endSession,
  recordFailure,
  roleForCode,
  setSessionCookie,
  tooManyFailures,
} from "../../hub/session.js";
import { recordActivity } from "../../hub/activity.js";
import { publish } from "../../hub/changeFeed.js";

export async function hubAuthRoutes(app: FastifyInstance) {
  // Who am I, and which event is the team working on.
  app.get("/session", async (request) => {
    const user = currentUser(request);
    return {
      user: user ? { name: user.name, role: user.role } : null,
      event: user ? getActiveEvent() : null,
      signInReady: configuredRoles().length > 0,
    };
  });

  app.post("/session", async (request, reply) => {
    const body = (request.body ?? {}) as { code?: unknown; name?: unknown };
    if (configuredRoles().length === 0) {
      return reply.code(503).send({ error: "codes_not_configured" });
    }
    if (tooManyFailures(request.ip)) {
      return reply.code(429).send({ error: "too_many_attempts" });
    }
    const name = cleanName(body.name);
    if (!name) return reply.code(400).send({ error: "name_required" });
    const role = typeof body.code === "string" ? roleForCode(body.code) : null;
    if (!role) {
      recordFailure(request.ip);
      return reply.code(401).send({ error: "wrong_code" });
    }
    const user = createSession(name, role);
    setSessionCookie(request, reply, user);
    recordActivity({ eventKey: getActiveEvent()?.eventKey ?? null, scout: user.name, kind: "signed_in" });
    publish({ eventKey: null, entity: "presence", key: user.sid, op: "signed_in", audience: ["manage"] });
    return { user: { name: user.name, role: user.role }, event: getActiveEvent() };
  });

  app.delete("/session", async (request, reply) => {
    const user = currentUser(request);
    if (user) {
      endSession(user.sid);
      recordActivity({ eventKey: getActiveEvent()?.eventKey ?? null, scout: user.name, kind: "signed_out" });
      publish({ eventKey: null, entity: "presence", key: user.sid, op: "signed_out", audience: ["manage"] });
    }
    clearSessionCookie(request, reply);
    return { ok: true };
  });
}
