import { describe, expect, it } from "vitest";
import { DESIGN_TEXT } from "../../content/designs";
import { analyze } from "../analyze";
import { LIFT_KEYS, rpeStopFraction } from "../constants";
import { EXAMPLE_PROBE } from "../example";
import { buildCard, contextFor } from "./card";
import { designByKey, DESIGNS, dropRep, resolve, type DesignCtx, type PlanSet } from "./designs";

const a = analyze(EXAMPLE_PROBE);
const ctx = contextFor(a, "bench", EXAMPLE_PROBE.mvt);
const card = (key: string, input = {}, c: DesignCtx = ctx) => buildCard(designByKey(key)!, c, input);
const shape = (sets: PlanSet[]) =>
  sets.map((s) => `${s.pct}×${s.reps.kind === "fixed" || s.reps.kind === "upTo" ? s.reps.n : s.reps.kind === "cluster" ? s.reps.parts.join("+") : s.reps.kind}`);

describe("Hanley's peak-force drop rep", () => {
  it("matches the table in the model's own notes", () => {
    const table: Array<[number, number]> = [
      [60, 8], [65, 7], [70, 6], [75, 5], [80, 3], [82, 3], [84, 3], [86, 2], [88, 2], [90, 1], [95, 1],
    ];
    for (const [pct, reps] of table) expect(dropRep(pct), `${pct}%`).toBe(reps);
  });
});

describe("RPE to stop fraction", () => {
  it("hits the anchors and interpolates between them", () => {
    expect(rpeStopFraction(6.5)).toBe(0.2);
    expect(rpeStopFraction(7.5)).toBe(0.3);
    expect(rpeStopFraction(8)).toBe(0.4);
    expect(rpeStopFraction(9)).toBe(0.6);
    expect(rpeStopFraction(8.25)).toBeCloseTo(0.45, 12);
    expect(rpeStopFraction(5)).toBe(0.15);
    expect(rpeStopFraction(10)).toBe(0.6);
  });
});

describe("the catalogue", () => {
  it("has the 26 designs, 11 strength and 15 hypertrophy, each with words", () => {
    expect(DESIGNS).toHaveLength(26);
    expect(DESIGNS.filter((d) => d.family === "strength")).toHaveLength(11);
    expect(new Set(DESIGNS.map((d) => d.key)).size).toBe(26);
    for (const d of DESIGNS) expect(DESIGN_TEXT[d.key]?.name, d.key).toBeTruthy();
  });

  it("builds every design on every lift it allows, with sane sets and stops", () => {
    for (const d of DESIGNS) {
      for (const lift of LIFT_KEYS) {
        if (d.lifts && !d.lifts.includes(lift)) continue;
        const c = { ...ctx, lift };
        if (d.unavailable?.(c)) continue;
        const k = buildCard(d, c);
        expect(k.sets.length, d.key).toBeGreaterThan(0);
        expect(k.sets[k.sets.length - 1].next, `${d.key} ends`).toBe(0);
        for (const s of k.sets) {
          expect(s.pct, `${d.key} load`).toBeGreaterThanOrEqual(45);
          expect(s.pct, `${d.key} load`).toBeLessThanOrEqual(95);
          if (s.stopV != null && s.fresh != null) {
            expect(s.stopV, `${d.key} stop under fresh`).toBeLessThanOrEqual(s.fresh + 1e-12);
            expect(s.stopV, `${d.key} stop above MVT`).toBeGreaterThanOrEqual(EXAMPLE_PROBE.mvt - 1e-12);
          }
          expect(s.road).toBe(s.pct >= a.lstar! ? "load" : "fatigue");
        }
        expect(k.totals.minutes, d.key).toBeGreaterThan(0);
      }
    }
  });
});

