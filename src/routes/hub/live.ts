import type { FastifyInstance } from "fastify";

import { canSee, changesSince, latestSeq, subscribe, type Change } from "../../hub/changeFeed.js";
import { streamClosed, streamOpened, touch } from "../../hub/presence.js";
import { reassign } from "../../hub/assign.js";
import { requirePermission } from "../../hub/session.js";

const HEARTBEAT_MS = 20_000;

function frame(change: Change): string {
  const data = JSON.stringify({ entity: change.entity, key: change.key, op: change.op, payload: change.payload, at: change.at });
  return `id: ${change.seq}\nevent: change\ndata: ${data}\n\n`;
}

export async function hubLiveRoutes(app: FastifyInstance) {
  // Server-sent events. The browser reconnects by itself and sends the last
  // id it saw, so it is caught up on anything it missed.
  app.get<{ Params: { eventKey: string }; Querystring: { after?: string } }>(
    "/events/:eventKey/stream",
    { preHandler: requirePermission("scout") },
    async (request, reply) => {
      const user = request.hubUser!;
      const { eventKey } = request.params;
      const lastSeen = Number(request.headers["last-event-id"] ?? request.query.after ?? NaN);

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      res.write(`retry: 3000\n\n`);

      if (Number.isFinite(lastSeen)) {
        const missed = changesSince(lastSeen, eventKey, user.role);
        if (missed === null) {
          res.write(`id: ${latestSeq()}\nevent: reset\ndata: {}\n\n`);
        } else {
          for (const change of missed) res.write(frame(change));
        }
      } else {
        res.write(`id: ${latestSeq()}\nevent: ready\ndata: {}\n\n`);
      }

      const unsubscribe = subscribe((change) => {
        if (change.eventKey !== null && change.eventKey !== eventKey) return;
        if (!canSee(user.role, change)) return;
        res.write(frame(change));
      });

      streamOpened(user.sid);
      // Someone coming online may be given a robot straight away.
      try {
        reassign(eventKey);
      } catch (error) {
        request.log.warn({ error }, "reassign on connect failed");
      }
      const heartbeat = setInterval(() => {
        res.write(`: keep-alive\n\n`);
        touch(user.sid);
      }, HEARTBEAT_MS);

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        streamClosed(user.sid);
      };
      request.raw.on("close", close);
      res.on("error", close);
    }
  );
}
