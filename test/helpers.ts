import type { FastifyInstance } from "fastify";
import type { Role } from "../src/shared/roles.js";

const CODES: Record<Role, string> = {
  scout: "scout-code",
  manager: "manager-code",
  strategist: "strategist-code",
  lead: "lead-code",
};

// Signs in through the real route and returns the cookie header to send back.
export async function signIn(app: FastifyInstance, role: Role, name = `${role} tester`): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/hub/session", payload: { name, code: CODES[role] } });
  if (response.statusCode !== 200) throw new Error(`sign-in failed: ${response.statusCode} ${response.body}`);
  const header = response.headers["set-cookie"];
  const cookie = Array.isArray(header) ? header[0] : header;
  return String(cookie).split(";")[0];
}

export async function testApp(): Promise<FastifyInstance> {
  const { buildApp } = await import("../src/app.js");
  const app = await buildApp({ logger: false, seed: false });
  await app.ready();
  return app;
}
