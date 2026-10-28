// Session designs (John Hanley's): the eighteen Strength Architect rotation
// designs and the eight recruitment and tension additions of Oct 24, 2026.
//
// The eighteen are built the way SA's solvers build them (modeling/schemes,
// origin/main, Oct 27, 2026). The knobs step through each solver's own option
// lists, load comes from reps and RPE on the effort curve (effort.ts), and
// rest and RPE follow the solver's rules for that load. SA's solvers also size
// the volume to a budget and rotate through what fits; here the lifter picks.
//
// Loads stay inside each solver's limits. Where a solver takes its loads only
// from the block's band, strength designs use SA's strength band, 73–92%, and
// drop sets 55–80%, the widest window the hypertrophy solvers reach.
//
// The eight additions follow catalogue-additions-design.md. They have no
// solver yet, so their knobs are the catalogue's ranges, held back wherever
// the curve says a set would pass its RPE ceiling.
//
// Effort is written as RPE, as the designs are. The card turns each RPE into a
// stop velocity on the lifter's own fresh speed at that load (constants.ts,
// RPE_STOP), so a top set still ends deeper than its back-offs.

import { FIRST_REP, type LiftKey } from "../constants";
import { dropRep, intensityForRPE, maxRepsAt, rpeAt, rpeCeiling } from "./effort";

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
  /** The effort the set ends at, to one decimal: from the curve, or the solver's own figure for this kind of set. */
  rpe: number;
  /** The RPE is a "no harder than" ceiling, not a target. */
  ceiling?: boolean;
  /** Seconds until the next set: rest after this one, or a start-to-start clock. */
  next: number;
  clock?: boolean;
  /** Eccentric-pause-concentric-pause seconds, when the tempo is the point. */
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

export interface Param {
  key: string;
  label: string;
  /** Every value the knob may take for this lifter, given the knobs before it, in stepping order. */
  values: (ctx: DesignCtx, v: Values) => number[];
  /** Where the knob starts, before the lifter touches it. */
  def: number | ((ctx: DesignCtx, v: Values, allowed: number[]) => number);
  unit?: "%" | "s" | "min";
  /** Words for a value, when the number alone doesn't say it; v holds the knobs as resolved. */
  show?: (value: number, v: Values) => string;
  /** The values name options (a shape, an order) rather than measure anything. */
  coded?: boolean;
  /** A few options: show them as buttons. */
  buttons?: boolean;
}

export interface Built {
  sets: PlanSet[];
  /** Session rules in the design's terms, with the lifter's velocities filled in. */
  rules: string[];
}

/** The shape of a design's loads across the session, for filtering the catalogue. */
export type Shape = "constant" | "rising" | "falling" | "arc" | "clustered" | "interleaved";
export const SHAPE_NAMES: Record<Shape, string> = {
  constant: "Same load",
  rising: "Rising",
  falling: "Falling",
  arc: "Arc",
  clustered: "Clustered",
  interleaved: "Interleaved",
};

export interface Design {
  key: string;
  family: Family;
  shape: Shape;
  /** Lifts the design may be run on; every lift when absent. */
  lifts?: LiftKey[];
  /** Lifts on which the lifter must confirm a spotter or rack safeties first. */
  spotter?: LiftKey[];
  /** Why the design can't be loaded for this lifter, if it can't. */
  unavailable?: (ctx: DesignCtx) => string | null;
  params: Param[];
  build: (v: Values, ctx: DesignCtx) => Built;
}

// ---------- helpers ----------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Whole numbers from lo to hi. */
const span = (lo: number, hi: number) => {
  const out: number[] = [];
  for (let x = Math.ceil(lo); x <= hi; x++) out.push(x);
  return out;
};
const nearest = (xs: number[], x: number) =>
  xs.reduce((best, y) => (Math.abs(y - x) < Math.abs(best - x) ? y : best), xs[0]);
const indices = <T,>(xs: T[]) => xs.map((_, i) => i);
const round1 = (x: number) => Math.round(x * 10) / 10;

type Allowed = number[] | ((ctx: DesignCtx, v: Values) => number[]);
function knob(key: string, label: string, values: Allowed, def: Param["def"], more: Partial<Param> = {}): Param {
  return { key, label, values: typeof values === "function" ? values : () => values, def, ...more };
}
const loadKnob = (key: string, label: string, values: Allowed, def: Param["def"]) => knob(key, label, values, def, { unit: "%" });
const rpeWords = (x: number) => `RPE ${x}`;

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

/** A single has nothing to stop; its speed is the check. */
const singlesCheck = (then: string) =>
  `A single has no stop: its listed speed is the check. One that comes in slower is harder than planned, so ${then}.`;

/**
 * The load floor for designs that only pay on the load road: L* + 1, as SA's
 * solvers set it. SA uses 65% when it has no L* for the lift.
 */
const lstarFloor = (ctx: DesignCtx, fallback = 65) => (ctx.lstar != null ? Math.ceil(ctx.lstar) + 1 : fallback);

// ---------- the solvers' rules ----------

