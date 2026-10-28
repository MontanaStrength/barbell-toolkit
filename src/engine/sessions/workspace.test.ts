import { describe, expect, it } from "vitest";
import { fromUnit, toUnit } from "../../weights";
import { neuralLoad } from "../metrics";
import { DESIGNS, designByKey, type DesignCtx } from "./designs";
import { buildCard } from "./card";
import {
  buildWorkspace,
  CUSTOM_RULE_WARNING,
  duplicateWorkspaceSet,
  editWorkspaceSet,
  filterDesigns,
  materializeWorkspace,
  moveWorkspaceSet,
  recipeTags,
  removeWorkspaceSet,
  RECIPE_TAGS,
  workspaceRepsText,
  workspaceWorkSeconds,
  WorkspaceValidationError,
} from "./workspace";

const ctx: DesignCtx = {
  lift: "bench",
  lstar: 70.2,
  fresh: (p) => 1.5 - p / 100,
  stop: (p, r) => 1.5 - p / 100 - r / 100,
};
const build = (key: string, input = {}, e1rm = 365, c = ctx) =>
  buildWorkspace(designByKey(key)!, c, input, e1rm, "lb");

describe("materialized session workspace", () => {
  it("uses the actual plate load for velocities, recruitment road and diagnostics", () => {
    const w = build("clockedSets", { load: 72 }, 100);
    const s = w.sets[0];
    expect(s.requestedPct).toBe(72);
    expect(s.loadLb).toBe(70);
    expect(s.pct).toBe(70);
    expect(s.fresh).toBe(ctx.fresh(70));
    expect(s.stopV).toBe(ctx.stop(70, s.rpe));
    expect(s.road).toBe("fatigue");
    expect(w.rules.join(" ")).toContain(
      `${(0.92 * ctx.fresh(70)!).toFixed(2)} m/s`,
    );
    expect(w.totals.neural).toBeCloseTo(neuralLoad(w.totals.reps!, 1, 70), 9);
  });

  it("rounds new defaults to the current unit's plates but never rerounds custom weights", () => {
    const d = designByKey("clockedSets")!;
    const e1rm = fromUnit(140, "kg");
    const w = buildWorkspace(d, ctx, { load: 72 }, e1rm, "kg");
    expect(toUnit(w.sets[0].loadLb, "kg")).toBeCloseTo(100, 9);
    const edited = editWorkspaceSet(w.sets, w.sets[0].id, { loadLb: 219.37 });
    const next = materializeWorkspace(w, edited, ctx, e1rm);
    expect(next.sets[0].loadLb).toBe(219.37);
    expect(next.sets[0].pct).toBeCloseTo((219.37 / e1rm) * 100, 12);
    expect(next.warnings).toContain(CUSTOM_RULE_WARNING);
  });

  it("preserves the authored reps and structures in all 26 recipes", () => {
    for (const d of DESIGNS) {
      const c = { ...ctx, lstar: 63.6, lift: d.lifts?.[0] ?? ctx.lift };
      const original = buildCard(d, c);
      const actual = buildWorkspace(d, c, {}, 365, "lb");
      expect(
        actual.sets.map((s) => [s.group, s.reps, s.rpe, s.clock, s.tempo]),
        d.key,
      ).toEqual(
        original.sets.map((s) => [s.group, s.reps, s.rpe, s.clock, s.tempo]),
      );
      expect(actual.sets[actual.sets.length - 1]?.next, d.key).toBe(0);
    }
  });

  it("counts start intervals once, excludes the final interval, and retains cadence for reordering", () => {
    const w = build("clockedSets", { sets: 8, clock: 105 });
    expect(w.totals.seconds).toBe(7 * 105 + workspaceWorkSeconds(w.sets[7]));
    expect(w.sets[7].next).toBe(0);
    expect(w.sets[7].recoverySeconds).toBe(105);
    const moved = moveWorkspaceSet(w.sets, w.sets[7].id, -7);
    expect(moved[0].next).toBe(105);
    expect(moved[7].next).toBe(0);
    const short = editWorkspaceSet(w.sets, w.sets[0].id, {
      recoverySeconds: 1,
    });
    const conflict = materializeWorkspace(w, short, ctx, 365);
    expect(conflict.sets[0].next).toBe(1);
    expect(conflict.warnings.join(" ")).toContain("exceeds the start interval");
    expect(conflict.totals.seconds).toBeGreaterThan(
      6 * 105 + workspaceWorkSeconds(w.sets[7]),
    );
  });

  it("preserves a cluster as one editable block, including intra-rest", () => {
    const w = build("pureCluster", { clusters: 2 });
    const s = w.sets[0];
    if (s.reps.kind !== "cluster") throw new Error("expected cluster");
    expect(workspaceWorkSeconds(s)).toBe(
      s.reps.parts.reduce((a, b) => a + b, 0) * 4 +
        (s.reps.parts.length - 1) * s.reps.intraRest,
    );
    expect(w.totals.seconds).toBe(
      workspaceWorkSeconds(s) * 2 + s.recoverySeconds,
    );
    const copies = duplicateWorkspaceSet(w.sets, s.id, "new-cluster");
    expect(copies).toHaveLength(3);
    expect(copies[1].reps).toEqual(s.reps);
    expect(copies[1].reps).not.toBe(s.reps);
    if (copies[1].reps.kind === "cluster")
      expect(copies[1].reps.parts).not.toBe(s.reps.parts);
    expect(removeWorkspaceSet(copies, "new-cluster")).toEqual(w.sets);
    expect(() => duplicateWorkspaceSet(w.sets, s.id, s.id)).toThrow(
      WorkspaceValidationError,
    );
  });

  it("rejects invalid edits instead of silently clamping them", () => {
    const w = build("topSetBackoff");
    const id = w.sets[0].id;
    for (const patch of [
      { loadLb: NaN },
      { loadLb: -5 },
      { rpe: 11 },
      { recoverySeconds: -1 },
      { reps: { kind: "fixed" as const, n: 2.5 } },
    ]) {
      expect(() => editWorkspaceSet(w.sets, id, patch)).toThrow(
        WorkspaceValidationError,
      );
    }
    expect(
      editWorkspaceSet(w.sets, id, { reps: { kind: "fixed", n: 30 } })[0].reps,
    ).toEqual({ kind: "fixed", n: 30 });
    const heavy = materializeWorkspace(
      w,
      editWorkspaceSet(w.sets, id, { loadLb: 400 }),
      ctx,
      365,
    );
    expect(heavy.sets[0].loadLb).toBe(400);
    expect(heavy.totals.neural).toBeNull();
    expect(heavy.warnings.join(" ")).toContain("at or above");
  });

  it("distinguishes fixed work, rep ceilings, open estimates and timed work", () => {
    expect(workspaceRepsText(build("topSetBackoff").totals)).toBe(
      "18 planned reps",
    );
    expect(workspaceRepsText(build("shrinkingSets").totals)).toBe(
      "Up to 32 reps",
    );
    expect(workspaceRepsText(build("restPauseHarvest").totals)).toMatch(
      /^About .*estimates$/,
    );
    const timed = build("densitySet", {}, 365, { ...ctx, lift: "deadlift" });
    expect(timed.totals).toMatchObject({
      repKind: "timed",
      reps: null,
      neural: null,
      seconds: 900,
    });
    expect(workspaceRepsText(timed.totals)).toContain("during the timed work");
    expect(() => build("densitySet")).toThrow(
      "unavailable for the selected lift",
    );
  });

  it("offers overlapping structural filters covering the complete catalogue", () => {
    expect(Object.keys(RECIPE_TAGS).sort()).toEqual(
      DESIGNS.map((d) => d.key).sort(),
    );
    expect(filterDesigns()).toHaveLength(26);
    expect(recipeTags("hypertrophyCluster")).toEqual(["steady", "grouped"]);
    expect(filterDesigns(["steady", "grouped"]).map((d) => d.key)).toContain(
      "pureCluster",
    );
    expect(filterDesigns(["steady", "grouped"]).map((d) => d.key)).toContain(
      "hypertrophyCluster",
    );
  });
});
