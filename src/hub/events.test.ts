import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import { fakeFetch, tbaMatch, TEAMS } from "../../test/fixtures.js";
import { signIn, testApp } from "../../test/helpers.js";
import { db } from "../db/client.js";

let app: FastifyInstance;
let lead: string;
let manager: string;
let scout: string;
const EVENT = "2026test";
const T0 = Math.floor(Date.parse("2026-10-03T09:00:00Z") / 1000);

beforeAll(async () => {
  app = await testApp();
  lead = await signIn(app, "lead");
  manager = await signIn(app, "manager");
  scout = await signIn(app, "scout");
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TBA_API_KEY;
});

afterAll(async () => {
  await app.close();
});

function stubTba() {
  process.env.TBA_API_KEY = "test-key";
  const matches = [
    tbaMatch(EVENT, 1, TEAMS.slice(0, 6), { time: T0, actual: T0 + 600, red: 90, blue: 70 }),
    tbaMatch(EVENT, 2, TEAMS.slice(6, 12), { time: T0 + 480 }),
    tbaMatch(EVENT, 1, TEAMS.slice(0, 6), { time: T0 + 86_400, level: "sf", set: 1 }),
  ];
  vi.stubGlobal("fetch", fakeFetch(EVENT, matches));
}

describe("event setup", () => {
  it("is for leads only", async () => {
    for (const cookie of [scout, manager]) {
      const response = await app.inject({ method: "POST", url: "/api/hub/admin/events", headers: { cookie }, payload: { eventKey: EVENT, gameId: "rebuilt2026" } });
      expect(response.statusCode).toBe(403);
    }
    const anonymous = await app.inject({ method: "GET", url: "/api/hub/admin/overview" });
    expect(anonymous.statusCode).toBe(401);
  });

  it("refuses a write that comes from another website", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/hub/admin/events",
      headers: { cookie: lead, origin: "https://evil.example", host: "griffins1884.org" },
      payload: { eventKey: EVENT, gameId: "rebuilt2026" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("rejects a bad event key or unknown game", async () => {
    const badKey = await app.inject({ method: "POST", url: "/api/hub/admin/events", headers: { cookie: lead }, payload: { eventKey: "Newton!", gameId: "rebuilt2026" } });
    expect(badKey.statusCode).toBe(400);
    const badGame = await app.inject({ method: "POST", url: "/api/hub/admin/events", headers: { cookie: lead }, payload: { eventKey: EVENT, gameId: "chess" } });
    expect(badGame.statusCode).toBe(400);
  });

  it("imports details, teams, schedule with times, playoffs, rankings and stats", async () => {
    stubTba();
    const response = await app.inject({ method: "POST", url: "/api/hub/admin/events", headers: { cookie: lead }, payload: { eventKey: EVENT, gameId: "rebuilt2026" } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sync.steps.every((s: { ok: boolean }) => s.ok)).toBe(true);
    expect(body.event).toMatchObject({ name: "Test Regional", gameId: "rebuilt2026", startDate: "2026-10-01" });

    const schedule = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/schedule`, headers: { cookie: scout } })).json();
    expect(schedule.matches.map((m: { label: string }) => m.label)).toEqual(["Qual 1", "Qual 2", "Semis 1"]);
    expect(schedule.matches[0]).toMatchObject({ redScore: 90, blueScore: 70 });
    expect(schedule.matches[0].actualAt).toBe(new Date((T0 + 600) * 1000).toISOString());
    expect(schedule.matches[0].plannedAt).toBe(new Date(T0 * 1000).toISOString());
    expect(schedule.matches[1].red.map((t: { teamNumber: number }) => t.teamNumber)).toEqual(TEAMS.slice(6, 9));
    expect(schedule.matches[1].red[0].name).toBe("Robot 148");

    const teams = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/teams`, headers: { cookie: scout } })).json();
    expect(teams.teams).toHaveLength(TEAMS.length);

    const ranked = db.prepare(`SELECT COUNT(*) AS n FROM event_rankings WHERE event_key = ?`).get(EVENT) as { n: number };
    expect(ranked.n).toBe(TEAMS.length);

    const session = (await app.inject({ method: "GET", url: "/api/hub/session", headers: { cookie: scout } })).json();
    expect(session.event.eventKey).toBe(EVENT);
  });

  it("keeps scouting figures when public stats are imported again", async () => {
    stubTba();
    db.prepare(
      `INSERT INTO analytics_metrics (event_key, team_number, metric_name, metric_value, source_run) VALUES (?, 1884, 'hub.scoring_cycles', 7, 'hub')`
    ).run(EVENT);
    const response = await app.inject({ method: "POST", url: `/api/hub/admin/events/${EVENT}/sync`, headers: { cookie: lead }, payload: {} });
    expect(response.statusCode).toBe(200);
    const kept = db.prepare(`SELECT metric_value FROM analytics_metrics WHERE event_key = ? AND metric_name = 'hub.scoring_cycles'`).get(EVENT) as { metric_value: number } | undefined;
    expect(kept?.metric_value).toBe(7);
    const epa = db.prepare(`SELECT COUNT(*) AS n FROM analytics_metrics WHERE event_key = ? AND metric_name LIKE 'statbotics.%'`).get(EVENT) as { n: number };
    expect(epa.n).toBeGreaterThan(0);
    const opr = db.prepare(`SELECT COUNT(*) AS n FROM analytics_metrics WHERE event_key = ? AND metric_name = 'tba.opr'`).get(EVENT) as { n: number };
    expect(opr.n).toBe(TEAMS.length);
  });

  it("reports a missing Blue Alliance key instead of failing", async () => {
    vi.stubGlobal("fetch", fakeFetch(EVENT, []));
    const response = await app.inject({ method: "POST", url: `/api/hub/admin/events/${EVENT}/sync`, headers: { cookie: lead }, payload: { statbotics: false } });
    expect(response.json().steps).toEqual([{ step: "The Blue Alliance", ok: false, detail: "The Blue Alliance key is not set on the server." }]);
  });
});

describe("matches entered by hand", () => {
  it("lets a manager add and remove a match, but not a scout", async () => {
    const payload = { compLevel: "pm", matchNumber: 1, plannedAt: "2026-10-01T08:00:00Z", red: [1884, 254, 1678], blue: [118, 2056, 973] };
    const refused = await app.inject({ method: "POST", url: `/api/hub/events/${EVENT}/matches`, headers: { cookie: scout }, payload });
    expect(refused.statusCode).toBe(403);

    const created = await app.inject({ method: "POST", url: `/api/hub/events/${EVENT}/matches`, headers: { cookie: manager }, payload });
    expect(created.json().matchKey).toBe(`${EVENT}_pm1`);
    const schedule = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/schedule`, headers: { cookie: scout } })).json();
    expect(schedule.matches[0].label).toBe("Practice 1");

    const duplicate = await app.inject({ method: "POST", url: `/api/hub/events/${EVENT}/matches`, headers: { cookie: manager }, payload: { ...payload, matchNumber: 2, blue: [1884, 2056, 973] } });
    expect(duplicate.statusCode).toBe(400);

    const removed = await app.inject({ method: "DELETE", url: `/api/hub/events/${EVENT}/matches/${EVENT}_pm1`, headers: { cookie: manager } });
    expect(removed.statusCode).toBe(200);
    const official = await app.inject({ method: "DELETE", url: `/api/hub/events/${EVENT}/matches/${EVENT}_qm1`, headers: { cookie: manager } });
    expect(official.statusCode).toBe(404);
  });
});
