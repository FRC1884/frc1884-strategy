import type { FastifyPluginAsync } from "fastify";

import { ingestStatboticsEvent } from "../integrations/statbotics.js";

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { eventKey: string };
  }>("/integrations/statbotics/events/:eventKey/ingest", async (request, reply) => {
    try {
      const result = await ingestStatboticsEvent(request.params.eventKey);
      return reply.code(200).send({ ok: true, result });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : "statbotics_ingest_failed"
      });
    }
  });
};
