import { buildApp } from "./app.js";
import { getActiveEvent } from "./hub/settings.js";
import { startAutoSync } from "./hub/sync.js";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  startAutoSync(getActiveEvent, (message) => app.log.warn(message));
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