/** SA's strength goal band, % of max (GOAL_PROFILES.strength). */
const STRENGTH: [number, number] = [73, 92];
/** Drop sets take their loads only from the block's band; this is the widest the hypertrophy solvers reach. */
const DROP_WINDOW: [number, number] = [55, 80];

/** Rest for peak-force-capped strength sets (strengthSets). */
export const strengthRest = (pct: number) => (pct >= 85 ? 300 : pct >= 80 ? 240 : pct >= 75 ? 180 : 150);

// Sawtooth: the perform set sits about three reps from failure, the practice set two or three under it.
const sawtoothPerform = (pct: number) => Math.max(2, Math.round(maxRepsAt(pct) - 3));
function sawtoothPractice(pct: number): number[] {
  const high = sawtoothPerform(pct);
  if (high <= 3) return [1];
  return [high - 3, high - 2].filter((r) => r >= 1);
}

// Top set + back-off: the top set lands at RPE 8.5 (95% at most); back-offs 7.5% lighter.
const TOP_RPE = 8.5;
const topSetPct = (reps: number) => Math.min(95, intensityForRPE(reps, TOP_RPE));
const backoffPct = (top: number) => Math.max(30, Math.round(topSetPct(top) * (1 - 7.5 / 100)));
const backoffReps = (top: number) =>
  span(2, 8).filter((r) => rpeAt(r, backoffPct(top)) <= Math.min(TOP_RPE, rpeCeiling(r)));

// Symmetric arcs (double and volume pyramids): RPE [p−2, p−1, p, p−1, p−2], the
// descent 1.5 points lighter than the matching ascent set.
type ArcFamily = "strength" | "hypertrophy";
function arc(reps: number, peak: number) {
  const up = [peak - 2, peak - 1, peak].map((rpe) => ({ rpe, pct: intensityForRPE(reps, rpe) }));
  const down = [peak - 1, peak - 2].map((rpe) => ({ rpe, pct: round1(intensityForRPE(reps, rpe) - 1.5) }));
  return [...up, ...down];
}
function arcPeaks(reps: number, family: ArcFamily): number[] {
  const cap = rpeCeiling(reps);
  const peaks = family === "hypertrophy" ? [Math.min(8, cap)] : [...new Set([7.5, 8, 8.5, 9].map((p) => Math.min(p, cap)))];
  // Strength arcs also sit inside the strength band.
  const [lo, hi] = family === "strength" ? STRENGTH : [-Infinity, Infinity];
  return peaks.filter((p) => {
    if (p < 7) return false;
    const a = arc(reps, p);
    return a[2].pct >= Math.max(lo, 68) && a[2].pct <= Math.min(hi, 92) && a[0].pct >= Math.max(55, lo - 10);
  });
}
const ARC_GROUPS = ["Ascend", "Ascend", "Peak", "Descend", "Descend"];

// Rep templates for the ascending and reverse pyramids, and the effort ramps
// the solvers try on them: a top RPE and a step per set.
const ASCENDING = [
  [12, 10, 8], [10, 8, 6], [12, 10, 8, 6], [10, 8, 6, 4], [12, 10, 8, 8], [10, 8, 6, 6],
  [12, 12, 10, 8, 6], [12, 10, 10, 8, 6], [12, 10, 8, 6, 4], [14, 12, 10, 8, 6],
  [14, 12, 10, 8, 6, 6], [12, 12, 10, 8, 8, 6],
];
const REVERSE = [
  [8, 10, 12], [6, 8, 10], [6, 8, 10, 12], [4, 6, 8, 10], [8, 8, 10, 12], [6, 6, 8, 10],
  [6, 8, 10, 12, 12], [6, 8, 10, 10, 12], [4, 6, 8, 10, 12], [6, 8, 10, 12, 14],
  [6, 6, 8, 10, 12, 14], [6, 8, 8, 10, 12, 12],
];
const PYRAMID_TOPS = [7, 7.5, 8, 8.5];
const PYRAMID_STEPS = [0.5, 0.75];
type Direction = "up" | "down";

/** One pyramid: each set's RPE steps toward the top set, held to the ceiling for its reps, and its load follows. */
function pyramid(reps: number[], dir: Direction, effort: number) {
  const top = PYRAMID_TOPS[Math.floor(effort / 2)];
  const step = PYRAMID_STEPS[effort % 2];
  const n = reps.length;
  return reps.map((r, i) => {
    const away = dir === "up" ? n - 1 - i : i;
    const rpe = Math.min(rpeCeiling(r), Math.round((top - step * away) * 2) / 2);
    return { reps: r, rpe, pct: intensityForRPE(r, rpe) };
  });
}
function pyramidValid(sets: ReturnType<typeof pyramid>, dir: Direction): boolean {
  const pcts = sets.map((s) => s.pct);
  const climbs = pcts.every((p, i) => i === 0 || (dir === "up" ? p > pcts[i - 1] : p < pcts[i - 1]));
  const top = dir === "up" ? pcts[pcts.length - 1] : pcts[0];
  const light = dir === "up" ? pcts[0] : pcts[pcts.length - 1];
  return climbs && top >= 68 && top <= 82 && light >= 48;
}
/** The effort ramps that work on a template, one per distinct result, easiest first. */
function pyramidEfforts(reps: number[], dir: Direction): number[] {
  const seen = new Map<string, { code: number; sum: number }>();
  for (let code = 0; code < PYRAMID_TOPS.length * PYRAMID_STEPS.length; code++) {
    const sets = pyramid(reps, dir, code);
    if (!pyramidValid(sets, dir)) continue;
    const key = sets.map((s) => s.rpe).join("/");
    if (!seen.has(key)) seen.set(key, { code, sum: sets.reduce((t, s) => t + s.pct, 0) });
  }
  return [...seen.values()].sort((a, b) => a.sum - b.sum || a.code - b.code).map((x) => x.code);
}
const pyramidEffortWords = (reps: number[], dir: Direction, code: number) =>
  `RPE ${pyramid(reps, dir, code).map((s) => s.rpe).join(" / ")}`;
