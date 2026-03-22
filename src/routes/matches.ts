import type { FastifyPluginAsync } from "fastify";

import { hydrateMatchesForEvent } from "./helpers.js";

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { eventKey: string };
  }>("/events/:eventKey/matches", async (request) => {
    return {
      matches: hydrateMatchesForEvent(request.params.eventKey)
    };
  });

  app.get<{
    Params: { eventKey: string; matchKey: string };
  }>("/events/:eventKey/matches/:matchKey", async (request, reply) => {
    const match = hydrateMatchesForEvent(request.params.eventKey).find(
      (entry) => entry.matchKey === request.params.matchKey
    );

    if (!match) {
      return reply.code(404).send({ error: "match_not_found" });
    }

    return { match };
  });
};
