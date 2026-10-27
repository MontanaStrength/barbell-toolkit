// Session designs (John Hanley's, from the Strength Architect catalogue and
// the Oct 24, 2026 recruitment and tension additions). Each design is a set
// structure with Hanley's defaults and ranges; the lifter's profile fills in
// the rest. Where a range comes from a solver it says so; the catalogue
// additions follow catalogue-additions-design.md.
//
// Effort is written as RPE, as the designs are. The card turns each RPE into a
// stop velocity on the lifter's own fresh speed at that load (constants.ts,
// RPE_STOP), so a top set still ends deeper than its back-offs.

import { FIRST_REP, type LiftKey } from "../constants";

export type Family = "strength" | "hypertrophy";

export type Reps =
  | { kind: "fixed"; n: number }
  /** A ceiling: the set may end sooner, at the stop. */
  | { kind: "upTo"; n: number }
  /** Reps are the outcome: go to the stop, about this many. */
  | { kind: "toStop"; about: number }
  | { kind: "cluster"; parts: number[]; intraRest: number }
  | { kind: "timed"; minutes: number };

export interface PlanSet {
  group: string;
  /** Load as % of e1RM. */
  pct: number;
  reps: Reps;
  rpe: number;
  /** The RPE is a "no harder than" ceiling, not a target. */
  ceiling?: boolean;
  /** Seconds until the next set: rest after this one, or a start-to-start clock. */
  next: number;
  clock?: boolean;
  /** Eccentric-pause-concentric seconds, when the tempo is the point. */
  tempo?: string;
}

export interface DesignCtx {
  lift: LiftKey;
  lstar: number | null;
  /** Fresh mean velocity at a load %, from the lifter's velocity–load line. */
  fresh: (pct: number) => number | null;
  /** The stop velocity for an RPE at a load %. */
  stop: (pct: number, rpe: number) => number | null;
}

export type Values = Record<string, number>;
type Bound = number | ((ctx: DesignCtx, v: Values) => number);

export interface Param {
  key: string;
  label: string;
  min: Bound;
  max: Bound;
  def: Bound;
  step?: number;
  unit?: "%" | "s" | "min";
  choices?: Array<{ value: number; label: string }>;
}

export interface Built {
  sets: PlanSet[];
  /** Session rules in the design's terms, with the lifter's velocities filled in. */
  rules: string[];
}

export interface Design {
  key: string;
  family: Family;
  /** Lifts the design may be run on; every lift when absent. */
  lifts?: LiftKey[];
  /** Lifts on which the lifter must confirm a spotter or rack safeties first. */
  spotter?: LiftKey[];
  /** Why the design can't be loaded for this lifter, if it can't. */
  unavailable?: (ctx: DesignCtx) => string | null;
  params: Param[];
  build: (v: Values, ctx: DesignCtx) => Built;
}

// ---------- shared models ----------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Brzycki reps to failure at a load %. */
export const maxRepsAt = (pct: number) => 37 - 0.36 * clamp(pct, 30, 100);

/**
 * Hanley's peak-force drop rep: the last rep still at ≥ 95% of the first rep's
 * peak force. 60% → 8, 65% → 7, 70% → 6, 75% → 5, 80% → 3, 85% → 2, 90%+ → 1.
 */
export function dropRep(pct: number): number {
  const I = clamp(pct, 30, 100);
  if (I > 90) return 1;
  const ratio = 0.3 + 0.24 * Math.pow((90 - I) / 30, 0.65);
  return Math.max(1, Math.round(maxRepsAt(I) * ratio));
}

/** Rest for peak-force-capped strength sets, by load (strengthSets solver). */
export const strengthRest = (pct: number) => (pct >= 85 ? 300 : pct >= 80 ? 240 : pct >= 75 ? 180 : 150);

/** Most reps a set can hold at a load and still stop with this many in reserve. */
const repsWithReserve = (pct: number, rir: number) => Math.floor(maxRepsAt(pct) - rir);