/** SA's first top RPE and step, or the nearest that works. */
const pyramidDefault = (allowed: number[]) => (allowed.includes(4) ? 4 : allowed[Math.floor(allowed.length / 2)]);

// Tapered: lead sets at RPE 7.5 (the ceiling for six or more reps), taper sets
// at the same weight with fewer reps, read at the capacity left after the lead
// sets (SA: 75%).
const LEAD_RPE = 7.5;
const TAPER_RETENTION = 0.75;
const taperedPct = (leadReps: number) => clamp(intensityForRPE(leadReps, LEAD_RPE), 55, 85);
const taperModel = (leadReps: number, taperReps: number) =>
  round1(10 - (maxRepsAt(taperedPct(leadReps)) * TAPER_RETENTION - taperReps));

// Straight sets: below 74% the reps leave 3.5 in reserve on the load road and
// 2.5 below L*; from 74% they stop at the drop rep. RPE climbs set to set.
const STRAIGHT_RPE_MIN = 6.5;
const STRAIGHT_RPE_MAX = 8.2;
function straightPlan(pct: number, ctx: DesignCtx) {
  const onLoadRoad = ctx.lstar != null && pct >= ctx.lstar;
  const reps = pct < 74 ? Math.max(3, Math.round(maxRepsAt(pct) - (onLoadRoad ? 10 - 6.5 : 2.5))) : dropRep(pct);
  const first = rpeAt(reps, pct);
  const accrual = pct < 65 ? 0.3 : pct < 70 ? 0.4 : 0.5;
  const maxSets = Math.max(2, Math.floor((STRAIGHT_RPE_MAX - first) / accrual) + 1);
  return { reps, first, accrual, maxSets };
}

// Drop sets: each tier takes the most reps that keep it under its RPE ceiling.
const firstTierCeiling = (pct: number) => (pct >= 80 ? 8 : pct >= 75 ? 7.5 : 7);
function dropTiers(start: number, tiers: number, step: number, later: number) {
  return repeat(tiers, (t) => {
    const pct = start - step * t;
    const ceiling = t === 0 ? firstTierCeiling(pct) : later;
    for (let r = Math.floor(maxRepsAt(pct)); r >= (t === 0 ? 3 : 4); r--) {
      if (rpeAt(r, pct) <= ceiling) return { pct, reps: r };
    }
    return null;
  });
}

// Force/metabolic: one load; force sets stop at the drop rep, metabolic sets
// take the reps for RPE 6.5 to 7.5, within the ceiling for their count.
const FM_CEILING = 78;
function metabolicReps(pct: number): number[] {
  const force = dropRep(pct);
  const out = new Set<number>();
  for (const target of [6.5, 7, 7.5]) {
    const reps = Math.max(1, Math.round(maxRepsAt(pct) - (10 - target)));
    const rpe = rpeAt(reps, pct);
    if (reps > force && reps <= 15 && rpe >= 6 && rpe <= rpeCeiling(reps)) out.add(reps);
  }
  return [...out].sort((a, b) => a - b);
}
const fmLoads = (ctx: DesignCtx) => span(lstarFloor(ctx), FM_CEILING).filter((p) => metabolicReps(p).length > 0);

// Cluster and tempo shapes: [reps per mini-set, mini-sets, seconds between].
const PURE_CLUSTERS = [
  { reps: 1, minis: 3, intra: 15 },
  { reps: 2, minis: 2, intra: 20 },
];
const HYP_CLUSTERS = [
  { reps: 5, minis: 3, intra: 15 },
  { reps: 4, minis: 3, intra: 15 },
  { reps: 3, minis: 3, intra: 15 },
  { reps: 6, minis: 2, intra: 20 },
  { reps: 5, minis: 2, intra: 20 },
];
const hypClusterRpe = (pct: number, reps: number) => (pct >= 76 ? (reps >= 5 ? 8 : 7.5) : reps >= 5 ? 7.5 : 7);
const clusterWords = (c: { reps: number; minis: number; intra: number }) =>
  `${Array(c.minis).fill(c.reps).join("+")}, ${c.intra} s between`;
