import { describe, expect, it } from "vitest";
import { computeRp, getGame, validateEntry, type GameDefinition } from "./index.js";
import { rebuilt2026 } from "./rebuilt2026.js";

describe("REBUILT ranking points", () => {
  it("gives 3 for a win and nothing extra below the thresholds", () => {
    const result = computeRp(rebuilt2026, { fuel: 80, climb: 30 }, { fuel: 60, climb: 30 });
    expect(result.outcome).toBe("win");
    expect(result.score).toBe(110);
    expect(result.total).toBe(3);
  });

  it("adds each bonus at its threshold", () => {
    expect(computeRp(rebuilt2026, { fuel: 100, climb: 0 }, { fuel: 500, climb: 0 }).total).toBe(1);
    expect(computeRp(rebuilt2026, { fuel: 360, climb: 50 }, { fuel: 0, climb: 0 }).total).toBe(6);
    expect(computeRp(rebuilt2026, { fuel: 99, climb: 49 }, { fuel: 99, climb: 49 }).total).toBe(1);
  });

  it("says how far short a bonus is", () => {
    const energized = computeRp(rebuilt2026, { fuel: 70 }, {}).bonuses.find((b) => b.id === "energized")!;
    expect(energized.earned).toBe(false);
    expect(energized.need - energized.have).toBe(30);
  });
});

describe("validateEntry", () => {
  const form = rebuilt2026.matchForm;

  it("keeps known fields and drops unknown ones", () => {
    const { data, errors } = validateEntry(form, { scoring_cycles: 4, made_up: "x", auto_climb: true });
    expect(errors).toEqual([]);
    expect(data).toEqual({ scoring_cycles: 4, auto_climb: true });
  });

  it("rejects wrong types and unknown options", () => {
    const { errors } = validateEntry(form, { scoring_cycles: -1, climb_level: "l9", scoring_rating: "great", difficulties: ["melted"] });
    expect(errors).toHaveLength(4);
  });

  it("only insists on required fields when the entry is being submitted", () => {
    expect(validateEntry(form, {}).errors).toEqual([]);
    const complete = validateEntry(form, {}, { complete: true });
    expect(complete.errors.length).toBeGreaterThan(0);
    const filled = validateEntry(
      form,
      { auto_leave: "bump", scoring_cycles: 0, climb_level: "none", scoring_rating: "good", defence_rating: "no_evidence" },
      { complete: true }
    );
    expect(filled.errors).toEqual([]);
  });
});

describe("game registry", () => {
  it("falls back to the default game for an unknown id", () => {
    expect(getGame("nope").id).toBe("rebuilt2026");
    expect(getGame(null).id).toBe("rebuilt2026");
  });

  it("works for a different game without code changes", () => {
    const other: GameDefinition = {
      ...rebuilt2026,
      id: "stub2027",
      season: 2027,
      allianceInputs: [{ key: "pieces", label: "Pieces" }],
      outcomeRp: { win: 2, tie: 1, loss: 0 },
      bonusRp: [{ id: "full", label: "Full", description: "", input: "pieces", threshold: 10, rp: 1 }],
      allianceScore: (totals) => (totals.pieces ?? 0) * 5,
    };
    const result = computeRp(other, { pieces: 10 }, { pieces: 3 });
    expect(result.score).toBe(50);
    expect(result.total).toBe(3);
  });
});