const S = (group: string, pct: number, reps: Reps, rpe: number, next: number, more: Partial<PlanSet> = {}): PlanSet => ({
  group,
  pct,
  reps,
  rpe,
  next,
  ...more,
});
const fixed = (n: number): Reps => ({ kind: "fixed", n });
const upTo = (n: number): Reps => ({ kind: "upTo", n });
const toStop = (about: number): Reps => ({ kind: "toStop", about });
const repeat = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));
/** The last set of a session has nothing after it. */
const close = (sets: PlanSet[]) => sets.map((s, i) => (i === sets.length - 1 ? { ...s, next: 0 } : s));

const pct = (key: string, label: string, min: Bound, max: Bound, def: Bound): Param => ({ key, label, min, max, def, unit: "%" });
const count = (key: string, label: string, min: Bound, max: Bound, def: Bound): Param => ({ key, label, min, max, def });
const secs = (key: string, label: string, min: number, max: number, def: number, step: number): Param => ({
  key,
  label,
  min,
  max,
  def,
  step,
  unit: "s",
});

const mps = (x: number | null) => (x == null ? null : `${x.toFixed(2)} m/s`);

/** The catalogue's first-rep rule, in velocity: 92% of fresh speed at the load. */
function firstRepRule(ctx: DesignCtx, load: number, extraInterval: boolean): string {
  const f = ctx.fresh(load);
  const slow = f != null ? mps(FIRST_REP.slow * f) : null;
  const then = extraInterval
    ? "let one extra interval pass; if the next first rep is still under it, you're done"
    : "you're done";
  return slow
    ? `Watch each set's first rep. Under ${slow}, 92% of your fresh speed at this load, ${then}.`
    : `When a set's first rep is clearly slower than your first set's, ${then}.`;
}

/** Where L* puts a design's lower bound, for designs floored at L* + 1. */
const lstarFloor = (ctx: DesignCtx, fallback: number) => (ctx.lstar != null ? Math.ceil(ctx.lstar + 1) : fallback);

// ---------- the catalogue ----------