const ECCENTRICS = [
  { sets: 4, reps: 5, ecc: 4 },
  { sets: 5, reps: 4, ecc: 3 },
  { sets: 3, reps: 6, ecc: 5 },
  { sets: 4, reps: 4, ecc: 3 },
  { sets: 3, reps: 5, ecc: 4 },
];
const eccentricRpe = (e: { ecc: number }, pct: number) => (e.ecc >= 4 ? (pct >= 75 ? 7.5 : 7) : pct >= 75 ? 7 : 6.5);

// ---------- the catalogue ----------

export const DESIGNS: Design[] = [
  // ===== Strength =====
  {
    key: "strengthPrescriptionTable",
    shape: "constant",
    family: "strength",
    params: [
      // Every rep a quality rep: reps stop at the drop rep, so loads that allow only one are out.
      loadKnob("load", "Load", span(...STRENGTH).filter((p) => dropRep(p) > 1), 82),
      knob("sets", "Sets", span(3, 6), 5),
    ],
    build: (v) => {
      const reps = dropRep(v.load);
      return {
        sets: close(repeat(v.sets, () => S("Work", v.load, fixed(reps), rpeAt(reps, v.load), strengthRest(v.load)))),
        rules: [],
      };
    },
  },
  {
    key: "sawtooth",
    shape: "interleaved",
    family: "strength",
    params: [
      loadKnob("load", "Load", span(...STRENGTH), 85),
      knob("low", "Practice-set reps", (_c, v) => sawtoothPractice(v.load), (_c, _v, allowed) => allowed[allowed.length - 1]),
      knob("pairs", "Practice-and-perform pairs", span(2, 8), 3),
    ],
    build: (v) => {
      const high = sawtoothPerform(v.load);
      const rest = v.load >= 85 ? 240 : v.load >= 80 ? 210 : 180;
      return {
        sets: close(
          repeat(v.pairs, () => [
            S("Practice", v.load, fixed(v.low), rpeAt(v.low, v.load), rest),
            S("Perform", v.load, fixed(high), rpeAt(high, v.load), rest),
          ]).flat(),
        ),
        rules: [],
      };
    },
  },
  {
    key: "topSetBackoff",
    shape: "falling",
    family: "strength",
    params: [
      knob("top", "Top-set reps", span(1, 5), 3),
      knob("bReps", "Back-off reps", (_c, v) => backoffReps(v.top), (_c, v) => Math.min(8, v.top + 2)),
      knob("bSets", "Back-off sets", span(2, 6), 3),
    ],
    build: (v) => {
      const top = topSetPct(v.top);
      const back = backoffPct(v.top);
      return {
        sets: close([
          S("Top set", top, fixed(v.top), TOP_RPE, top >= 92 ? 300 : top >= 88 ? 270 : top >= 85 ? 240 : 210),
          ...repeat(v.bSets, () =>
            S("Back-off", back, fixed(v.bReps), rpeAt(v.bReps, back), back >= 85 ? 240 : back >= 80 ? 210 : back >= 75 ? 180 : 150),
          ),
        ]),
        rules: [],
      };
    },
  },
  {
    key: "pureCluster",
    shape: "clustered",
    family: "strength",
    params: [
      loadKnob("load", "Load", [80, 82, 85, 87, 90], 87),
      // Doubles only where the drop rep allows two.
      knob("shape", "Each cluster", (_c, v) => indices(PURE_CLUSTERS).filter((i) => PURE_CLUSTERS[i].reps <= dropRep(v.load)), 0, {
        coded: true,
        buttons: true,
        show: (i) => clusterWords(PURE_CLUSTERS[i]),
      }),
      knob("clusters", "Clusters", [2, 3, 4, 5], 4),
    ],
    build: (v) => {
      const c = PURE_CLUSTERS[v.shape];
      const rpe = c.reps === 1 ? (v.load >= 87 ? 7.5 : 7) : v.load >= 85 ? 8 : 7.5;
      const rest = v.load >= 87 ? 240 : v.load >= 82 ? 210 : 180;
      return {
        sets: close(repeat(v.clusters, () => S("Cluster", v.load, { kind: "cluster", parts: Array(c.minis).fill(c.reps), intraRest: c.intra }, rpe, rest))),
        rules: [],
      };
    },
  },
  {
    key: "doublePyramid",
    shape: "arc",
    family: "strength",
    params: [
      knob("reps", "Reps per set", [2, 3, 5].filter((r) => arcPeaks(r, "strength").length > 0), 3),
      knob("peak", "Peak effort", (_c, v) => arcPeaks(v.reps, "strength"), (_c, _v, allowed) => allowed[allowed.length - 1], {
        show: rpeWords,
      }),
    ],
    build: (v) => ({
      sets: close(arc(v.reps, v.peak).map((s, i) => S(ARC_GROUPS[i], s.pct, fixed(v.reps), s.rpe, 180))),
      rules: [],
    }),
  },
  {
    key: "singles",
    shape: "constant",
    family: "strength",
    params: [
      knob("mode", "Presentation", [0, 1], 0, { coded: true, buttons: true, show: (x) => (x ? "EMOM" : "Straight, full rest") }),
      knob("count", "Singles", span(5, 8), (_c, v) => (v.mode ? 6 : 5)),
      loadKnob("load", "Load", (_c, v) => (v.mode ? [88, 90, 92] : [85, 87, 88, 90, 92]), 88),
    ],
    build: (v) => {
      if (v.mode) {
        const rpe = v.load >= 92 ? 8.5 : v.load >= 90 ? 8 : 7.5;
        return {
          sets: close(repeat(v.count, () => S("Single", v.load, fixed(1), rpe, 60, { clock: true }))),
          rules: [singlesCheck("end the EMOM there")],
        };
      }
      // A point either side of the load, for feel; at most one single at RPE 9.
      let nine = false;
      const sets = repeat(v.count, (i) => {
        const pct = clamp(v.load + [-1, 0, 1][i % 3], ...STRENGTH);
        let rpe = pct >= 92 ? 8.5 : pct >= 88 ? 8 : 7.5;
        if (!nine && i === Math.floor(v.count * 0.7) && pct >= 90) {
          rpe = 9;
          nine = true;
        }
        return S("Single", pct, fixed(1), rpe, 240);
      });
      return { sets: close(sets), rules: [singlesCheck("make it the last one today")] };
    },
  },
  {
    key: "rampingSingles",
    shape: "rising",
    family: "strength",
    params: [
      // The shortest ramp, three singles two points apart, has to start inside the band.
      loadKnob("top", "Top single", span(Math.max(75, STRENGTH[0] + 4), STRENGTH[1]), 90),
      knob("step", "Step between singles", (_c, v) => [2, 3, 4, 5].filter((s) => v.top - 2 * s >= STRENGTH[0]), 5, {
        show: (x) => `${x} points`,
      }),
      knob("rungs", "Singles in the ramp", (_c, v) => span(3, 6).filter((n) => v.top - v.step * (n - 1) >= STRENGTH[0]), 4),
      knob("nine", "Top single", (_c, v) => (v.top >= 88 ? [0, 1] : [0]), 0, {
        coded: true,
        buttons: true,
        show: (x) => (x ? "Up to RPE 9" : "As the ramp sets it"),
      }),
      knob("bSets", "Back-off sets", [2, 3, 4], 3),
      knob("bReps", "Back-off reps", [2, 3], 3),
    ],
    build: (v) => {
      const start = v.top - v.step * (v.rungs - 1);
      const ramp = repeat(v.rungs, (i) => {
        const pct = start + v.step * i;
        const last = i === v.rungs - 1;
        const rpe = last && v.nine ? 9 : pct <= 82 ? 7 : pct <= 88 ? 7.5 : pct <= 92 ? 8 : 8.5;
        return S(last ? "Top single" : "Ramp", pct, fixed(1), rpe, last ? 150 : 120);
      });
      const back = Math.max(STRENGTH[0], v.top - 12);
      return {
        sets: close([...ramp, ...repeat(v.bSets, () => S("Back-off", back, fixed(v.bReps), 7.5, 150, { ceiling: true }))]),
        rules: [singlesCheck("end the ramp at that single and start the back-offs")],
      };
    },
  },
  {
    key: "threadedSingles",
    shape: "interleaved",
    family: "strength",
    params: [
      knob("pairs", "Set-and-single pairs", span(4, 6), 5),
      loadKnob("single", "Single load", span(85, 92), 88),
      // The moderate sets stay at RPE 7 or under: at least a triple has to fit.
      knob("gap", "Moderate sets, points under the single", (_c, v) => span(8, 12).filter((g) => rpeAt(3, v.single - g) <= 7), 11),
      knob("reps", "Moderate reps", (_c, v) => [3, 4].filter((r) => rpeAt(r, v.single - v.gap) <= 7), 4),
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
    shape: "interleaved",
    family: "strength",
    params: [
      knob("order", "Order", [0, 1], 0, { coded: true, buttons: true, show: (x) => (x ? "Volume first" : "Heavy first") }),
      knob("aSets", "Heavy doubles", span(3, 5), 4),
      loadKnob("aPct", "Heavy load", span(85, 88), 87),
      loadKnob("bPct", "Volume load", span(68, 72), 70),
    ],
    build: (v, ctx) => {
      const heavy = repeat(v.aSets, () => S("Heavy", v.aPct, fixed(2), 8, 180, { ceiling: true }));
      const volume = repeat(2, () => S("Volume", v.bPct, toStop(Math.round(maxRepsAt(v.bPct) - 2)), 8, 240));
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
    shape: "falling",
    family: "strength",
    params: [loadKnob("dbl", "Doubles", span(80, 85), 83), loadKnob("mod", "Moderate sets", span(68, 72), 70), loadKnob("fin", "Finisher", span(55, 60), 58)],
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
    shape: "falling",
    family: "strength",
    params: [
      loadKnob("top", "Wave top", span(80, 85), 83),
      loadKnob("mid", "Middle", span(75, 78), 77),
      loadKnob("low", "Low", span(68, 72), 70),
      knob("lowReps", "Reps at the low load", span(2, 4), 3),
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
    shape: "constant",
    family: "hypertrophy",
    params: [
      knob("leadReps", "Lead reps", [7, 8, 9, 10, 12], 10),
      knob("leadSets", "Lead sets", [2, 3], 2),
      knob(
        "taperReps",
        "Taper reps",
        (_c, v) => [4, 5, 6, 7, 8].filter((t) => t < v.leadReps),
        // The most taper reps the lead sets leave room for, within the ceiling.
        (_c, v, allowed) => [...allowed].reverse().find((t) => taperModel(v.leadReps, t) <= rpeCeiling(t)) ?? allowed[0],
      ),
      knob("taperSets", "Taper sets", span(1, 6), 3),
    ],
    build: (v) => {
      const pct = taperedPct(v.leadReps);
      const model = taperModel(v.leadReps, v.taperReps);
      const cap = rpeCeiling(v.taperReps);
      // Past the ceiling, the stop decides how many of the reps happen.
      const over = model > cap;
      return {
        sets: close([
          ...repeat(v.leadSets, () => S("Lead", pct, fixed(v.leadReps), LEAD_RPE, 90)),
          ...repeat(v.taperSets, () => S("Taper", pct, over ? upTo(v.taperReps) : fixed(v.taperReps), Math.min(model, cap), 90)),
        ]),
        rules: [
          over
            ? `Same weight throughout. After the lead sets, ${v.taperReps} reps would run past RPE ${cap}, so the taper sets end at the stop even if the reps aren't all there.`
            : "Same weight throughout. The taper sets come after the lead sets, so they feel harder than their reps suggest.",
        ],
      };
    },
  },
  {
    key: "ascendingPyramid",
    shape: "rising",
    family: "hypertrophy",
    params: [
      knob("shape", "Reps", indices(ASCENDING).filter((i) => pyramidEfforts(ASCENDING[i], "up").length > 0), 2, {
        coded: true,
        show: (i) => ASCENDING[i].join(" / "),
      }),
      knob("effort", "Effort", (_c, v) => pyramidEfforts(ASCENDING[v.shape], "up"), (_c, _v, allowed) => pyramidDefault(allowed), {
        coded: true,
        show: (code, v) => pyramidEffortWords(ASCENDING[v.shape], "up", code),
      }),
      knob("rest", "Rest", [105, 120], 120, { unit: "s" }),
    ],
    build: (v) => ({
      sets: close(pyramid(ASCENDING[v.shape], "up", v.effort).map((s) => S("Pyramid", s.pct, fixed(s.reps), s.rpe, v.rest))),
      rules: [],
    }),
  },
  {
    key: "reversePyramid",
    shape: "falling",
    family: "hypertrophy",
    params: [
      knob("shape", "Reps", indices(REVERSE).filter((i) => pyramidEfforts(REVERSE[i], "down").length > 0), 1, {
        coded: true,
        show: (i) => REVERSE[i].join(" / "),
      }),
      knob("effort", "Effort", (_c, v) => pyramidEfforts(REVERSE[v.shape], "down"), (_c, _v, allowed) => pyramidDefault(allowed), {
        coded: true,
        show: (code, v) => pyramidEffortWords(REVERSE[v.shape], "down", code),
      }),
      knob("rest", "Rest", [120, 150], 150, { unit: "s" }),
    ],
    build: (v) => ({
      sets: close(pyramid(REVERSE[v.shape], "down", v.effort).map((s) => S("Pyramid", s.pct, fixed(s.reps), s.rpe, v.rest))),
      rules: [],
    }),
  },
  {
    key: "volumePyramid",
    shape: "arc",
    family: "hypertrophy",
    params: [knob("reps", "Reps per set", [5, 6, 8].filter((r) => arcPeaks(r, "hypertrophy").length > 0), 5)],
    build: (v) => {
      const peak = arcPeaks(v.reps, "hypertrophy")[0];
      return { sets: close(arc(v.reps, peak).map((s, i) => S(ARC_GROUPS[i], s.pct, fixed(v.reps), s.rpe, 150))), rules: [] };
    },
  },
  {
    key: "straightSets",
    shape: "constant",
    family: "hypertrophy",
    params: [
      loadKnob("load", "Load", (ctx) => span(55, 80).filter((p) => straightPlan(p, ctx).first <= STRAIGHT_RPE_MAX), 65),
      knob("sets", "Sets", (ctx, v) => span(2, straightPlan(v.load, ctx).maxSets), 4),
    ],
    build: (v, ctx) => {
      const p = straightPlan(v.load, ctx);
      const rest = v.load >= 75 ? 180 : v.load >= 70 ? 150 : 120;
      return {
        sets: close(
          repeat(v.sets, (i) =>
            S("Work", v.load, fixed(p.reps), Math.max(STRAIGHT_RPE_MIN, Math.min(STRAIGHT_RPE_MAX, round1(p.first + i * p.accrual))), rest),
          ),
        ),
        rules: [],
      };
    },
  },
  {
    key: "dropSet",
    shape: "falling",
    family: "hypertrophy",
    params: [
      knob("tiers", "Tiers", [2, 3, 4], 3),
      knob("step", "Drop per tier", [2, 3, 4, 5], 4, { show: (x) => `${x} points` }),
      knob("later", "Later tiers up to", [8, 8.5], 8, { buttons: true, show: rpeWords }),
      loadKnob(
        "start",
        "First tier",
        (_c, v) =>
          span(DROP_WINDOW[0] + v.step * (v.tiers - 1), DROP_WINDOW[1]).filter((s) => dropTiers(s, v.tiers, v.step, v.later).every((t) => t != null)),
        74,
      ),
      // 12 to 50 reps in all.
      knob(
        "per",
        "Sets per tier",
        (_c, v) =>
          [1, 2, 3].filter((n) => {
            const reps = n * dropTiers(v.start, v.tiers, v.step, v.later).reduce((t, x) => t + x!.reps, 0);
            return reps >= 12 && reps <= 50;
          }),
        2,
      ),
    ],
    build: (v) => ({
      sets: close(
        dropTiers(v.start, v.tiers, v.step, v.later)
          .map((t, i) => repeat(v.per, () => S(`Tier ${i + 1}`, t!.pct, fixed(t!.reps), rpeAt(t!.reps, t!.pct), 90)))
          .flat(),
      ),
      rules: [],
    }),
  },
  {
    key: "mechanicalTension",
    shape: "constant",
    family: "hypertrophy",
    unavailable: (ctx) => (lstarFloor(ctx) > 80 ? "Your L* sits above this design's band: its floor is L* + 1 and its ceiling 80%." : null),
    params: [
      loadKnob("load", "Load", (ctx) => span(lstarFloor(ctx), 80), (ctx) => clamp(72, lstarFloor(ctx), 80)),
      knob("sets", "Sets", span(3, 10), 6),
    ],
    build: (v) => {
      const reps = dropRep(v.load);
      return {
        sets: close(
          repeat(v.sets, () => S("Work", v.load, fixed(reps), Math.min(9, rpeAt(reps, v.load)), v.load >= 78 ? 180 : v.load >= 72 ? 150 : 120)),
        ),
        rules: [],
      };
    },
  },
  {
    key: "eccentricAccentuated",
    shape: "constant",
    family: "hypertrophy",
    params: [
      knob("shape", "Sets × reps", indices(ECCENTRICS), 0, {
        coded: true,
        show: (i) => `${ECCENTRICS[i].sets} × ${ECCENTRICS[i].reps}, ${ECCENTRICS[i].ecc} s down`,
      }),
      // SA's list, less any load where the reps alone cost more than the RPE the set is given
      // (3 × 6 at 78% is RPE 8 before the slow eccentric, past the 7.5 ceiling for six reps).
      loadKnob("load", "Load", (_c, v) => [68, 72, 75, 78].filter((p) => rpeAt(ECCENTRICS[v.shape].reps, p) <= eccentricRpe(ECCENTRICS[v.shape], p)), 72),
    ],
    build: (v) => {
      const e = ECCENTRICS[v.shape];
      const rpe = eccentricRpe(e, v.load);
      const rest = e.ecc >= 4 || v.load >= 75 ? 180 : 150;
      return {
        sets: close(repeat(e.sets, () => S("Work", v.load, fixed(e.reps), rpe, rest, { tempo: `${e.ecc}-0-1-0` }))),
        rules: [`Lower for ${e.ecc} s, no pause, then drive up. Read the concentric speed only.`],
      };
    },
  },
  {
    key: "forceMetabolic",
    shape: "interleaved",
    family: "hypertrophy",
    // One load for both kinds of set, floored at L* + 1, up to 78%, wherever a metabolic set fits under its ceiling.
    unavailable: (ctx) =>
      fmLoads(ctx).length ? null : `Your L* sits above this design's band: its floor is L* + 1 and its ceiling ${FM_CEILING}%.`,
    params: [
      loadKnob("load", "Load", (ctx) => fmLoads(ctx), 70),
      knob("fSets", "Force sets", [2, 3, 4], 3),
      knob("mReps", "Metabolic reps", (_c, v) => metabolicReps(v.load), (_c, v, allowed) =>
        allowed.reduce((best, r) => (Math.abs(rpeAt(r, v.load) - 7) < Math.abs(rpeAt(best, v.load) - 7) ? r : best)),
      ),
      knob("mSets", "Metabolic sets", span(1, 4), (_c, v) => v.fSets),
    ],
    build: (v) => {
      const force = dropRep(v.load);
      const out: PlanSet[] = [];
      for (let i = 0; i < Math.max(v.fSets, v.mSets); i++) {
        if (i < v.fSets) out.push(S("Force", v.load, fixed(force), Math.min(rpeCeiling(force), rpeAt(force, v.load)), v.load >= 74 ? 180 : 150));
        if (i < v.mSets) out.push(S("Metabolic", v.load, fixed(v.mReps), rpeAt(v.mReps, v.load), 90));
      }
      return { sets: close(out), rules: [] };
    },
  },
  {
    key: "hypertrophyCluster",
    shape: "clustered",
    family: "hypertrophy",
    params: [
      loadKnob("load", "Load", [72, 74, 76, 78], 74),
      knob("shape", "Each cluster", (_c, v) => indices(HYP_CLUSTERS).filter((i) => hypClusterRpe(v.load, HYP_CLUSTERS[i].reps) <= rpeCeiling(HYP_CLUSTERS[i].reps)), 0, {
        coded: true,
        show: (i) => clusterWords(HYP_CLUSTERS[i]),
      }),
      knob("clusters", "Clusters", [3, 4], 3),
    ],
    build: (v) => {
      const c = HYP_CLUSTERS[v.shape];
      return {
        sets: close(
          repeat(v.clusters, () =>
            S("Cluster", v.load, { kind: "cluster", parts: Array(c.minis).fill(c.reps), intraRest: c.intra }, hypClusterRpe(v.load, c.reps), v.load >= 76 ? 180 : 150),
          ),
        ),
        rules: [],
      };
    },
  },
  {
    key: "densitySet",
    shape: "constant",
    family: "hypertrophy",
    // Never an AMRAP under a barbell without a spotter: off bench and squat.
    lifts: ["deadlift"],
    params: [knob("minutes", "Duration", span(12, 18), 15, { unit: "min" }), loadKnob("load", "Load", span(55, 80), 65)],
    build: (v) => ({
      sets: [S("Density block", v.load, { kind: "timed", minutes: v.minutes }, 7, 0, { ceiling: true })],
      rules: [
        "Self-paced: rest as needed and keep every rep clean. End each run of reps at the stop velocity.",
        "Mechanics decide rest, not the clock. If a rep starts to look different from your first set, rest longer.",
      ],
    }),
  },
  {
    key: "clockedSets",
    shape: "constant",
    family: "hypertrophy",
    unavailable: (ctx) => (lstarFloor(ctx, 70) > 80 ? "Your L* sits above this design's band: its floor is L* + 1 and its ceiling 80%." : null),
    params: [
      loadKnob("load", "Load", (ctx) => span(lstarFloor(ctx, 70), 80), (ctx) => clamp(72, lstarFloor(ctx, 70), 78)),
      knob("sets", "Sets", span(8, 12), 10),
      knob("clock", "Every", [90, 105, 120], 105, { unit: "s" }),
    ],
    build: (v, ctx) => ({
      sets: close(repeat(v.sets, () => S("Set", v.load, fixed(clamp(dropRep(v.load), 3, 4)), 7, v.clock, { ceiling: true, clock: true }))),
      rules: ["Same bar speed every set.", firstRepRule(ctx, v.load, true)],
    }),
  },
  {
    key: "restPauseHarvest",
    shape: "clustered",
    family: "hypertrophy",
    spotter: ["bench", "squat"],
    params: [loadKnob("load", "Load", span(72, 78), 75), knob("intra", "Rest inside a block", [20, 25, 30], 20, { unit: "s" })],
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
          v9 ? `A mini-set whose first rep is already under ${v9} ends the block.` : "A mini-set whose first rep already reads RPE 9 ends the block.",
        ],
      };
    },
  },
  {
    key: "shrinkingSets",
    shape: "constant",
    family: "hypertrophy",
    params: [loadKnob("load", "Load", span(68, 74), 71), knob("starts", "Starts", span(6, 8), 8), knob("clock", "Every", [75, 90, 105], 90, { unit: "s" })],
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
    shape: "clustered",
    family: "hypertrophy",
    params: [
      loadKnob("load", "Load", span(68, 75), 72),
      knob("blocks", "Blocks", span(3, 5), 4),
      knob("pair", "Rest between pairs", [30, 45, 60], 45, { unit: "s" }),
      knob("block", "Rest between blocks", [150, 180, 210], 180, { unit: "s" }),
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

export interface Resolved {
  values: Values;
  /** The values each knob may take, as resolved. */
  options: Record<string, number[]>;
}

/**
 * Settle every knob in order, each among the values the knobs before it allow.
 * A value the lifter set that is no longer allowed moves to the nearest one that
 * is; a named option that is no longer allowed goes back to its default.
 */
export function resolve(d: Design, ctx: DesignCtx, input: Partial<Values> = {}): Resolved {
  const values: Values = {};
  const options: Record<string, number[]> = {};
  for (const p of d.params) {
    const allowed = p.values(ctx, values);
    if (!allowed.length) throw new Error(`${d.key}: no value fits ${p.key}`);
    options[p.key] = allowed;
    const def = typeof p.def === "function" ? p.def(ctx, values, allowed) : p.def;
    const want = input[p.key];
    values[p.key] =
      want != null && allowed.includes(want) ? want : nearest(allowed, want != null && !p.coded ? want : def);
  }
  return { values, options };
}
