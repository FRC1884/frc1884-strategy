import type { FastifyInstance } from "fastify";

import { hubAdminRoutes } from "./admin.js";
import { hubAuthRoutes } from "./auth.js";
import { hubLiveRoutes } from "./live.js";
import { hubScheduleRoutes } from "./schedule.js";

// Everything the hub page talks to lives under /api/hub.
export async function hubRoutes(app: FastifyInstance) {
  await app.register(hubAuthRoutes);
  await app.register(hubLiveRoutes);
  await app.register(hubScheduleRoutes);
  await app.register(hubAdminRoutes);
}