describe("defaults reproduce Hanley's own examples", () => {
  it("strength designs", () => {
    expect(shape(card("strengthPrescriptionTable").sets)).toEqual(Array(5).fill("82×3"));
    expect(shape(card("sawtooth").sets)).toEqual(["85×1", "85×2", "85×1", "85×2", "85×1", "85×2"]);
    expect(shape(card("topSetBackoff").sets)).toEqual(["88×3", "80×4", "80×4", "80×4", "80×4"]);
    expect(shape(card("pureCluster").sets)).toEqual(Array(4).fill("87×1+1+1"));
    expect(shape(card("doublePyramid").sets)).toEqual(["80×3", "85×3", "90×3", "84×3", "79×3"]);
    expect(shape(card("singles").sets)).toEqual(Array(5).fill("88×1"));
    expect(shape(card("rampingSingles").sets)).toEqual(["75×1", "80×1", "85×1", "90×1", "78×3", "78×3", "78×3"]);
  });

  it("hypertrophy designs", () => {
    expect(shape(card("tapered").sets)).toEqual(["75×6", "75×6", "67×10", "67×10", "67×10"]);
    expect(shape(card("ascendingPyramid").sets)).toEqual(["62×12", "68×10", "73×8", "78×6"]);
    expect(shape(card("reversePyramid").sets)).toEqual(["78×6", "72×8", "66×10"]);
    expect(shape(card("volumePyramid").sets)).toEqual(["73×5", "76×5", "79×5", "75×5", "72×5"]);
    expect(shape(card("straightSets").sets)).toEqual(Array(4).fill("65×8"));
    expect(shape(card("dropSet").sets)).toEqual(["74×6", "74×6", "66×8", "66×8", "58×10", "58×10"]);
    expect(shape(card("mechanicalTension").sets)).toEqual(Array(6).fill("78×3"));
    expect(shape(card("eccentricAccentuated").sets)).toEqual(Array(4).fill("72×5"));
    expect(shape(card("hypertrophyCluster").sets)).toEqual(Array(3).fill("74×5+5+5"));
    expect(shape(card("forceMetabolic").sets)).toEqual(["72×4", "72×8", "72×4", "72×8", "72×4", "72×8"]);
  });

  it("the Oct 24 additions, as the catalogue defines them", () => {
    expect(shape(card("threadedSingles").sets)).toEqual(["77×4", "88×1", "77×4", "88×1", "77×4", "88×1", "77×4", "88×1", "77×4", "88×1"]);
    expect(shape(card("routeSwap").sets)).toEqual(["87×2", "87×2", "87×2", "87×2", "70×toStop", "70×toStop"]);
    expect(shape(card("routeSwap", { order: 1 }).sets)).toEqual(["70×toStop", "70×toStop", "87×2", "87×2", "87×2", "87×2"]);
    expect(shape(card("recruitmentCrossover").sets)).toEqual(["83×2", "83×2", "70×4", "70×4", "70×4", "58×toStop"]);
    expect(shape(card("boundedDescent").sets)).toEqual(["83×2", "77×3", "70×3", "83×2", "77×3", "70×3"]);
    expect(shape(card("shrinkingSets").sets)).toEqual(Array(8).fill("71×4"));
    expect(shape(card("recoveryIslands").sets)).toEqual(Array(12).fill("72×2"));
    expect(card("restPauseHarvest").sets.map((s) => s.reps.kind)).toEqual(["toStop", "upTo", "upTo", "upTo", "toStop", "upTo", "upTo", "upTo"]);
  });
});

describe("rules that depend on the lifter", () => {
  it("floors Ceiling Walk at L* + 1 and drops it when L* is above 79", () => {
    const d = designByKey("clockedSets")!;
    expect(resolve(d, ctx).bounds.load).toEqual([65, 80]); // L* 63.6
    expect(resolve(d, ctx).values.load).toBe(72);
    expect(card("clockedSets").sets[0].reps).toEqual({ kind: "fixed", n: 4 });
    expect(resolve(d, { ...ctx, lstar: 75.2 }).values.load).toBe(77);
    expect(d.unavailable!({ ...ctx, lstar: 79.5 })).toBeTruthy();
    expect(d.unavailable!(ctx)).toBeNull();
  });

  it("floors Force/Metabolic's load at L* + 1, inside 62 to 72%", () => {
    const d = designByKey("forceMetabolic")!;
    expect(resolve(d, ctx).bounds.load).toEqual([65, 72]);
    expect(d.unavailable!({ ...ctx, lstar: 71.5 })).toBeTruthy();
  });

  it("keeps Density off bench and squat, and asks for a spotter before Rest-Pause on them", () => {
    expect(designByKey("densitySet")!.lifts).toEqual(["deadlift"]);
    expect(designByKey("restPauseHarvest")!.spotter).toEqual(["bench", "squat"]);
  });

  it("caps the top set so it can't ask for more than RPE 9", () => {
    expect(resolve(designByKey("topSetBackoff")!, ctx, { top: 5 }).values.topPct).toBe(86);
  });

  it("writes the lifter's own velocities into the rules", () => {
    const k = card("clockedSets");
    const slow = (0.92 * ctx.fresh(72)!).toFixed(2);
    expect(k.rules.join(" ")).toContain(`${slow} m/s`);
    expect(card("restPauseHarvest").rules.join(" ")).toMatch(/under \d\.\d\d m\/s ends the block/);
  });

  it("ends a top set deeper than its back-offs", () => {
    const k = card("topSetBackoff");
    const top = k.sets[0];
    const back = k.sets[1];
    // RPE 8.5 against 6.5: the top set may slow further toward MVT before it ends.
    const f = (s: typeof top) => (s.fresh! - s.stopV!) / (s.fresh! - EXAMPLE_PROBE.mvt);
    expect(f(top)).toBeCloseTo(0.5, 12);
    expect(f(back)).toBeCloseTo(0.2, 12);
  });

  it("totals a session: reps, Hanley neural dose and time", () => {
    const t = card("topSetBackoff").totals;
    expect(t.reps).toBe(19);
    expect(t.neural).toBeCloseTo(3 * (100 / 12) ** 2 + 16 * 25, 6);
    expect(t.minutes).toBe(17);
    expect(t.approximate).toBe(false);
    expect(card("shrinkingSets").totals.approximate).toBe(true);
  });
});
