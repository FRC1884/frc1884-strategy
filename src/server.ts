import path from "node:path";
import { fileURLToPath } from "node:url";

import fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { seedInitialData } from "./db/seed.js";
import { db } from "./db/client.js";
import { apiRoutes } from "./routes/api.js";
import { integrationRoutes } from "./routes/integrations.js";
import { matchRoutes } from "./routes/matches.js";
import { strategyPlanRoutes } from "./routes/strategyPlans.js";
import { teamRoutes } from "./routes/teams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

const app = fastify({
  logger: true
});

seedInitialData(db);

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/"
});

await app.register(apiRoutes, { prefix: "/api" });
await app.register(teamRoutes, { prefix: "/api" });
await app.register(matchRoutes, { prefix: "/api" });
await app.register(strategyPlanRoutes, { prefix: "/api" });
await app.register(integrationRoutes, { prefix: "/api" });

app.get("/", async (_request, reply) => {
  return reply.sendFile("index.html");
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
