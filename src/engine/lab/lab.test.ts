import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { EXAMPLE_PROBE } from "../example";
import { contextFor } from "../sessions/card";
import { PRESETS, presetByKey } from "./presets";
import { blankBlock, readout, SHAPES, simulate, type ShapeKey } from "./sessionLab";

const ctx = contextFor(analyze(EXAMPLE_PROBE), "bench", EXAMPLE_PROBE.mvt);
const run = (key: string) => simulate(presetByKey(key)!.blocks, ctx);

describe("the session lab", () => {
  it("rebuilds all 26 designs from six shapes", () => {
    expect(PRESETS).toHaveLength(26);
    for (const p of PRESETS) {
      const sets = simulate(p.blocks, ctx);
      expect(sets.length, p.key).toBeGreaterThan(0);
      expect(sets[sets.length - 1].rest, p.key).toBe(0);
      for (const s of sets) {
        expect(s.parts.every((r) => r >= 1), p.key).toBe(true);
        expect(s.rpe, p.key).toBeLessThanOrEqual(10);
        expect(Number.isFinite(s.rpe), p.key).toBe(true);
      }
      expect(["strength", "hypertrophy", "mixed"]).toContain(readout(sets, ctx.lstar).lean);
    }
  });

  it("builds every shape from its blank dials", () => {
    for (const k of Object.keys(SHAPES) as ShapeKey[]) expect(simulate([blankBlock(k)], ctx).length, k).toBeGreaterThan(0);
  });

  it("drifts straight sets about half an RPE a set, as SA's solver assumes", () => {
    const rpes = run("straightSets").map((s) => s.rpe);
    for (let i = 1; i < rpes.length; i++) {
      expect(rpes[i] - rpes[i - 1]).toBeGreaterThan(0.3);
      expect(rpes[i] - rpes[i - 1]).toBeLessThan(0.7);
    }
  });

  it("leaves strength sets on long rests nearly flat", () => {
    const rpes = run("strengthPrescriptionTable").map((s) => s.rpe);
    expect(rpes[rpes.length - 1] - rpes[0]).toBeLessThan(0.5);
  });

  it("makes the way down an arc harder than the way up at the same load", () => {
    const s = run("doublePyramid");
    expect(s[3].load).toBe(s[1].load);
    expect(s[3].rpe).toBeGreaterThan(s[1].rpe);
  });

  it("lets an RPE stop take fewer reps as fatigue builds", () => {
    const s = simulate([{ shape: "constant", v: { ...blankBlock("constant").v, load: 75, sets: 5, kind: 0, rpe: 8, cap: 0, rest: 60 } }], ctx);
    expect(s[s.length - 1].parts[0]).toBeLessThan(s[0].parts[0]);
  });

  it("reads strength and hypertrophy as outputs", () => {
    expect(readout(run("strengthPrescriptionTable"), ctx.lstar).lean).toBe("strength");
    expect(readout(run("straightSets"), ctx.lstar).lean).toBe("hypertrophy");
  });
});
