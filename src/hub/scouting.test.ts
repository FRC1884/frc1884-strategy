import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { signIn, testApp } from "../../test/helpers.js";
import { db } from "../db/client.js";
import { rebuilt2026 } from "../shared/games/rebuilt2026.js";
import { compileTeam, summariseMetric } from "./aggregate.js";
import { loadAssignments, reassign } from "./assign.js";
import { saveManualMatch } from "./schedule.js";

let app: FastifyInstance;
const EVENT = "2026scout";
const START = Date.now() + 5 * 60_000;
const TEAMS = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];

const COMPLETE = { auto_leave: "bump", scoring_cycles: 6, teleop_fuel: 40, climb_level: "l2", scoring_rating: "good", defence_rating: "no_evidence" };

beforeAll(async () => {
  app = await testApp();
  db.prepare(`INSERT INTO events (event_key, name, season, game_id) VALUES (?, 'Scout test', 2026, 'rebuilt2026')`).run(EVENT);
  for (let i = 0; i < 4; i++) {
    const teams = i % 2 === 0 ? TEAMS.slice(0, 6) : TEAMS.slice(6);
    saveManualMatch(EVENT, { compLevel: "qm", matchNumber: i + 1, plannedAt: new Date(START + i * 8 * 60_000).toISOString(), red: teams.slice(0, 3), blue: teams.slice(3) });
  }
});

afterAll(async () => {
  await app.close();
});

