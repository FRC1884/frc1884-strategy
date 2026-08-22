import type { FastifyPluginAsync } from "fastify";

import {
  AuthSheetMissingError,
  checkLogin,
  isAuthSheetConfigured,
  loadRoster,
} from "../integrations/authSheet.js";
import { hashPassword } from "../integrations/passwords.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Lets the frontend decide between live login (sheet configured) and demo mode.
  app.get("/auth/status", async () => {
    return { configured: isAuthSheetConfigured() };
  });

  // POST { username, password } -> 200 { name, role } | 401 | 503 (no sheet)
  app.post<{ Body: { username?: string; password?: string } }>("/login", async (request, reply) => {
    const username = request.body?.username ?? "";
    const password = request.body?.password ?? "";
    if (!username || !password) {
      return reply.code(400).send({ error_code: "missing_credentials" });
    }
    try {
      const user = await checkLogin(username, password);
      if (!user) return reply.code(401).send({ error_code: "invalid_credentials" });
      return { name: user.name, role: user.role };
    } catch (error) {
      if (error instanceof AuthSheetMissingError) {
        return reply.code(503).send({ error_code: "auth_sheet_not_configured" });
      }
      request.log.error(error);
      return reply.code(502).send({ error_code: "auth_sheet_unreachable" });
    }
  });

  // Force a re-fetch of the roster (e.g. right after editing the sheet).
  app.post("/auth/refresh", async (request, reply) => {
    try {
      const roster = await loadRoster(true);
      return { ok: true, users: roster.length };
    } catch (error) {
      if (error instanceof AuthSheetMissingError) {
        return reply.code(503).send({ error_code: "auth_sheet_not_configured" });
      }
      request.log.error(error);
      return reply.code(502).send({ error_code: "auth_sheet_unreachable" });
    }
  });

  // Generate an scrypt hash to paste into the roster sheet's password column.
  // Harmless to expose: a hash grants nothing unless YOU put it in the sheet.
  // Used by /scouting/hash.html, curl, or the npm script.
  app.post<{ Body: { password?: string } }>("/auth/hash", async (request, reply) => {
    const password = request.body?.password ?? "";
    if (!password) return reply.code(400).send({ error_code: "missing_password" });
    if (password.length < 6) return reply.code(400).send({ error_code: "password_too_short", min: 6 });
    return { hash: await hashPassword(password) };
  });
};
