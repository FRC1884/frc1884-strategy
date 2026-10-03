import type { FastifyInstance } from "fastify";

import { hubAuthRoutes } from "./auth.js";
import { hubLiveRoutes } from "./live.js";

// Everything the hub page talks to lives under /api/hub.
export async function hubRoutes(app: FastifyInstance) {
  await app.register(hubAuthRoutes);
  await app.register(hubLiveRoutes);
}