async function my(cookie: string) {
  return (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/my`, headers: { cookie } })).json();
}

describe("automatic assignment", () => {
  it("gives each scout a different robot in the next match as soon as they sign in", async () => {
    const ana = await signIn(app, "scout", "Ana");
    const ben = await signIn(app, "scout", "Ben");
    const first = await my(ana);
    const second = await my(ben);
    expect(first.assignments).toHaveLength(3);
    expect(first.assignments[0].label).toBe("Qual 1");
    expect(first.assignments[0].started).toBe(false);
    expect(second.assignments[0].matchKey).toBe(first.assignments[0].matchKey);
    expect(second.assignments[0].teamNumber).not.toBe(first.assignments[0].teamNumber);
    expect(first.nextMatch.label).toBe("Qual 1");
  });

  it("does not assign robots to managers or strategists unless they join in", async () => {
    const manager = await signIn(app, "manager", "Mo");
    expect((await my(manager)).assignments).toHaveLength(0);
    await app.inject({ method: "PUT", url: "/api/hub/me", headers: { cookie: manager }, payload: { scouting: true, eventKey: EVENT } });
    expect((await my(manager)).assignments).toHaveLength(3);
  });

  it("frees a scout's robots when they take a break and gives them back after", async () => {
    const cy = await signIn(app, "scout", "Cy");
    expect((await my(cy)).assignments.length).toBeGreaterThan(0);
    await app.inject({ method: "PUT", url: "/api/hub/me", headers: { cookie: cy }, payload: { onBreak: true, eventKey: EVENT } });
    const resting = await my(cy);
    expect(resting.scout.onBreak).toBe(true);
    expect(resting.assignments).toHaveLength(0);
    await app.inject({ method: "PUT", url: "/api/hub/me", headers: { cookie: cy }, payload: { onBreak: false, eventKey: EVENT } });
    expect((await my(cy)).assignments.length).toBeGreaterThan(0);
  });

  it("stops moving scouts once the match has started and moves on when it is over", () => {
    const before = loadAssignments(EVENT).filter((a) => a.matchKey === `${EVENT}_qm1`);
    reassign(EVENT, START + 30_000);
    const during = loadAssignments(EVENT).filter((a) => a.matchKey === `${EVENT}_qm1`);
    expect(during.map((a) => a.scoutKey)).toEqual(before.map((a) => a.scoutKey));
    expect(during.filter((a) => a.scoutKey).every((a) => a.locked)).toBe(true);
    // Four minutes in, match 1 is over and the plan reaches match 4.
    reassign(EVENT, START + 4 * 60_000 + 10_000);
    expect(loadAssignments(EVENT).some((a) => a.matchKey === `${EVENT}_qm4`)).toBe(true);
  });
});

describe("entries", () => {
  it("saves a draft, then a submission, without duplicating on retry", async () => {
    const ana = await signIn(app, "scout", "Ana");
    const slot = (await my(ana)).assignments[0];
    const id = crypto.randomUUID();
    const url = `/api/hub/events/${EVENT}/entries/${id}`;

    const draft = await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload: { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: { scoring_cycles: 2 }, status: "draft" } });
    expect(draft.statusCode).toBe(200);
    expect(draft.json().entry).toMatchObject({ status: "draft", revision: 1, scout: "Ana" });

    const incomplete = await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload: { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: { scoring_cycles: 2 }, status: "submitted" } });
    expect(incomplete.statusCode).toBe(400);
    expect(incomplete.json().details.length).toBeGreaterThan(0);

    const payload = { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: COMPLETE, status: "submitted" };
    const sent = await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload });
    const retried = await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload });
    expect(sent.json().entry.status).toBe("submitted");
    expect(retried.statusCode).toBe(200);
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM match_scout_entries WHERE match_key = ? AND team_number = ?`).get(slot.matchKey, slot.teamNumber) as { n: number };
    expect(rows.n).toBe(1);

    // A stray autosave arriving after the submit must not undo it.
    const late = await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload: { ...payload, status: "draft" } });
    expect(late.json().entry.status).toBe("submitted");

    const mine = await my(ana);
    expect(mine.entries[0]).toMatchObject({ id, status: "submitted" });
    expect(mine.assignments.find((a: { matchKey: string }) => a.matchKey === slot.matchKey)?.entry?.status ?? "submitted").toBe("submitted");
  });

  it("continues the same entry when the scout starts it again on another device", async () => {
    const ben = await signIn(app, "scout", "Ben");
    const slot = (await my(ben)).assignments[0];
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const body = { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: { scoring_cycles: 1 }, status: "draft" };
    await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/entries/${first}`, headers: { cookie: ben }, payload: body });
    const again = await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/entries/${second}`, headers: { cookie: ben }, payload: { ...body, data: { scoring_cycles: 3 } } });
    expect(again.json().entry.id).toBe(first);
    expect(again.json().entry.data.scoring_cycles).toBe(3);
  });

  it("refuses a team that is not in the match and someone else's entry", async () => {
    const ana = await signIn(app, "scout", "Ana");
    const wrongTeam = await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/entries/${crypto.randomUUID()}`, headers: { cookie: ana }, payload: { matchKey: `${EVENT}_qm1`, teamNumber: 999, data: {}, status: "draft" } });
    expect(wrongTeam.json().error).toBe("team_not_in_match");

    const other = db.prepare(`SELECT id, match_key, team_number FROM match_scout_entries WHERE scout_key = 'ben' LIMIT 1`).get() as { id: string; match_key: string; team_number: number };
    const stolen = await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/entries/${other.id}`, headers: { cookie: ana }, payload: { matchKey: other.match_key, teamNumber: other.team_number, data: {}, status: "draft" } });
    expect(stolen.statusCode).toBe(403);
    const peek = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/entries/${other.id}`, headers: { cookie: ana } });
    expect(peek.statusCode).toBe(403);
  });

  it("compiles submitted entries into team figures", async () => {
    const row = db.prepare(`SELECT team_number FROM match_scout_entries WHERE status = 'submitted' LIMIT 1`).get() as { team_number: number };
    const metrics = db.prepare(`SELECT metric_name, metric_value FROM analytics_metrics WHERE event_key = ? AND team_number = ? AND metric_name LIKE 'hub.%'`).all(EVENT, row.team_number) as Array<{ metric_name: string; metric_value: number }>;
    const byName = Object.fromEntries(metrics.map((m) => [m.metric_name, m.metric_value]));
    expect(byName["hub.scoring_cycles"]).toBe(6);
    expect(byName["hub.climb_points"]).toBe(20);
    expect(byName["hub.climb_rate"]).toBe(1);
    expect(byName["hub.scoring_rating"]).toBe(3);
    expect(byName["hub.defence_rating"]).toBeUndefined();
    expect(byName["hub.matches_observed"]).toBe(1);
  });
});

describe("compilation", () => {
  it("averages two scouts on the same match before averaging across matches", () => {
    const entries = [
      { matchKey: "a", scoutKey: "x", data: { scoring_cycles: 4 } },
      { matchKey: "a", scoutKey: "y", data: { scoring_cycles: 8 } },
      { matchKey: "b", scoutKey: "x", data: { scoring_cycles: 10 } },
    ];
    const metrics = compileTeam(rebuilt2026, entries);
    expect(metrics.scoring_cycles).toBe(8);
    expect(metrics.matches_observed).toBe(2);
    const summary = summariseMetric(rebuilt2026.metrics.find((m) => m.key === "scoring_cycles")!, entries);
    expect(summary.perMatch[0]).toEqual({ matchKey: "a", value: 6, spread: 4 });
  });

  it("leaves 'no evidence' ratings out of the average", () => {
    const metrics = compileTeam(rebuilt2026, [
      { matchKey: "a", scoutKey: "x", data: { defence_rating: "no_evidence" } },
      { matchKey: "b", scoutKey: "x", data: { defence_rating: "exceptional" } },
    ]);
    expect(metrics.defence_rating).toBe(4);
  });
});
