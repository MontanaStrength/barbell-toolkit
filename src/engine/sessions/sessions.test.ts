import { describe, expect, it } from "vitest";
import { DESIGN_TEXT } from "../../content/designs";
import { analyze } from "../analyze";
import { NEURAL_TARGET, rpeStopFraction, STRENGTH_SWEET } from "../constants";
import { EXAMPLE_PROBE } from "../example";
import { buildCard, contextFor } from "./card";
import { designByKey, DESIGNS, resolve, type Design, type DesignCtx, type PlanSet, type Values } from "./designs";
import { dropRep, intensityForRPE, maxRepsAt, rpeAt, rpeCeiling } from "./effort";

const a = analyze(EXAMPLE_PROBE);
const ctx = contextFor(a, "bench", EXAMPLE_PROBE.mvt);
const card = (key: string, input = {}, c: DesignCtx = ctx, edits = {}) => buildCard(designByKey(key)!, c, input, edits);
const repsOf = (s: PlanSet) =>
  s.reps.kind === "fixed" || s.reps.kind === "upTo" ? s.reps.n : s.reps.kind === "cluster" ? s.reps.parts.join("+") : s.reps.kind;
const shape = (sets: PlanSet[]) => sets.map((s) => `${s.pct}×${repsOf(s)}`);
const efforts = (sets: PlanSet[]) => sets.map((s) => s.rpe);

/** Every combination of knob values a design allows for this lifter. */
function everyConfig(d: Design, c: DesignCtx): Values[] {
  const out: Values[] = [];
  const walk = (i: number, v: Values) => {
    if (i === d.params.length) return void out.push(v);
    const p = d.params[i];
    for (const x of p.values(c, v)) walk(i + 1, { ...v, [p.key]: x });
  };
  walk(0, {});
  return out;
}

