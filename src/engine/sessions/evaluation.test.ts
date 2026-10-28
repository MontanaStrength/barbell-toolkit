import { describe, expect, it } from "vitest";
import { evaluateSession } from "./evaluation";
import type { CardSet } from "./card";
import { buildCard } from "./card";
import { DESIGNS } from "./designs";
import ordinary from "../sa/fixtures/ordinary.json";
import grouped from "../sa/fixtures/grouped.json";

const set = (more: Partial<CardSet> = {}): CardSet => ({
  n: 1,
  group: "Work",
  pct: 75,
  reps: { kind: "fixed", n: 4 },
  rpe: 7,
  next: 180,
  fresh: null,
  stopV: null,
  single: false,
  road: null,
  ...more,
});
const close = (sets: CardSet[]) =>
  sets.map((s, i) => ({
    ...s,
    n: i + 1,
    next: i === sets.length - 1 ? 0 : s.next,
  }));
const vectorClose = (got: object | null, expected: object) => {
  expect(got).not.toBeNull();
  for (const [axis, value] of Object.entries(expected))
    expect((got as Record<string, number>)[axis]).toBeCloseTo(value, 10);
};

describe("exact Strength Architect evaluation", () => {
  for (const fixture of ordinary.fixtures)
    it(`matches independent upstream receipt: ${fixture.id}`, () => {
      const sets = fixture.sets.map((s) =>
        set({
          n: s.index,
          pct: s.intensityPct,
          reps: { kind: "fixed", n: s.reps },
          next: s.restAfterSeconds,
        }),
      );
      const before = JSON.stringify(sets);
      const evaluation = evaluateSession(sets, "bench", "custom");
      expect(evaluation.status).toBe("estimated");
      expect(evaluation.source.commit).toBe(ordinary.source.commit);
      vectorClose(evaluation.rawBenefits, fixture.setSumVector);
      vectorClose(evaluation.benefits, fixture.sessionAdjustedVector);
      vectorClose(evaluation.costs, {
        central: fixture.costVector.lastingCentral,
        peripheral: fixture.costVector.localMuscular,
      });
      fixture.sets.forEach((s, i) =>
        expect(evaluation.perSet[i].projectedRpe).toBeCloseTo(
          s.projectedRpe,
          10,
        ),
      );
      expect(JSON.stringify(sets)).toBe(before);
    });

  it("expands true cluster parts, prices carry and central tails once, then saturates the session", () => {
    const fixture = grouped.find((f) => f.id === "clusters")!;
    const sets = close([
      set({
        pct: 80,
        reps: { kind: "cluster", parts: [2, 2, 2], intraRest: 20 },
      }),
      set({
        pct: 80,
        reps: { kind: "cluster", parts: [2, 2, 2], intraRest: 20 },
      }),
    ]);
    const result = evaluateSession(sets, "bench", "pureCluster");
    vectorClose(result.benefits, fixture.benefits);
    vectorClose(result.rawBenefits, fixture.rawBenefits);
    vectorClose(result.costs, {
      central: fixture.costs.lastingCentral,
      peripheral: fixture.costs.localMuscular,
    });
    expect(result.perSet.map((s) => s.projectedRpe)).toEqual([
      fixture.projectedRpes[2],
      fixture.projectedRpes[5],
    ]);
    // Flattening mini-sets into ordinary sets loses the explicit group contract.
    const flat = close(
      Array.from({ length: 6 }, (_, i) =>
        set({
          pct: 80,
          reps: { kind: "fixed", n: 2 },
          next: i === 2 ? 180 : 20,
        }),
      ),
    );
    expect(
      evaluateSession(flat, "bench", "custom").costs?.central,
    ).not.toBeCloseTo(result.costs!.central, 5);
  });

  it("uses only contiguous, explicitly named recovery-island blocks", () => {
    const fixture = grouped.find((f) => f.id === "recovery-islands")!;
    const sets = close(
      Array.from({ length: 6 }, (_, i) =>
        set({
          group: `Block ${Math.floor(i / 3) + 1}`,
          pct: 72,
          reps: { kind: "fixed", n: 2 },
          next: i % 3 === 2 ? 180 : 45,
        }),
      ),
    );
    const result = evaluateSession(sets, "bench", "recoveryIslands");
    vectorClose(result.benefits, fixture.benefits);
    vectorClose(result.costs, {
      central: fixture.costs.lastingCentral,
      peripheral: fixture.costs.localMuscular,
    });
    const reordered = [sets[0], sets[3], sets[1], sets[4], sets[2], sets[5]];
    // Same labels separated in actual chronology must not be silently reunited.
    const ordinaryReordered = evaluateSession(reordered, "bench", "custom");
    vectorClose(
      evaluateSession(reordered, "bench", "recoveryIslands").costs,
      ordinaryReordered.costs!,
    );
  });

  it("does not interpret ordinary phase labels or a recipe name as a compound group", () => {
    const sets = close(
      Array.from({ length: 3 }, () =>
        set({
          group: "Tier 1",
          pct: 80,
          reps: { kind: "fixed", n: 3 },
          next: 90,
        }),
      ),
    );
    vectorClose(
      evaluateSession(sets, "bench", "dropSet").costs,
      evaluateSession(sets, "bench", "custom").costs!,
    );
  });

  it("subtracts work from start intervals without altering the requested clock", () => {
    const clock = close(
      Array.from({ length: 4 }, () =>
        set({ pct: 80, reps: { kind: "fixed", n: 2 }, next: 60, clock: true }),
      ),
    );
    const before = JSON.stringify(clock);
    const actualRest = clock.map((s) => ({
      ...s,
      clock: false,
      next: s.next ? 52 : 0,
    }));
    const incorrectlyFullRest = clock.map((s) => ({ ...s, clock: false }));
    const result = evaluateSession(clock, "bench", "singles");
    vectorClose(
      result.benefits,
      evaluateSession(actualRest, "bench", "custom").benefits!,
    );
    expect(result.perSet[3].projectedRpe).toBeGreaterThan(
      evaluateSession(incorrectlyFullRest, "bench", "custom").perSet[3]
        .projectedRpe!,
    );
    expect(result.warnings.join(" ")).toContain(
      "interval minus estimated work",
    );
    expect(JSON.stringify(clock)).toBe(before);
  });

  for (const reps of [
    { kind: "timed", minutes: 15 },
    { kind: "upTo", n: 4 },
    { kind: "toStop", about: 8 },
  ] as const) {
    it(`does not fabricate repetitions for ${reps.kind}`, () => {
      const result = evaluateSession(
        [set(), set({ reps }), set()],
        "bench",
        "custom",
      );
      expect(result.status).toBe("partial");
      expect(result.benefits).toBeNull();
      expect(result.rawBenefits).toBeNull();
      expect(result.costs).toBeNull();
      expect(result.perSet[0].projectedRpe).not.toBeNull();
      expect(result.perSet[1].projectedRpe).toBeNull();
      expect(result.perSet[2].status).toBe("unknown_after_unpriced_work");
      expect(evaluateSession([set({ reps })], "bench", "custom").status).toBe(
        "unavailable",
      );
    });
  }

  it("reports infeasible fixed work without rewriting or scoring it as attainable", () => {
    const sets = close(
      Array.from({ length: 8 }, () =>
        set({ pct: 85, reps: { kind: "fixed", n: 6 }, next: 0 }),
      ),
    );
    const before = JSON.stringify(sets);
    const result = evaluateSession(sets, "bench", "custom");
    expect(result.status).toBe("partial");
    expect(result.benefits).toBeNull();
    expect(result.perSet.some((s) => s.status === "predicted_infeasible")).toBe(
      true,
    );
    expect(result.warnings.join(" ")).toContain("exceeds RPE 10");
    expect(JSON.stringify(sets)).toBe(before);
    expect(
      evaluateSession(
        [set({ pct: 100, reps: { kind: "fixed", n: 8 } })],
        "bench",
        "custom",
      ).warnings.join(" "),
    ).toContain("fresh capacity");
  });

  it("checks ceilings against projected effort without treating the ceiling as achieved RPE", () => {
    const result = evaluateSession(
      [set({ pct: 80, reps: { kind: "fixed", n: 5 }, rpe: 6, ceiling: true })],
      "bench",
      "custom",
    );
    expect(result.perSet[0].projectedRpe).toBe(7.7);
    expect(result.perSet[0].status).toBe("ceiling_exceeded");
    expect(result.warnings.join(" ")).toContain("stop rule may shorten");
  });

  it("returns explicit unavailable results for empty or invalid work", () => {
    expect(evaluateSession([], "bench", "custom").status).toBe("unavailable");
    expect(
      evaluateSession([set({ pct: NaN })], "bench", "custom").benefits,
    ).toBeNull();
    expect(
      evaluateSession(
        [set({ reps: { kind: "cluster", parts: [], intraRest: 20 } })],
        "bench",
        "pureCluster",
      ).status,
    ).toBe("unavailable");
  });

  it("covers all 26 recipe defaults on their supported lifts without nonfinite outputs", () => {
    expect(DESIGNS).toHaveLength(26);
    for (const design of DESIGNS) {
      const lift = design.lifts?.[0] ?? "bench";
      const ctx = { lift, lstar: 65, fresh: () => null, stop: () => null };
      const card = buildCard(design, ctx);
      const result = evaluateSession(card.sets, lift, design.key);
      expect(result.perSet).toHaveLength(card.sets.length);
      for (const row of result.perSet)
        expect(
          row.projectedRpe === null || Number.isFinite(row.projectedRpe),
        ).toBe(true);
      for (const vector of [result.benefits, result.rawBenefits, result.costs])
        if (vector)
          expect(Object.values(vector).every(Number.isFinite)).toBe(true);
      if (
        design.key === "densitySet" ||
        design.key === "restPauseHarvest" ||
        design.key === "shrinkingSets"
      )
        expect(result.benefits).toBeNull();
    }
  });
});
