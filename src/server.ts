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
import { scoutVideoRoutes } from "./routes/scout.js";
import { authRoutes } from "./routes/auth.js";
import { authRoutes } from "./routes/auth.js";

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
await app.register(scoutVideoRoutes, { prefix: "/api" });
await app.register(authRoutes, { prefix: "/api" });
await app.register(authRoutes, { prefix: "/api" });

app.get("/", async (_request, reply) => {
  return reply.sendFile("index.html");
});

app.get("/strategy", async (_request, reply) => {
  return reply.sendFile("strategy/index.html");
});

app.get("/strategy/", async (_request, reply) => {
  return reply.sendFile("strategy/index.html");
});

// The app is served at BOTH paths (no cross-path redirects).
// WHY: production nginx includes a server-side snippet
// (/etc/nginx/snippets/frc1884-scouting.locations.conf, not in this repo) that
// claims `location /scouting` for the old scouting service. Until that snippet
// is retired on the host (see docs/DEPLOY_NOTES.md), /scouting on the live site
// goes to the old app — so /scouting2 must work fully standalone, including its
// CSS/JS assets (which the old snippet would otherwise swallow under /scouting/*).
app.get("/scouting", async (_request, reply) => {
  return reply.redirect("/scouting/", 302); // same-path slash redirect so relative assets resolve
});

app.get("/scouting/", async (_request, reply) => {
  return reply.sendFile("scouting/index.html");
});

app.get("/scouting2", async (_request, reply) => {
  return reply.redirect("/scouting2/", 302);
});

// Full alias: guaranteed to show the new app even if the host's legacy nginx
// snippet still claims /scouting (see docs/DEPLOY_NOTES.md). Relative asset
// URLs resolve under /scouting2/, and the wildcard below maps them to the
// physical public/scouting/ files — so this path works fully standalone.
app.get("/scouting2/", async (_request, reply) => {
  return reply.sendFile("scouting/index.html");
});

// Assets for the /scouting2/ alias map onto the physical public/scouting dir.
app.get<{ Params: { "*": string } }>("/scouting2/*", async (request, reply) => {
  return reply.sendFile(`scouting/${request.params["*"]}`);
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
