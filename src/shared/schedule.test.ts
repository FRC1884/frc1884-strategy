import { describe, expect, it } from "vitest";
import { matchClock, matchLabel, type ScheduleMatch } from "./schedule.js";

const T0 = Date.parse("2026-10-03T09:00:00Z");
const MIN = 60_000;

function match(n: number, overrides: Partial<ScheduleMatch> = {}): ScheduleMatch {
  return {
    matchKey: `2026test_qm${n}`,
    compLevel: "qm",
    setNumber: 1,
    matchNumber: n,
    label: `Qual ${n}`,
    plannedAt: new Date(T0 + (n - 1) * 8 * MIN).toISOString(),
    predictedAt: null,
    actualAt: null,
    redScore: null,
    blueScore: null,
    markedPlayed: false,
    source: "tba",
    red: [],
    blue: [],
    ...overrides,
  };
}

describe("matchClock", () => {
  it("starts with the first match when nothing has been played", () => {
    const clock = matchClock([match(2), match(1), match(3)], T0 - 5 * MIN, 160);
    expect(clock.upcoming.map((m) => m.matchNumber)).toEqual([1, 2, 3]);
  });

  it("moves on once a match has a result", () => {
    const played = match(1, { redScore: 80, blueScore: 70, actualAt: new Date(T0).toISOString() });
    const clock = matchClock([played, match(2), match(3)], T0 + 4 * MIN, 160);
    expect(clock.upcoming[0].matchNumber).toBe(2);
    expect(clock.done["2026test_qm1"]).toBe(true);
  });

  it("moves on by the clock when a result has not arrived yet", () => {
    const clock = matchClock([match(1), match(2)], T0 + 4 * MIN, 160);
    expect(clock.upcoming[0].matchNumber).toBe(2);
  });

  it("follows the field when the event runs late", () => {
    // Match 1 was planned for 9:00 but started at 9:30.
    const played = match(1, { redScore: 80, blueScore: 70, actualAt: new Date(T0 + 30 * MIN).toISOString() });
    const now = T0 + 37 * MIN;
    const clock = matchClock([played, match(2), match(3)], now, 160);
    expect(clock.latenessMs).toBe(30 * MIN);
    // By the printed schedule match 2 (9:08) and match 3 (9:16) are long over, but really match 2 starts at 9:38.
    expect(clock.upcoming[0].matchNumber).toBe(2);
    expect(clock.startsAt["2026test_qm2"]).toBe(T0 + 38 * MIN);
  });

  it("prefers a published prediction over its own estimate", () => {
    const played = match(1, { redScore: 1, blueScore: 0, actualAt: new Date(T0 + 30 * MIN).toISOString() });
    const predicted = match(2, { predictedAt: new Date(T0 + 50 * MIN).toISOString() });
    const clock = matchClock([played, predicted], T0 + 40 * MIN, 160);
    expect(clock.startsAt["2026test_qm2"]).toBe(T0 + 50 * MIN);
  });

  it("treats a match marked played by a manager as over", () => {
    const clock = matchClock([match(1, { plannedAt: null, markedPlayed: true }), match(2, { plannedAt: null })], T0, 160);
    expect(clock.upcoming.map((m) => m.matchNumber)).toEqual([2]);
  });

  it("puts qualification matches before playoffs", () => {
    const semi = match(1, { matchKey: "2026test_sf1m1", compLevel: "sf", plannedAt: new Date(T0 - 60 * MIN).toISOString() });
    const clock = matchClock([semi, match(1)], T0 - 90 * MIN, 160);
    expect(clock.upcoming.map((m) => m.compLevel)).toEqual(["qm", "sf"]);
  });
});

describe("matchLabel", () => {
  it("names matches the way teams say them", () => {
    expect(matchLabel("qm", 1, 42)).toBe("Qual 42");
    expect(matchLabel("qm", 1, 42, true)).toBe("Q42");
    expect(matchLabel("sf", 3, 1)).toBe("Semis 3");
    expect(matchLabel("f", 1, 2)).toBe("Final 2");
    expect(matchLabel("pm", null, 4, true)).toBe("P4");
  });
});
