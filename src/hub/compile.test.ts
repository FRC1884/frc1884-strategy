import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { signIn, testApp } from "../../test/helpers.js";
import { db } from "../db/client.js";
import { rebuilt2026 } from "../shared/games/rebuilt2026.js";
import { compileEvent, compileMetric, toCsv } from "./compile.js";
import { saveEntry } from "./entries.js";
import { saveManualMatch } from "./schedule.js";

let app: FastifyInstance;
const EVENT = "2026comp";
const BASE = { auto_leave: "bump", climb_level: "none", scoring_rating: "good", defence_rating: "no_evidence" };

function entry(match: number, team: number, scout: string, data: Record<string, unknown>) {
  const result = saveEntry({ id: crypto.randomUUID(), eventKey: EVENT, matchKey: `${EVENT}_qm${match}`, teamNumber: team, scout, data: { ...BASE, ...data }, status: "submitted" });
  if (!result.ok) throw new Error(`${result.error} ${result.details?.join(",")}`);
}

beforeAll(async () => {
  app = await testApp();
  db.prepare(`INSERT INTO events (event_key, name, season, game_id) VALUES (?, 'Compile test', 2026, 'rebuilt2026')`).run(EVENT);
  const past = Date.now() - 3 * 3_600_000;
  for (let i = 1; i <= 5; i++) {
    saveManualMatch(EVENT, { compLevel: "qm", matchNumber: i, plannedAt: new Date(past + i * 8 * 60_000).toISOString(), red: [301, 302, 303], blue: [304, 305, 306] });
  }
  db.prepare(`UPDATE matches SET red_score = 100, blue_score = 40 WHERE match_key = ?`).run(`${EVENT}_qm1`);
  db.prepare(`UPDATE matches SET red_score = 200, blue_score = 40 WHERE match_key = ?`).run(`${EVENT}_qm2`);

  // Team 301: five matches, improving.
  [10, 12, 20, 30, 40].forEach((fuel, i) => entry(i + 1, 301, "Ana", { scoring_cycles: 3 + i, teleop_fuel: fuel, climb_level: i >= 3 ? "l2" : "none", difficulties: i === 0 ? ["jammed"] : [] }));
  // A second scout on match 1 who saw something very different.
  entry(1, 301, "Ben", { scoring_cycles: 3, teleop_fuel: 50, difficulties: ["jammed"] });
  // The rest of red in matches 1 and 2 so the alliance can be checked against the official score.
  entry(1, 302, "Cy", { scoring_cycles: 5, teleop_fuel: 35 });
  entry(1, 303, "Di", { scoring_cycles: 5, teleop_fuel: 30 });
  entry(2, 302, "Cy", { scoring_cycles: 5, teleop_fuel: 20 });
  entry(2, 303, "Di", { scoring_cycles: 5, teleop_fuel: 20 });
  entry(2, 304, "Eli", { scoring_cycles: 1, teleop_fuel: 5 });
});

afterAll(async () => {
  await app.close();
});

describe("compilation", () => {
  it("gives averages, best, worst, recent form and trend per team", () => {
    const team = compileEvent(EVENT)!.teams.find((t) => t.teamNumber === 301)!;
    const fuel = team.metrics.teleop_fuel;
    // Match 1 is the average of the two scouts (10 and 50).
    expect(fuel.value).toBeCloseTo((30 + 12 + 20 + 30 + 40) / 5);
    expect(fuel.best).toBe(40);
    expect(fuel.worst).toBe(12);
    expect(fuel.last3).toBe(30);
    expect(fuel.trend).toBeCloseTo(30 - 26.4);
    expect(fuel.matches).toBe(5);
    expect(team.matchesObserved).toBe(5);
    expect(team.entryCount).toBe(6);
    expect(team.metrics.climb_rate.value).toBeCloseTo(0.4);
    expect(team.metrics.defence_rating.value).toBeNull();
    expect(team.problems).toEqual({ jammed: 1 });
  });

  it("flags scouts who disagreed and a team seen only once", () => {
    const teams = compileEvent(EVENT)!.teams;
    const flags301 = teams.find((t) => t.teamNumber === 301)!.flags;
    expect(flags301.some((f) => f.kind === "disagreement" && f.text.includes("teleop fuel"))).toBe(true);
    expect(teams.find((t) => t.teamNumber === 304)!.flags).toEqual([{ kind: "few", text: "Seen in only one match." }]);
    expect(teams.find((t) => t.teamNumber === 306)!.flags).toEqual([]);
  });

  it("flags a match where the scouted points are far from the official score", () => {
    const teams = compileEvent(EVENT)!.teams;
    // Match 1: red scouted 30 + 35 + 30 = 95 against an official 100: fine.
    // Match 2: red scouted 12 + 20 + 20 = 52 against an official 200: far off.
    for (const number of [301, 302, 303]) {
      const official = teams.find((t) => t.teamNumber === number)!.flags.filter((f) => f.kind === "official");
      expect(official).toHaveLength(1);
      expect(official[0].text).toContain("Qual 2");
      expect(official[0].text).toContain("200");
    }
    // Blue in match 2 was not fully scouted, so it is not checked.
    expect(teams.find((t) => t.teamNumber === 304)!.flags.some((f) => f.kind === "official")).toBe(false);
  });

  it("does not report a trend or recent form from too few matches", () => {
    const metric = rebuilt2026.metrics.find((m) => m.key === "teleop_fuel")!;
    const two = compileMetric(metric, [
      { matchKey: "a", scoutKey: "x", data: { teleop_fuel: 10 } },
      { matchKey: "b", scoutKey: "x", data: { teleop_fuel: 30 } },
    ]);
    expect(two.last3).toBeNull();
    expect(two.trend).toBeNull();
    expect(two.spread).toBeCloseTo(14.14, 1);
  });
});

