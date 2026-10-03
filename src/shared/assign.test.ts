import { describe, expect, it } from "vitest";
import { planAssignments, teamPriorities, type Assignment, type PlanMatch, type PlanScout } from "./assign.js";

function match(n: number, teams: number[], started = false): PlanMatch {
  return {
    matchKey: `qm${n}`,
    started,
    slots: teams.map((teamNumber, i) => ({ matchKey: `qm${n}`, alliance: i < 3 ? ("red" as const) : ("blue" as const), station: (i % 3) + 1, teamNumber })),
  };
}

function scouts(names: string[], load: Record<string, number> = {}): PlanScout[] {
  return names.map((name) => ({ key: name.toLowerCase(), name, load: load[name] ?? 0, teamsSeen: {} }));
}

const SIX = ["Ana", "Ben", "Cy", "Di", "Eli", "Fay"];
const M1 = match(1, [1, 2, 3, 4, 5, 6]);
const M2 = match(2, [7, 8, 9, 10, 11, 12]);
const M3 = match(3, [1, 8, 3, 10, 5, 12]);

function byMatch(plan: Assignment[], key: string) {
  return plan.filter((a) => a.matchKey === key);
}

describe("planAssignments", () => {
  it("gives six scouts one robot each, with nobody doubled up", () => {
    const plan = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX), priority: {} });
    const assigned = plan.map((a) => a.scoutKey);
    expect(new Set(assigned).size).toBe(6);
    expect(assigned.every(Boolean)).toBe(true);
  });

  it("covers the most important robots first when there are too few scouts", () => {
    const plan = planAssignments({ matches: [M1], existing: [], scouts: scouts(["Ana", "Ben"]), priority: { 4: 90, 6: 80, 1: 10 } });
    const covered = plan.filter((a) => a.scoutKey).map((a) => a.teamNumber).sort();
    expect(covered).toEqual([4, 6]);
    expect(plan).toHaveLength(6);
  });

  it("rotates who rests when there are more than six scouts", () => {
    const eight = [...SIX, "Gus", "Hal"];
    const plan = planAssignments({ matches: [M1, M2, M3], existing: [], scouts: scouts(eight), priority: {} });
    const resting = (key: string) => eight.map((n) => n.toLowerCase()).filter((s) => !byMatch(plan, key).some((a) => a.scoutKey === s));
    expect(resting("qm1")).toEqual(["gus", "hal"]);
    // The two who rested in match 1 are working in match 2, and two others rest.
    expect(resting("qm2")).not.toContain("gus");
    expect(resting("qm2")).not.toContain("hal");
    expect(resting("qm2")).toHaveLength(2);
    // Over three matches nobody watches more than one robot more than anyone else.
    const counts = eight.map((n) => plan.filter((a) => a.scoutKey === n.toLowerCase()).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("does not shuffle scouts who already have a robot", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX), priority: {} });
    // A seventh scout arriving must not move anyone.
    const second = planAssignments({ matches: [M1], existing: first, scouts: scouts([...SIX, "Gus"]), priority: {} });
    expect(second).toEqual(first);
  });

  it("hands a dropped scout's robot to someone free", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts([...SIX, "Gus"]), priority: {} });
    const dropped = first[2].scoutKey!;
    const remaining = scouts([...SIX, "Gus"]).filter((s) => s.key !== dropped);
    const second = planAssignments({ matches: [M1], existing: first, scouts: remaining, priority: {} });
    expect(second[2].scoutKey).toBe("gus");
    expect(second.filter((_, i) => i !== 2)).toEqual(first.filter((_, i) => i !== 2));
  });

  it("leaves a slot empty when a scout drops and nobody is free", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX), priority: {} });
    const second = planAssignments({ matches: [M1], existing: first, scouts: scouts(SIX.slice(1)), priority: {} });
    expect(second.filter((a) => a.scoutKey === null)).toHaveLength(1);
  });

  it("never moves anyone once a match has started", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX.slice(0, 4)), priority: {} });
    const started = { ...M1, started: true };
    const second = planAssignments({ matches: [started], existing: first, scouts: scouts(["Zed"]), priority: {} });
    expect(second).toEqual(first);
  });

  it("keeps a scout who has opened the form even if their phone drops off", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX), priority: {} });
    first[0].locked = true;
    const second = planAssignments({ matches: [M1], existing: first, scouts: scouts(["Gus"]), priority: {} });
    expect(second[0].scoutKey).toBe(first[0].scoutKey);
    expect(second.filter((a) => a.scoutKey === "gus")).toHaveLength(1);
  });

  it("prefers a scout who has not watched that team before", () => {
    const pair: PlanScout[] = [
      { key: "ana", name: "Ana", load: 3, teamsSeen: { 1: 3 } },
      { key: "ben", name: "Ben", load: 3, teamsSeen: {} },
    ];
    const plan = planAssignments({ matches: [match(9, [1, 2])], existing: [], scouts: pair, priority: { 1: 50, 2: 40 } });
    expect(plan.find((a) => a.teamNumber === 1)!.scoutKey).toBe("ben");
  });

  it("gives the next robot to whoever has done the least", () => {
    const plan = planAssignments({ matches: [match(9, [1])], existing: [], scouts: scouts(["Ana", "Ben"], { Ana: 5, Ben: 2 }), priority: {} });
    expect(plan[0].scoutKey).toBe("ben");
  });

  it("replaces an assignment when the schedule changes the team in that slot", () => {
    const first = planAssignments({ matches: [M1], existing: [], scouts: scouts(SIX), priority: {} });
    const changed = match(1, [99, 2, 3, 4, 5, 6]);
    const second = planAssignments({ matches: [changed], existing: first, scouts: scouts(SIX), priority: {} });
    expect(second[0].teamNumber).toBe(99);
    expect(second[0].scoutKey).not.toBeNull();
    expect(new Set(second.map((a) => a.scoutKey)).size).toBe(6);
  });
});

describe("teamPriorities", () => {
  it("ranks our upcoming partners and opponents highest, soonest first", () => {
    const priority = teamPriorities({
      ourTeam: 1884,
      upcoming: [
        [10, 11, 12, 13, 14, 15],
        [1884, 20, 21, 22, 23, 24],
        [30, 31, 32, 33, 34, 35],
        [1884, 10, 41, 42, 43, 44],
      ],
      entryCounts: {},
    });
    expect(priority[20]).toBeGreaterThan(priority[41]);
    expect(priority[41]).toBeGreaterThan(priority[30]);
    expect(priority[10]).toBeGreaterThan(priority[11]);
    expect(priority[1884]).toBe(-1);
  });

  it("puts teams we know least about ahead of well-scouted ones", () => {
    const priority = teamPriorities({ ourTeam: 1884, upcoming: [[1, 2, 3, 4, 5, 6]], entryCounts: { 1: 8, 2: 0 } });
    expect(priority[2]).toBeGreaterThan(priority[1]);
  });
});