describe("the effort curve, as SA's solvers use it", () => {
  it("puts an RPE 8.5 top set of 5 to 1 reps at SA's exposure ladder", () => {
    expect([5, 4, 3, 2, 1].map((r) => intensityForRPE(r, 8.5))).toEqual([82, 85, 88, 92, 95]);
  });

  it("reads reps and RPE off one curve", () => {
    expect(maxRepsAt(80)).toBeCloseTo(7.3, 1);
    expect(maxRepsAt(100)).toBe(1);
    expect(rpeAt(5, 81)).toBe(8.1);
    expect(rpeAt(10, intensityForRPE(10, 7.5))).toBeCloseTo(7.5, 0);
  });

  it("gives the drop rep SA's code gives, Nuzzo underneath", () => {
    const table: Array<[number, number]> = [
      [60, 8], [65, 7], [70, 5], [75, 4], [80, 3], [82, 3], [84, 2], [86, 2], [88, 2], [89, 1], [90, 1], [95, 1],
    ];
    for (const [pct, reps] of table) expect(dropRep(pct), `${pct}%`).toBe(reps);
  });

  it("caps effort at RPE 9, and 7.5 from six reps", () => {
    expect([1, 5, 6, 12].map(rpeCeiling)).toEqual([9, 9, 7.5, 7.5]);
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

  // Every knob setting, on every lift, for lifters with L* low, typical, high and absent.
  const lifters: Array<[string, DesignCtx]> = [
    ["example", ctx],
    ["no L*", { ...ctx, lstar: null }],
    ["L* 55", { ...ctx, lstar: 55 }],
    ["L* 75.2", { ...ctx, lstar: 75.2 }],
    ["L* 79.5", { ...ctx, lstar: 79.5 }],
  ];
  it("builds every setting of every design, with sane loads, stops and effort", () => {
    // Collected rather than asserted one by one: there are tens of thousands of sets.
    const wrong: string[] = [];
    let built = 0;
    for (const d of DESIGNS) {
      // The designs don't depend on the lift beyond where they may be run.
      const lift = d.lifts?.[0] ?? "bench";
      for (const [who, base] of lifters) {
        const c = { ...base, lift };
        if (d.unavailable?.(c)) continue;
        for (const v of everyConfig(d, c)) {
          const k = buildCard(d, c, v);
          built++;
          const bad = (what: string) => wrong.push(`${d.key} ${who} ${JSON.stringify(v)}: ${what}`);
          if (Object.keys(v).some((key) => k.values[key] !== v[key])) bad("knobs moved");
          if (!k.sets.length || k.sets[k.sets.length - 1].next !== 0) bad("no sets, or a rest after the last");
          if (!(k.totals.minutes > 0)) bad("no time");
          for (const s of k.sets) {
            if (s.pct < 45 || s.pct > 95) bad(`load ${s.pct}`);
            if (s.stopV != null && s.fresh != null && (s.stopV > s.fresh + 1e-12 || s.stopV < EXAMPLE_PROBE.mvt - 1e-12)) bad("stop outside fresh..MVT");
            if (s.road !== (c.lstar == null ? null : s.pct >= c.lstar ? "load" : "fatigue")) bad("road");
            // A fixed set never carries an RPE below what its reps cost at that load, so its stop
            // can't arrive before the planned reps do. (Clusters rest inside the set.)
            if (s.reps.kind === "fixed" && s.rpe + 0.25 < rpeAt(s.reps.n, s.pct)) bad(`${s.reps.n} at ${s.pct}% labelled RPE ${s.rpe}`);
          }
        }
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    expect(built).toBeGreaterThan(5000);
  }, 60_000);

  it("keeps a knob the lifter set when it still fits, and moves it when it doesn't", () => {
    const d = designByKey("topSetBackoff")!;
    expect(resolve(d, ctx, { top: 5, bReps: 6 }).values.bReps).toBe(6);
    // At three reps on top, back-offs of six would pass RPE 7.5: the nearest that fits is five.
    expect(resolve(d, ctx, { top: 3, bReps: 6 }).values.bReps).toBe(5);
    // A named option that no longer fits goes back to its default.
    const p = designByKey("pureCluster")!;
    expect(resolve(p, ctx, { load: 90, shape: 1 }).values.shape).toBe(0);
  });
});

describe("defaults follow SA's solvers", () => {
  it("strength designs", () => {
    expect(shape(card("strengthPrescriptionTable").sets)).toEqual(Array(5).fill("82×3"));
    expect(shape(card("sawtooth").sets)).toEqual(["85×1", "85×3", "85×1", "85×3", "85×1", "85×3"]);
    expect(card("sawtooth").sets.map((s) => s.group)).toEqual(["Practice", "Perform", "Practice", "Perform", "Practice", "Perform"]);
    expect(shape(card("topSetBackoff").sets)).toEqual(["88×3", "81×5", "81×5", "81×5"]);
    expect(shape(card("pureCluster").sets)).toEqual(Array(4).fill("87×1+1+1"));
    expect(shape(card("doublePyramid").sets)).toEqual(["84×3", "87×3", "90×3", "85.5×3", "82.5×3"]);
    expect(efforts(card("doublePyramid").sets)).toEqual([7, 8, 9, 8, 7]);
    expect(shape(card("singles").sets)).toEqual(["87×1", "88×1", "89×1", "87×1", "88×1"]);
    expect(shape(card("singles", { mode: 1 }).sets)).toEqual(Array(6).fill("88×1"));
    expect(shape(card("rampingSingles").sets)).toEqual(["75×1", "80×1", "85×1", "90×1", "78×3", "78×3", "78×3"]);
  });

  it("hypertrophy designs", () => {
    expect(shape(card("tapered").sets)).toEqual(["66×10", "66×10", "66×7", "66×7", "66×7"]);
    expect(shape(card("ascendingPyramid").sets)).toEqual(["60×12", "65×10", "71×8", "77×6"]);
    expect(efforts(card("ascendingPyramid").sets)).toEqual([6.5, 7, 7.5, 7.5]);
    expect(shape(card("reversePyramid").sets)).toEqual(["77×6", "71×8", "65×10"]);
    expect(shape(card("volumePyramid").sets)).toEqual(["75×5", "78×5", "81×5", "76.5×5", "73.5×5"]);
    expect(efforts(card("volumePyramid").sets)).toEqual([6, 7, 8, 7, 6]);
    expect(shape(card("straightSets").sets)).toEqual(Array(4).fill("65×10"));
    expect(efforts(card("straightSets").sets)).toEqual([6.9, 7.3, 7.7, 8.1]);
    expect(shape(card("dropSet").sets)).toEqual(["74×6", "74×6", "70×9", "70×9", "66×10", "66×10"]);
    expect(shape(card("mechanicalTension").sets)).toEqual(Array(6).fill("72×5"));
    expect(shape(card("eccentricAccentuated").sets)).toEqual(Array(4).fill("72×5"));
    expect(shape(card("hypertrophyCluster").sets)).toEqual(Array(3).fill("74×5+5+5"));
    expect(shape(card("forceMetabolic").sets)).toEqual(["70×5", "70×8", "70×5", "70×8", "70×5", "70×8"]);
    expect(card("densitySet", {}, { ...ctx, lift: "deadlift" }).sets[0].reps).toEqual({ kind: "timed", minutes: 15 });
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

describe("the solvers' rules", () => {
  it("keeps Tapered at one weight, with fewer taper reps than lead reps", () => {
    for (const v of everyConfig(designByKey("tapered")!, ctx)) {
      const sets = card("tapered", v).sets;
      expect(new Set(sets.map((s) => s.pct)).size).toBe(1);
      expect(v.taperReps).toBeLessThan(v.leadReps);
    }
    // Past the ceiling for its reps, a taper set becomes "up to" and the stop decides.
    const over = card("tapered", { leadReps: 10, taperReps: 8 }).sets.find((s) => s.group === "Taper")!;
    expect(over.reps).toEqual({ kind: "upTo", n: 8 });
    expect(over.rpe).toBe(7.5);
  });

  it("drops back-offs 7.5% from an RPE 8.5 top set and keeps them under its effort", () => {
    for (let top = 1; top <= 5; top++) {
      const k = card("topSetBackoff", { top });
      expect(k.sets[0].pct).toBe(intensityForRPE(top, 8.5));
      expect(k.sets[1].pct).toBe(Math.round(k.sets[0].pct * 0.925));
      for (const s of k.sets.slice(1)) expect(s.rpe).toBeLessThanOrEqual(Math.min(8.5, rpeCeiling(s.reps.kind === "fixed" ? s.reps.n : 0)));
    }
  });

  it("works sets below L* closer to failure in Straight Sets", () => {
    // 62% sits below the example's L* of 63.6: 2.5 reps in reserve. Above it, 3.5.
    expect(card("straightSets", { load: 62 }).sets[0].reps).toEqual({ kind: "fixed", n: Math.round(maxRepsAt(62) - 2.5) });
    expect(card("straightSets", { load: 66 }).sets[0].reps).toEqual({ kind: "fixed", n: Math.round(maxRepsAt(66) - 3.5) });
  });

  it("floors Mechanical Tension and Force/Metabolic at L* + 1, and Ceiling Walk too", () => {
    expect(resolve(designByKey("mechanicalTension")!, ctx).options.load[0]).toBe(65);
    expect(resolve(designByKey("forceMetabolic")!, ctx).options.load[0]).toBe(65);
    const fm = resolve(designByKey("forceMetabolic")!, ctx).options.load;
    expect(fm[fm.length - 1]).toBe(78);
    expect(resolve(designByKey("clockedSets")!, ctx).options.load).toEqual([65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
    // Without an L*, SA's standard floor; Ceiling Walk keeps its catalogue floor.
    const none = { ...ctx, lstar: null };
    expect(resolve(designByKey("mechanicalTension")!, none).options.load[0]).toBe(65);
    expect(resolve(designByKey("clockedSets")!, none).options.load[0]).toBe(70);
    // Too high an L* and there's no band left.
    expect(designByKey("forceMetabolic")!.unavailable!({ ...ctx, lstar: 77.5 })).toBeTruthy();
    expect(designByKey("mechanicalTension")!.unavailable!({ ...ctx, lstar: 79.5 })).toBeTruthy();
    expect(designByKey("clockedSets")!.unavailable!({ ...ctx, lstar: 79.5 })).toBeTruthy();
    expect(designByKey("mechanicalTension")!.unavailable!(ctx)).toBeNull();
  });

  it("keeps Density off bench and squat, and asks for a spotter before Rest-Pause on them", () => {
    expect(designByKey("densitySet")!.lifts).toEqual(["deadlift"]);
    expect(designByKey("restPauseHarvest")!.spotter).toEqual(["bench", "squat"]);
  });

  it("holds Threaded Singles' moderate sets to RPE 7", () => {
    expect(resolve(designByKey("threadedSingles")!, ctx, { single: 92 }).options.gap[0]).toBe(9);
    expect(resolve(designByKey("threadedSingles")!, ctx, { single: 92, gap: 9 }).options.reps).toEqual([3]);
  });
});

describe("the card", () => {
  it("writes the lifter's own velocities into the rules", () => {
    const k = card("clockedSets");
    const slow = (0.92 * ctx.fresh(72)!).toFixed(2);
    expect(k.rules.join(" ")).toContain(`${slow} m/s`);
    expect(card("restPauseHarvest").rules.join(" ")).toMatch(/under \d\.\d\d m\/s ends the block/);
  });

  it("ends a top set deeper than its back-offs", () => {
    const k = card("topSetBackoff");
    const f = (s: (typeof k.sets)[number]) => (s.fresh! - s.stopV!) / (s.fresh! - EXAMPLE_PROBE.mvt);
    expect(f(k.sets[0])).toBeCloseTo(rpeStopFraction(8.5), 12);
    expect(f(k.sets[1])).toBeCloseTo(rpeStopFraction(rpeAt(5, 81)), 12);
    expect(f(k.sets[0])).toBeGreaterThan(f(k.sets[1]));
  });

  it("marks singles, whose speed is a check rather than a stop", () => {
    expect(card("singles").sets.every((s) => s.single)).toBe(true);
    expect(card("singles").rules.join(" ")).toMatch(/check/);
    expect(card("topSetBackoff").sets.some((s) => s.single)).toBe(false);
  });

  it("totals a session: reps, Hanley neural dose against its band, and time", () => {
    const t = card("topSetBackoff").totals;
    expect(t.reps).toBe(18);
    expect(t.neural).toBeCloseTo(3 * (100 / 12) ** 2 + 15 * (100 / 19) ** 2, 6);
    expect(t.target).toEqual(STRENGTH_SWEET);
    expect(card("straightSets").totals.target).toEqual(NEURAL_TARGET);
    expect(t.approximate).toBe(false);
    expect(card("shrinkingSets").totals.approximate).toBe(true);
  });

  it("doesn't count reps in a timed block", () => {
    const t = card("densitySet", {}, { ...ctx, lift: "deadlift" }).totals;
    expect(t.reps).toBeNull();
    expect(t.neural).toBeNull();
    expect(t.minutes).toBe(15);
  });

  it("works without an L*: no roads, standard floors", () => {
    const none = { ...ctx, lstar: null };
    for (const d of DESIGNS) {
      if (d.lifts || d.unavailable?.(none)) continue;
      expect(buildCard(d, none).sets.every((s) => s.road === null), d.key).toBe(true);
    }
  });
});

describe("how a session feels, and hand edits", () => {
  it("has straight sets climb about half an RPE a set, and strength sets stay flat", () => {
    const felt = card("straightSets").sets.map((s) => s.felt!);
    for (let i = 1; i < felt.length; i++) {
      expect(felt[i] - felt[i - 1]).toBeGreaterThan(0.3);
      expect(felt[i] - felt[i - 1]).toBeLessThan(0.7);
    }
    const table = card("strengthPrescriptionTable").sets.map((s) => s.felt!);
    expect(table[table.length - 1] - table[0]).toBeLessThan(0.5);
  });

  it("reads a set's felt RPE as null once the stop decides the reps", () => {
    const k = card("restPauseHarvest");
    expect(k.sets[0].felt).toBeNull();
  });

  it("applies a set edit and re-reads its effort, stop and road", () => {
    const base = card("topSetBackoff");
    const k = card("topSetBackoff", {}, ctx, { 1: { pct: 60, reps: 8, next: 60 } });
    expect(k.sets[1].pct).toBe(60);
    expect(k.sets[1].reps).toEqual({ kind: "fixed", n: 8 });
    expect(k.sets[1].next).toBe(60);
    expect(k.sets[1].road).toBe("fatigue");
    expect(k.sets[1].rpe).toBe(rpeAt(8, 60));
    expect(k.sets[1].edited).toBe(true);
    expect(k.sets[2]).toMatchObject({ pct: base.sets[2].pct, edited: false });
    // The last set's rest can't be edited into existence.
    expect(card("topSetBackoff", {}, ctx, { 3: { next: 90 } }).sets[3].next).toBe(0);
  });

  it("gives every design a shape", () => {
    for (const d of DESIGNS) expect(["constant", "rising", "falling", "arc", "clustered", "interleaved"], d.key).toContain(d.shape);
  });
});
