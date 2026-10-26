import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { signIn, testApp } from "../../test/helpers.js";
import { db } from "../db/client.js";
import { runMigrations } from "../db/migrations.js";
import { changesSince, publish, subscribe } from "./changeFeed.js";
import { decodeSession, encodeSession, resetFailures, roleForCode } from "./session.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await testApp();
});

afterAll(async () => {
  await app.close();
});

describe("migrations", () => {
  it("run once and are not repeated", () => {
    expect(runMigrations(db)).toEqual([]);
    const columns = db.prepare(`PRAGMA table_info(events)`).all() as Array<{ name: string }>;
    expect(columns.map((c) => c.name)).toContain("game_id");
  });
});

describe("session tokens", () => {
  const user = { sid: "abc", name: "Maya", role: "scout" as const };

  it("round-trips a signed session", () => {
    expect(decodeSession(encodeSession(user))).toEqual(user);
  });

  it("rejects a tampered or expired token", () => {
    const token = encodeSession(user);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...user, role: "lead", iat: Date.now() })).toString("base64url");
    expect(decodeSession(`${forged}.${signature}`)).toBeNull();
    expect(decodeSession(`${payload}.${signature.slice(0, -2)}xx`)).toBeNull();
    expect(decodeSession(encodeSession(user, Date.now() - 8 * 86_400_000))).toBeNull();
  });

  it("maps each code to its role", () => {
    expect(roleForCode("scout-code")).toBe("scout");
    expect(roleForCode("manager-code")).toBe("manager");
    expect(roleForCode("strategist-code")).toBe("strategist");
    expect(roleForCode(" lead-code ")).toBe("lead");
    expect(roleForCode("nope")).toBeNull();
    expect(roleForCode("")).toBeNull();
  });
});

describe("sign-in route", () => {
  it("refuses a wrong code and a missing name", async () => {
    const wrong = await app.inject({ method: "POST", url: "/api/hub/session", payload: { name: "Maya", code: "guess" } });
    expect(wrong.statusCode).toBe(401);
    const noName = await app.inject({ method: "POST", url: "/api/hub/session", payload: { name: " ", code: "scout-code" } });
    expect(noName.statusCode).toBe(400);
  });

  it("signs in, reports the session, and signs out", async () => {
    const cookie = await signIn(app, "manager", "Jordi");
    const session = await app.inject({ method: "GET", url: "/api/hub/session", headers: { cookie } });
    expect(session.json().user).toEqual({ name: "Jordi", role: "manager" });

    await app.inject({ method: "DELETE", url: "/api/hub/session", headers: { cookie } });
    const after = await app.inject({ method: "GET", url: "/api/hub/session", headers: { cookie } });
    expect(after.json().user).toBeNull();
  });

  it("locks out an address after repeated wrong codes", async () => {
    resetFailures();
    for (let i = 0; i < 8; i++) {
      await app.inject({ method: "POST", url: "/api/hub/session", payload: { name: "Guesser", code: `try-${i}` } });
    }
    const blocked = await app.inject({ method: "POST", url: "/api/hub/session", payload: { name: "Guesser", code: "scout-code" } });
    expect(blocked.statusCode).toBe(429);
    resetFailures();
  });
});

describe("change feed", () => {
  it("delivers a change to subscribers and stores it for catch-up", async () => {
    const seen: string[] = [];
    const stop = subscribe((change) => seen.push(`${change.entity}:${change.key}`));
    const first = publish({ eventKey: "2026test", entity: "entry", key: "e1", audience: ["manage", "strategy"] });
    publish({ eventKey: "2026test", entity: "assignment", key: "qm1", audience: ["scout"] });
    publish({ eventKey: "2026other", entity: "entry", key: "e2", audience: ["manage"] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    stop();
    expect(seen).toEqual(["entry:e1", "assignment:qm1", "entry:e2"]);

    const forManager = changesSince(first.seq - 1, "2026test", "manager")!;
    expect(forManager.map((c) => c.key)).toEqual(["e1", "qm1"]);
    const forScout = changesSince(first.seq - 1, "2026test", "scout")!;
    expect(forScout.map((c) => c.key)).toEqual(["qm1"]);
  });

  it("tells a client to reload when it missed too much", () => {
    for (let i = 0; i < 6; i++) publish({ eventKey: "2026test", entity: "entry", key: `bulk${i}`, audience: ["scout"] });
    expect(changesSince(0, "2026test", "lead", 3)).toBeNull();
  });
});

describe("hub page", () => {
  it("answers any /hub address with the page, or says it is not built", async () => {
    const response = await app.inject({ method: "GET", url: "/hub/strategy/team/1884" });
    expect([200, 503]).toContain(response.statusCode);
    const api = await app.inject({ method: "GET", url: "/api/hub/nothing-here" });
    expect(api.statusCode).toBe(404);
  });
});