export const DESIGNS: Design[] = [
  // ===== Strength =====
  {
    key: "strengthPrescriptionTable",
    family: "strength",
    params: [pct("load", "Load", 75, 90, 82), count("sets", "Sets", 3, 6, 5)],
    build: (v) => ({
      sets: close(repeat(v.sets, () => S("Work", v.load, fixed(dropRep(v.load)), 7, strengthRest(v.load), { ceiling: true }))),
      rules: [],
    }),
  },
  {
    key: "sawtooth",
    family: "strength",
    params: [pct("load", "Load", 80, 88, 85), count("sets", "Sets", 4, 8, 6)],
    build: (v) => {
      const hi = dropRep(v.load);
      const lo = Math.max(1, hi - 1);
      return {
        sets: close(repeat(v.sets, (i) => S(i % 2 ? "Higher" : "Lower", v.load, fixed(i % 2 ? hi : lo), 6, 240, { ceiling: true }))),
        rules: [],
      };
    },
  },
  {
    key: "topSetBackoff",
    family: "strength",
    params: [
      count("top", "Top set reps", 1, 5, 3),
      // The top set stays at RPE 9 or under: Brzycki reps to failure ≥ reps + 1.
      pct("topPct", "Top set load", 80, (_c, v) => Math.min(95, Math.floor((36 - v.top) / 0.36)), 88),
      pct("drop", "Back-off drop", 5, 12, 8),
      count("bSets", "Back-off sets", 2, 5, 4),
      count("bReps", "Back-off reps", 2, (_c, v) => clamp(repsWithReserve(v.topPct - v.drop, 2), 2, 8), (_c, v) => Math.min(8, v.top + 1)),
    ],
    build: (v) => ({
      sets: close([
        S("Top set", v.topPct, fixed(v.top), 8.5, 240),
        ...repeat(v.bSets, () => S("Back-off", v.topPct - v.drop, fixed(v.bReps), 6.5, 240)),
      ]),
      rules: [],
    }),
  },
  {
    key: "pureCluster",
    family: "strength",
    params: [
      count("clusters", "Clusters", 3, 5, 4),
      count("singles", "Singles per cluster", 2, 4, 3),
      pct("load", "Load", 80, 90, 87),
      secs("intra", "Rest inside a cluster", 15, 45, 15, 15),
    ],
    build: (v) => ({
      sets: close(
        repeat(v.clusters, () => S("Cluster", v.load, { kind: "cluster", parts: repeat(v.singles, () => 1), intraRest: v.intra }, 7.5, 240)),
      ),
      rules: [],
    }),
  },
  {
    key: "doublePyramid",
    family: "strength",
    params: [pct("peak", "Peak load", 85, 93, 90), count("reps", "Reps per set", 2, (_c, v) => clamp(Math.floor(maxRepsAt(v.peak) - 1), 2, 4), 3)],
    build: (v) => {
      const arc: Array<[string, number, number]> = [
        ["Ascend", -10, 7],
        ["Ascend", -5, 8],
        ["Peak", 0, 9],
        ["Descend", -6, 8],
        ["Descend", -11, 7],
      ];
      return { sets: close(arc.map(([g, o, rpe]) => S(g, v.peak + o, fixed(v.reps), rpe, 180))), rules: [] };
    },
  },
  {
    key: "singles",
    family: "strength",
    params: [
      {
        key: "mode",
        label: "Presentation",
        min: 0,
        max: 1,
        def: 0,
        choices: [
          { value: 0, label: "Straight, full rest" },
          { value: 1, label: "EMOM" },
        ],
      },
      count("count", "Singles", 4, 8, (_c, v) => (v.mode ? 6 : 5)),
      pct("load", "Load", 85, 93, 88),
    ],
    build: (v) => ({
      sets: close(
        repeat(v.count, () =>
          v.mode ? S("Single", v.load, fixed(1), 7.5, 60, { clock: true }) : S("Single", v.load, fixed(1), 8, 300),
        ),
      ),
      rules: [],
    }),
  },
  {
    key: "rampingSingles",
    family: "strength",
    params: [
      pct("top", "Top single", 88, 95, 90),
      count("bSets", "Back-off sets", 2, 4, 3),
      count("bReps", "Back-off reps", 2, 3, 3),
      pct("drop", "Back-off drop", 8, 15, 12),
    ],
    build: (v) => {
      const ramp: Array<[number, number]> = [
        [-15, 7],
        [-10, 7],
        [-5, 7.5],
        [0, 8.5],
      ];
      return {
        sets: close([
          ...ramp.map(([o, rpe], i) => S("Ramp", v.top + o, fixed(1), rpe, i === ramp.length - 1 ? 150 : 120)),
          ...repeat(v.bSets, () => S("Back-off", v.top - v.drop, fixed(v.bReps), 7, 150)),
        ]),
        rules: [],
      };
    },
  },
  {
    key: "threadedSingles",
    family: "strength",
    params: [
      count("pairs", "Set-and-single pairs", 4, 6, 5),
      pct("single", "Single load", 85, 92, 88),
      pct("gap", "Moderate sets, points under the single", 8, 12, 11),
      count("reps", "Moderate reps", 3, 4, 4),
    ],
    build: (v, ctx) => {
      const v9 = mps(ctx.stop(v.single, 9));
      return {
        sets: close(
          repeat(v.pairs, () => [
            S("Moderate", v.single - v.gap, fixed(v.reps), 7, 90, { ceiling: true }),
            S("Single", v.single, fixed(1), 8, 120, { ceiling: true }),
          ]).flat(),
        ),
        rules: [
          v9
            ? `A single slower than ${v9} reads RPE 9: that ends the singles for the day. Finish the moderate sets.`
            : "A single that reads RPE 9 ends the singles for the day. Finish the moderate sets.",
          "Plan plates so each swap is one plate a side.",
        ],
      };
    },
  },
  {
    key: "routeSwap",
    family: "strength",
    params: [
      {
        key: "order",
        label: "Order",
        min: 0,
        max: 1,
        def: 0,
        choices: [
          { value: 0, label: "Heavy first" },
          { value: 1, label: "Volume first" },
        ],
      },
      count("aSets", "Heavy doubles", 3, 5, 4),
      pct("aPct", "Heavy load", 85, 88, 87),
      pct("bPct", "Volume load", 68, 72, 70),
    ],
    build: (v, ctx) => {
      const heavy = repeat(v.aSets, () => S("Heavy", v.aPct, fixed(2), 8, 180, { ceiling: true }));
      const volume = repeat(2, () => S("Volume", v.bPct, toStop(8), 8, 240));
      const lead = v.order ? volume : heavy;
      const follow = v.order ? heavy : volume;
      const f = ctx.fresh(v.aPct);
      return {
        sets: close([...lead.map((s, i) => (i === lead.length - 1 ? { ...s, next: 300 } : s)), ...follow]),
        rules: [
          f != null
            ? `Heavy doubles: a set whose first rep comes in under ${mps(FIRST_REP.carryOn * f)}, 95% of your fresh speed at that load, is the block's last. Heavy work is cut, not rescued.`
            : "Heavy doubles: a set whose first rep is clearly slower than the first set's is the block's last.",
          "The volume sets stop two reps short, at the stop velocity. Never to failure.",
        ],
      };
    },
  },
  {
    key: "recruitmentCrossover",
    family: "strength",
    params: [pct("dbl", "Doubles", 80, 85, 83), pct("mod", "Moderate sets", 68, 72, 70), pct("fin", "Finisher", 55, 60, 58)],
    build: (v) => ({
      sets: close([
        ...repeat(2, () => S("Doubles", v.dbl, fixed(2), 7.5, 150, { ceiling: true })),
        ...repeat(3, (i) => S("Moderate", v.mod, fixed(4), 7, i === 2 ? 180 : 90, { ceiling: true })),
        S("Finisher", v.fin, toStop(Math.round(maxRepsAt(v.fin) - 2)), 8, 0),
      ]),
      rules: ["Three jobs: heavy practice, quality volume, one honest finisher two reps short."],
    }),
  },
  {
    key: "boundedDescent",
    family: "strength",
    params: [
      pct("top", "Wave top", 80, 85, 83),
      pct("mid", "Middle", 75, 78, 77),
      pct("low", "Low", 68, 72, 70),
      count("lowReps", "Reps at the low load", 2, 4, 3),
    ],
    build: (v, ctx) => {
      const wave = (w: number) => [
        S(`Wave ${w}`, v.top, fixed(2), 7.5, 90, { ceiling: true }),
        S(`Wave ${w}`, v.mid, fixed(3), 7.5, 90, { ceiling: true }),
        S(`Wave ${w}`, v.low, fixed(v.lowReps), 7.5, 180, { ceiling: true }),
      ];
      const cut = mps(ctx.stop(v.top, 8.5));
      return {
        sets: close([...wave(1), ...wave(2)]),
        rules: [
          cut
            ? `Cut the second wave's double if a rep comes in under ${cut}: that reads RPE 8.5 or more.`
            : "Cut the second wave's double if it reads RPE 8.5 or more.",
        ],
      };
    },
  },

  // ===== Hypertrophy =====
  {
    key: "tapered",
    family: "hypertrophy",
    params: [
      pct("lead", "Lead load", 65, 80, 75),
      count("leadSets", "Lead sets", 1, 3, 2),
      count("leadReps", "Lead reps", 4, (_c, v) => clamp(repsWithReserve(v.lead, 2.5), 4, 8), 6),
      pct("drop", "Taper drop", 0, 12, 8),
      count("taperSets", "Taper sets", 2, 4, 3),
      count("taperReps", "Taper reps", 6, (_c, v) => clamp(repsWithReserve(v.lead - v.drop, 2.5), 6, 12), 10),
    ],
    build: (v) => ({
      sets: close([
        ...repeat(v.leadSets, () => S("Lead", v.lead, fixed(v.leadReps), 7.5, 150)),
        ...repeat(v.taperSets, () => S("Taper", v.lead - v.drop, fixed(v.taperReps), 7, 150)),
      ]),
      rules: [],
    }),
  },
  {
    key: "ascendingPyramid",
    family: "hypertrophy",
    params: [pct("top", "Top load", 72, 80, 78), count("sets", "Sets", 3, 4, 4)],
    build: (v) => {
      const full: Array<[number, number, number]> = [
        [12, -16, 6.5],
        [10, -10, 7],
        [8, -5, 7.5],
        [6, 0, 8],
      ];
      return {
        sets: close(full.slice(4 - v.sets).map(([reps, o, rpe]) => S("Pyramid", v.top + o, fixed(reps), rpe, 120))),
        rules: [],
      };
    },
  },
  {
    key: "reversePyramid",
    family: "hypertrophy",
    params: [pct("top", "Top load", 74, 80, 78), count("sets", "Sets", 3, 4, 3), pct("step", "Drop per set", 4, 8, 6)],
    build: (v) => {
      const reps = [6, 8, 10, 12];
      const rpe = [8, 7.5, 7, 6.5];
      return { sets: close(repeat(v.sets, (i) => S("Pyramid", v.top - v.step * i, fixed(reps[i]), rpe[i], 150))), rules: [] };
    },
  },
  {
    key: "volumePyramid",
    family: "hypertrophy",
    params: [pct("peak", "Peak load", 75, 82, 79), count("reps", "Reps per set", 4, (_c, v) => clamp(repsWithReserve(v.peak, 2), 4, 6), 5)],
    build: (v) => {
      const arc: Array<[string, number, number]> = [
        ["Ascend", -6, 7],
        ["Ascend", -3, 7.5],
        ["Peak", 0, 8],
        ["Descend", -4, 7.5],
        ["Descend", -7, 7],
      ];
      return { sets: close(arc.map(([g, o, rpe]) => S(g, v.peak + o, fixed(v.reps), rpe, 150))), rules: [] };
    },
  },
  {
    key: "straightSets",
    family: "hypertrophy",
    params: [
      pct("load", "Load", 55, 80, 65),
      count("sets", "Sets", 3, 5, 4),
      // At 74% and up, reps cap at the peak-force drop rep (straightSets solver).
      count("reps", "Reps", 3, (_c, v) => (v.load >= 74 ? dropRep(v.load) : Math.min(15, repsWithReserve(v.load, 3))), (_c, v) =>
        v.load >= 74 ? dropRep(v.load) : 8,
      ),
    ],
    // RPE drifts about half a point a set at the same load.
    build: (v) => ({ sets: close(repeat(v.sets, (i) => S("Work", v.load, fixed(v.reps), Math.min(9, 6.5 + 0.5 * i), 90))), rules: [] }),
  },
  {
    key: "dropSet",
    family: "hypertrophy",
    params: [
      pct("top", "First tier load", 68, 78, 74),
      count("tiers", "Tiers", 2, 4, 3),
      count("per", "Sets per tier", 1, 2, 2),
      pct("step", "Drop per tier", 4, 10, 8),
    ],
    build: (v) => {
      const reps = [6, 8, 10, 12];
      const rpe = [7, 7.5, 8, 8.5];
      return {
        sets: close(
          repeat(v.tiers, (t) => repeat(v.per, () => S(`Tier ${t + 1}`, Math.max(45, v.top - v.step * t), fixed(reps[t]), rpe[t], 90))).flat(),
        ),
        rules: [],
      };
    },
  },
  {
    key: "mechanicalTension",
    family: "hypertrophy",
    params: [pct("load", "Load", 65, 80, 78), count("sets", "Sets", 4, 10, 6), count("reps", "Reps", 2, (_c, v) => dropRep(v.load), 3)],
    build: (v) => ({ sets: close(repeat(v.sets, () => S("Work", v.load, fixed(v.reps), 6, 180, { ceiling: true }))), rules: [] }),
  },
  {
    key: "eccentricAccentuated",
    family: "hypertrophy",
    params: [
      pct("load", "Load", 65, 75, 72),
      count("sets", "Sets", 3, 5, 4),
      count("reps", "Reps", 4, 6, 5),
      secs("ecc", "Eccentric", 3, 4, 4, 1),
    ],
    build: (v) => ({
      sets: close(
        repeat(v.sets, () => S("Work", v.load, fixed(v.reps), 7, v.ecc >= 4 || v.load >= 75 ? 180 : 150, { tempo: `${v.ecc}-0-1` })),
      ),
      rules: [`Lower for ${v.ecc} s, no pause, then drive up. Read the concentric speed only.`],
    }),
  },
  {
    key: "forceMetabolic",
    family: "hypertrophy",
    // One load for both kinds of set; the force sets are floored at L* + 1
    // (forceMetabolic solver), and above 72% the metabolic sets turn into grinds.
    unavailable: (ctx) => (lstarFloor(ctx, 62) > 72 ? "Your L* sits above this design's load band (62 to 72%)." : null),
    params: [
      count("pairs", "Force-and-metabolic pairs", 2, 4, 3),
      pct("load", "Load", (ctx) => Math.max(62, lstarFloor(ctx, 62)), 72, 72),
      count("fReps", "Force reps", 2, (_c, v) => clamp(dropRep(v.load), 2, 5), 4),
      count("mReps", "Metabolic reps", (_c, v) => v.fReps + 2, (_c, v) => clamp(repsWithReserve(v.load, 3), v.fReps + 2, 10), 8),
    ],
    build: (v) => ({
      sets: close(
        repeat(v.pairs, () => [
          S("Force", v.load, fixed(v.fReps), 7.5, 150, { ceiling: true }),
          S("Metabolic", v.load, fixed(v.mReps), 7, 150),
        ]).flat(),
      ),
      rules: [],
    }),
  },
  {
    key: "hypertrophyCluster",
    family: "hypertrophy",
    params: [
      count("clusters", "Clusters", 2, 4, 3),
      count("minis", "Mini-sets per cluster", 2, 3, 3),
      count("reps", "Reps per mini-set", 3, 6, 5),
      pct("load", "Load", 70, 78, 74),
      secs("intra", "Rest inside a cluster", 10, 20, 15, 5),
    ],
    build: (v) => ({
      sets: close(repeat(v.clusters, () => S("Cluster", v.load, { kind: "cluster", parts: repeat(v.minis, () => v.reps), intraRest: v.intra }, 7.5, 180))),
      rules: [],
    }),
  },
  {
    key: "densitySet",
    family: "hypertrophy",
    // Never an AMRAP under a barbell without a spotter: off bench and squat.
    lifts: ["deadlift"],
    params: [{ key: "minutes", label: "Duration", min: 6, max: 12, def: 10, unit: "min" }, pct("load", "Load", 60, 70, 65)],
    build: (v) => ({
      sets: [S("Density block", v.load, { kind: "timed", minutes: v.minutes }, 7, 0, { ceiling: true })],
      rules: ["Self-paced: rest as needed and keep every rep clean. End each run of reps at the stop velocity."],
    }),
  },
  {
    key: "clockedSets",
    family: "hypertrophy",
    unavailable: (ctx) => (lstarFloor(ctx, 70) > 80 ? "Your L* sits above this design's band: its floor is L* + 1 and its ceiling 80%." : null),
    params: [
      pct("load", "Load", (ctx) => lstarFloor(ctx, 70), 80, (ctx) => clamp(72, lstarFloor(ctx, 70), 78)),
      count("sets", "Sets", 8, 12, 10),
      secs("clock", "Every", 90, 120, 105, 15),
    ],
    build: (v, ctx) => ({
      sets: close(repeat(v.sets, () => S("Set", v.load, fixed(clamp(dropRep(v.load), 3, 4)), 7, v.clock, { ceiling: true, clock: true }))),
      rules: ["Same bar speed every set.", firstRepRule(ctx, v.load, true)],
    }),
  },
  {
    key: "restPauseHarvest",
    family: "hypertrophy",
    spotter: ["bench", "squat"],
    params: [pct("load", "Load", 72, 78, 75), secs("intra", "Rest inside a block", 20, 30, 20, 5)],
    build: (v, ctx) => {
      const block = (b: number) => [
        S(`Block ${b}, activation`, v.load, toStop(Math.round(maxRepsAt(v.load) - 2)), 8, v.intra),
        ...repeat(3, (i) => S(`Block ${b}, mini-set`, v.load, upTo(3), 9, i === 2 ? (b === 1 ? 360 : 0) : v.intra)),
      ];
      const v9 = mps(ctx.stop(v.load, 9));
      return {
        sets: close([...block(1), ...block(2)]),
        rules: [
          "The activation set stops two reps short. Each mini-set stops one short. No rep is a grind.",
          v9
            ? `A mini-set whose first rep is already under ${v9} ends the block.`
            : "A mini-set whose first rep already reads RPE 9 ends the block.",
        ],
      };
    },
  },
  {
    key: "shrinkingSets",
    family: "hypertrophy",
    params: [pct("load", "Load", 68, 74, 71), count("starts", "Starts", 6, 8, 8), secs("clock", "Every", 75, 105, 90, 15)],
    build: (v, ctx) => ({
      sets: close(repeat(v.starts, () => S("Bout", v.load, upTo(4), 7, v.clock, { ceiling: true, clock: true }))),
      rules: [
        "Four reps is a ceiling. End a bout at the stop velocity, and start the next one a rep lower.",
        firstRepRule(ctx, v.load, true),
        `The ${v.starts} starts are a ceiling, not an obligation: ${v.starts * 4} reps at most.`,
      ],
    }),
  },
  {
    key: "recoveryIslands",
    family: "hypertrophy",
    params: [
      pct("load", "Load", 68, 75, 72),
      count("blocks", "Blocks", 3, 5, 4),
      secs("pair", "Rest between pairs", 30, 60, 45, 15),
      secs("block", "Rest between blocks", 150, 210, 180, 30),
    ],
    build: (v, ctx) => {
      const f = ctx.fresh(v.load);
      return {
        sets: close(
          repeat(v.blocks, (b) => repeat(3, (i) => S(`Block ${b + 1}`, v.load, fixed(2), 6.5, i === 2 ? v.block : v.pair, { ceiling: true }))).flat(),
        ),
        rules: [
          "Every pair looks like the first.",
          f != null
            ? `If the first pair after a long rest starts under ${mps(FIRST_REP.slow * f)}, the rest didn't bring the speed back: you're done.`
            : "If the long rest doesn't bring the speed back, you're done.",
        ],
      };
    },
  },
];

export const designByKey = (key: string) => DESIGNS.find((d) => d.key === key) ?? null;

/** Settle every parameter in order, each inside bounds that may depend on the ones before it. */
export function resolve(d: Design, ctx: DesignCtx, input: Partial<Values> = {}) {
  const values: Values = {};
  const bounds: Record<string, [number, number]> = {};
  for (const p of d.params) {
    const at = (b: Bound) => (typeof b === "function" ? b(ctx, values) : b);
    const lo = at(p.min);
    const hi = Math.max(lo, at(p.max));
    const step = p.step ?? 1;
    const raw = input[p.key] ?? at(p.def);
    values[p.key] = clamp(Math.round(raw / step) * step, lo, hi);
    bounds[p.key] = [lo, hi];
  }
  return { values, bounds };
}
