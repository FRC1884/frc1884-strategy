import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { signIn, testApp } from "../../test/helpers.js";
import { db } from "../db/client.js";
import { saveManualMatch } from "./schedule.js";

let app: FastifyInstance;
let manager: string;
let ana: string;
let ben: string;
const EVENT = "2026mgr";
const START = Date.now() + 5 * 60_000;
const COMPLETE = { auto_leave: "bump", scoring_cycles: 6, climb_level: "l2", scoring_rating: "good", defence_rating: "no_evidence" };

beforeAll(async () => {
  app = await testApp();
  db.prepare(`INSERT INTO events (event_key, name, season, game_id) VALUES (?, 'Manager test', 2026, 'rebuilt2026')`).run(EVENT);
  for (let i = 0; i < 3; i++) {
    saveManualMatch(EVENT, { compLevel: "qm", matchNumber: i + 1, plannedAt: new Date(START + i * 8 * 60_000).toISOString(), red: [201, 202, 203], blue: [204, 205, 206] });
  }
  manager = await signIn(app, "manager", "Mo");
  ana = await signIn(app, "scout", "Ana");
  ben = await signIn(app, "scout", "Ben");
});

afterAll(async () => {
  await app.close();
});

async function board() {
  return (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/manager/board`, headers: { cookie: manager } })).json();
}

async function myFirst(cookie: string) {
  return (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/my`, headers: { cookie } })).json().assignments[0];
}

describe("scout manager", () => {
  it("is closed to scouts and strategists", async () => {
    const strategist = await signIn(app, "strategist");
    for (const cookie of [ana, strategist]) {
      const response = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/manager/board`, headers: { cookie } });
      expect(response.statusCode).toBe(403);
    }
  });

  it("shows who is signed in and who has which robot", async () => {
    const data = await board();
    const names = data.scouts.map((s: { name: string }) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Mo", "Ana", "Ben"]));
    expect(data.scouts.find((s: { name: string }) => s.name === "Ana")).toMatchObject({ role: "scout", scouting: true, onBreak: false });
    const first = data.matches[0];
    expect(first.label).toBe("Qual 1");
    const assigned = first.slots.filter((s: { scout: string | null }) => s.scout);
    expect(assigned.map((s: { scout: string }) => s.scout).sort()).toEqual(["Ana", "Ben"]);
    expect(assigned.every((s: { status: string }) => s.status === "not_opened")).toBe(true);
    expect(first.slots.filter((s: { status: string }) => s.status === "unassigned")).toHaveLength(4);
  });

  it("shows an entry being written, then submitted, with times", async () => {
    const slot = await myFirst(ana);
    const id = crypto.randomUUID();
    const url = `/api/hub/events/${EVENT}/entries/${id}`;
    await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload: { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: { scoring_cycles: 1 }, status: "draft" } });
    let state = (await board()).matches[0].slots.find((s: { teamNumber: number }) => s.teamNumber === slot.teamNumber);
    expect(state.status).toBe("writing");
    expect(state.locked).toBe(true);
    expect(state.entries[0]).toMatchObject({ scout: "Ana", status: "draft" });
    expect(Date.parse(state.entries[0].updatedAt)).toBeGreaterThan(Date.now() - 5000);

    await app.inject({ method: "PUT", url, headers: { cookie: ana }, payload: { matchKey: slot.matchKey, teamNumber: slot.teamNumber, data: COMPLETE, status: "submitted" } });
    state = (await board()).matches[0].slots.find((s: { teamNumber: number }) => s.teamNumber === slot.teamNumber);
    expect(state.status).toBe("submitted");

    const activity = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/manager/activity?scout=ana`, headers: { cookie: manager } })).json().activity;
    const kinds = activity.map((a: { kind: string }) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["signed_in", "assigned", "opened", "submitted"]));
    expect(activity.find((a: { kind: string }) => a.kind === "submitted")).toMatchObject({ matchLabel: "Qual 1", teamNumber: slot.teamNumber });
  });

  it("lists entries with filters and lets a manager correct or void one", async () => {
    const all = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/manager/entries?scout=ana`, headers: { cookie: manager } })).json().entries;
    expect(all).toHaveLength(1);
    const entry = all[0];
    expect(entry).toMatchObject({ matchLabel: "Qual 1", scout: "Ana", status: "submitted" });

    const corrected = await app.inject({
      method: "PUT",
      url: `/api/hub/events/${EVENT}/manager/entries/${entry.id}`,
      headers: { cookie: manager },
      payload: { data: { ...COMPLETE, scoring_cycles: 9 } },
    });
    expect(corrected.json().entry).toMatchObject({ scout: "Ana", editedBy: "Mo", status: "submitted" });
    const metric = () =>
      db.prepare(`SELECT metric_value FROM analytics_metrics WHERE event_key = ? AND team_number = ? AND metric_name = 'hub.scoring_cycles'`).get(EVENT, entry.teamNumber) as { metric_value: number } | undefined;
    expect(metric()?.metric_value).toBe(9);

    await app.inject({ method: "POST", url: `/api/hub/events/${EVENT}/manager/entries/${entry.id}/void`, headers: { cookie: manager }, payload: {} });
    expect(metric()).toBeUndefined();
    const refused = await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/entries/${entry.id}`, headers: { cookie: ana }, payload: { matchKey: entry.matchKey, teamNumber: entry.teamNumber, data: COMPLETE, status: "submitted" } });
    expect(refused.json().error).toBe("entry_voided");

    await app.inject({ method: "POST", url: `/api/hub/events/${EVENT}/manager/entries/${entry.id}/void`, headers: { cookie: manager }, payload: { restore: true } });
    expect(metric()?.metric_value).toBe(9);
  });

  it("lets a manager put a scout on a chosen robot and keeps them there", async () => {
    const before = (await board()).matches[1];
    const target = before.slots.find((s: { scout: string | null }) => !s.scout);
    const response = await app.inject({
      method: "PUT",
      url: `/api/hub/events/${EVENT}/manager/assignments`,
      headers: { cookie: manager },
      payload: { matchKey: before.matchKey, alliance: target.alliance, station: target.station, scoutKey: "ben" },
    });
    expect(response.statusCode).toBe(200);
    const after = (await board()).matches[1];
    const slots = after.slots.filter((s: { scoutKey: string | null }) => s.scoutKey === "ben");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ teamNumber: target.teamNumber, source: "manager" });
  });

  it("puts a scout on a break and signs a scout out", async () => {
    await app.inject({ method: "PUT", url: `/api/hub/manager/scouts/ben`, headers: { cookie: manager }, payload: { onBreak: true, eventKey: EVENT } });
    let data = await board();
    expect(data.scouts.find((s: { key: string }) => s.key === "ben").onBreak).toBe(true);
    expect(data.matches[2].slots.some((s: { scoutKey: string | null }) => s.scoutKey === "ben")).toBe(false);

    await app.inject({ method: "PUT", url: `/api/hub/manager/scouts/ben`, headers: { cookie: manager }, payload: { signOut: true, eventKey: EVENT } });
    data = await board();
    expect(data.scouts.some((s: { key: string }) => s.key === "ben")).toBe(false);
    const session = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/my`, headers: { cookie: ben } });
    expect(session.statusCode).toBe(401);
  });
});