describe("pit scouting", () => {
  it("saves a pit entry, merges answers from two scouts and reports mismatches", async () => {
    const ana = await signIn(app, "scout", "Ana");
    const ben = await signIn(app, "scout", "Ben");
    const first = await app.inject({
      method: "PUT",
      url: `/api/hub/events/${EVENT}/pit/${crypto.randomUUID()}`,
      headers: { cookie: ana },
      payload: { teamNumber: 302, data: { drivetrain: "swerve", climb_capability: "l3", cycles_per_shift: 3, fuel_per_cycle: 40 }, status: "submitted" },
    });
    expect(first.statusCode).toBe(200);
    await app.inject({
      method: "PUT",
      url: `/api/hub/events/${EVENT}/pit/${crypto.randomUUID()}`,
      headers: { cookie: ben },
      payload: { teamNumber: 302, data: { hopper_capacity: 60, struggling_with: "Intake jams" }, status: "submitted" },
    });

    const team = compileEvent(EVENT)!.teams.find((t) => t.teamNumber === 302)!;
    expect(team.pit).toMatchObject({ drivetrain: "swerve", hopper_capacity: 60, struggling_with: "Intake jams" });
    expect(team.pitScouts.sort()).toEqual(["Ana", "Ben"]);
    const pitFlags = team.flags.filter((f) => f.kind === "pit").map((f) => f.text);
    expect(pitFlags.some((t) => t.includes("Level 3"))).toBe(true);
    expect(pitFlags.some((t) => t.includes("360 fuel"))).toBe(true);

    const list = (await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/pit`, headers: { cookie: ana } })).json();
    const row = list.teams.find((t: { teamNumber: number }) => t.teamNumber === 302);
    expect(row).toMatchObject({ done: 2, mine: { status: "submitted" } });
    expect(row.entries).toBeUndefined();

    const elsewhere = await app.inject({ method: "PUT", url: `/api/hub/events/${EVENT}/pit/${crypto.randomUUID()}`, headers: { cookie: ana }, payload: { teamNumber: 9999, data: {}, status: "draft" } });
    expect(elsewhere.json().error).toBe("team_not_at_event");
  });
});

describe("export", () => {
  it("gives managers and strategists CSV files, and refuses scouts", async () => {
    const scout = await signIn(app, "scout", "Zed");
    const refused = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/export/teams.csv`, headers: { cookie: scout } });
    expect(refused.statusCode).toBe(403);

    const strategist = await signIn(app, "strategist");
    const teams = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/export/teams.csv`, headers: { cookie: strategist } });
    expect(teams.headers["content-type"]).toContain("text/csv");
    const lines = teams.body.trim().split("\r\n");
    expect(lines[0]).toContain("Team,Name,Matches observed,Scoring cycles per match");
    expect(lines.find((l) => l.startsWith("301,"))).toContain(",5,");

    const manager = await signIn(app, "manager");
    const entries = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/export/entries.csv`, headers: { cookie: manager } });
    expect(entries.body.trim().split("\r\n")).toHaveLength(1 + 11);
    const pit = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/export/pit.csv`, headers: { cookie: manager } });
    expect(pit.body).toContain("Intake jams");
    const unknown = await app.inject({ method: "GET", url: `/api/hub/events/${EVENT}/export/secrets.csv`, headers: { cookie: manager } });
    expect(unknown.statusCode).toBe(404);
  });

  it("quotes awkward text and defuses spreadsheet formulas", () => {
    const csv = toCsv(["a", "b"], [["plain", 'says "hi", twice'], ["=SUM(A1)", ["x", "y"]]]);
    expect(csv).toBe('a,b\r\nplain,"says ""hi"", twice"\r\n\'=SUM(A1),x; y\r\n');
  });
});
