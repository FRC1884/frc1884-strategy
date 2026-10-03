import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

import { seedInitialData } from "./db/seed.js";
import { db } from "./db/client.js";
import { resetPresence } from "./hub/presence.js";
import { apiRoutes } from "./routes/api.js";
import { hubRoutes } from "./routes/hub/index.js";
import { integrationRoutes } from "./routes/integrations.js";
import { matchRoutes } from "./routes/matches.js";
import { strategyPlanRoutes } from "./routes/strategyPlans.js";
import { teamRoutes } from "./routes/teams.js";
import { scoutVideoRoutes } from "./routes/scout.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

export interface BuildOptions {
  logger?: boolean;
  seed?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: options.logger ?? true,
    // In production nginx on the same host forwards requests.
    trustProxy: "127.0.0.1",
  });

  if (options.seed ?? true) seedInitialData(db);
  resetPresence();

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/"
  });

  await app.register(apiRoutes, { prefix: "/api" });
  await app.register(teamRoutes, { prefix: "/api" });
  await app.register(matchRoutes, { prefix: "/api" });
  await app.register(strategyPlanRoutes, { prefix: "/api" });
  await app.register(integrationRoutes, { prefix: "/api" });
  await app.register(scoutVideoRoutes, { prefix: "/api" });
  await app.register(hubRoutes, { prefix: "/api/hub" });

  app.get("/", async (_request, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/strategy", async (_request, reply) => {
    return reply.sendFile("strategy/index.html");
  });

  app.get("/strategy/", async (_request, reply) => {
    return reply.sendFile("strategy/index.html");
  });

  app.get("/scouting", async (_request, reply) => {
    return reply.sendFile("scouting/index.html");
  });

  app.get("/scouting/", async (_request, reply) => {
    return reply.sendFile("scouting/index.html");
  });

  app.get("/scouting2", async (_request, reply) => {
    return reply.redirect("/scouting", 301);
  });

  app.get("/scouting2/", async (_request, reply) => {
    return reply.redirect("/scouting", 301);
  });

  // The hub is a single page that handles its own navigation, so every
  // address under /hub that is not a built file gets the page itself.
  const hubIndex = path.join(publicDir, "hub", "index.html");
  const sendHub = async (_request: unknown, reply: import("fastify").FastifyReply) => {
    if (!fs.existsSync(hubIndex)) {
      return reply.code(503).type("text/plain").send("The hub has not been built yet. Run: npm run build");
    }
    return reply.header("cache-control", "no-cache").sendFile("hub/index.html");
  };
  app.get("/hub", sendHub);
  app.get("/hub/", sendHub);
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.raw.url ?? "";
    if (request.method === "GET" && url.startsWith("/hub/") && !url.startsWith("/hub/assets/")) {
      return sendHub(request, reply);
    }
    return reply.code(404).send({ message: `Route ${request.method}:${url} not found`, error: "Not Found", statusCode: 404 });
  });

  return app;
}
