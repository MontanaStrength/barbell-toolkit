// Session lab (prototype, Oct 27, 2026): one engine for every set structure.
//
// Instead of 26 designs split into strength and hypertrophy families, a
// session is one to four blocks. Each block is one of six shapes, and every
// set in it is set by three dials:
//   1. load, read against L* (load road above it, fatigue road below);
//   2. a stop rule: a target RPE (reps follow), the peak-force drop rep, or a
//      fixed rep count (RPE follows);
//   3. rest: between sets, inside a cluster, and after the block.
// One fatigue model runs across the whole session, so a set's RPE always
// comes from the same place: reps against what's left of the curve.
// "Strength" and "hypertrophy" become readouts of what the dials produce.

import type { DesignCtx } from "../sessions/designs";
import { dropRep, maxRepsAt, rpeCeiling } from "../sessions/effort";

// ---------- the fatigue model ----------

/**
 * Provisional. Right after a set, capacity at that load is down by exactly the
 * reps just done (what's left is the reps in reserve). Most of that comes back
 * fast: a half-life of 10 s after an easy set, up to 30 s after one taken to
 * failure (phosphocreatine-paced). A small share, 2% after an easy set to 8%
 * after a failure set, comes back slowly (half-life 15 min) and builds across
 * the session. Calibrated so straight sets of ten at 65% climb about half an
 * RPE a set on two minutes' rest, as SA's straight-set solver assumes, and so a
 * set to failure at 75% leaves about 3 reps of deficit after a minute and 1
 * after three minutes, as rest-interval studies report.
 */
export const FATIGUE = { fastHalfLife: [10, 30], slowShare: [0.02, 0.08], slowHalfLife: 900 };

interface Fatigue {
  fast: number;
  slow: number;
  /** Half-life of the fast pool, seconds, set by the last set's effort. */
  h: number;
}
const depth = (rpe: number) => Math.min(1, Math.max(0, (rpe - 5) / 5));
function afterSet(f: Fatigue, reps: number, rpe: number): Fatigue {
  const w = depth(rpe);
  const share = FATIGUE.slowShare[0] + (FATIGUE.slowShare[1] - FATIGUE.slowShare[0]) * w;
  return { fast: f.fast + reps * (1 - share), slow: f.slow + reps * share, h: FATIGUE.fastHalfLife[0] + (FATIGUE.fastHalfLife[1] - FATIGUE.fastHalfLife[0]) * w };
}
const rested = (f: Fatigue, seconds: number): Fatigue => ({
  fast: f.fast * Math.pow(0.5, seconds / f.h),
  slow: f.slow * Math.pow(0.5, seconds / FATIGUE.slowHalfLife),
  h: f.h,
});
const round1 = (x: number) => Math.round(x * 10) / 10;
const round05 = (x: number) => Math.round(x * 2) / 2;

// ---------- dials ----------

export type StopKind = 0 | 1 | 2; // 0 RPE, 1 drop rep, 2 fixed reps
export interface Stop {
  kind: StopKind;
  rpe: number;
  /** A rep ceiling on an RPE stop; 0 for none. */
  cap: number;
  reps: number;
}

export type ShapeKey = "constant" | "rising" | "falling" | "arc" | "clustered" | "interleaved";
export type Values = Record<string, number>;

export interface Spec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: "%" | "s";
  show?: (x: number) => string;
  /** Shown only when this holds. */
  when?: (v: Values) => boolean;
  buttons?: Array<[number, string]>;
}

const rest = (key: string, label: string): Spec => ({ key, label, min: 0, max: 600, step: 15, unit: "s" });
const load = (key: string, label: string): Spec => ({ key, label, min: 40, max: 97, step: 1, unit: "%" });

function stopSpecs(p: string, label: string): Spec[] {
  const k = (s: string) => (p ? `${p}${s[0].toUpperCase()}${s.slice(1)}` : s);
  return [
    { key: k("kind"), label, min: 0, max: 2, step: 1, buttons: [[0, "At an RPE"], [1, "At the drop rep"], [2, "Fixed reps"]] },
    { key: k("rpe"), label: "Stop at RPE", min: 5, max: 9.5, step: 0.5, when: (v) => v[k("kind")] === 0 },
    { key: k("cap"), label: "Rep ceiling", min: 0, max: 15, step: 1, show: (x) => (x ? `${x}` : "none"), when: (v) => v[k("kind")] === 0 },
    { key: k("reps"), label: "Reps", min: 1, max: 20, step: 1, when: (v) => v[k("kind")] === 2 },
  ];
}

export const SHAPES: Record<ShapeKey, { name: string; blurb: string; specs: Spec[] }> = {
  constant: {
    name: "Constant",
    blurb: "One load, set after set.",
    specs: [load("load", "Load"), { key: "sets", label: "Sets", min: 1, max: 12, step: 1 }, ...stopSpecs("", "Each set stops"), { ...rest("rest", "Rest between sets"), when: (v) => v.sets > 1 }, { key: "ecc", label: "Eccentric", min: 0, max: 6, step: 1, show: (x) => (x ? `${x} s` : "normal") }, rest("after", "Rest after the block")],
  },
  rising: {
    name: "Rising",
    blurb: "Load climbs set to set; effort builds toward the last.",
    specs: [load("from", "First load"), load("to", "Last load"), { key: "sets", label: "Sets", min: 2, max: 8, step: 1 }, ...stopSpecs("", "The last set stops"), { key: "step", label: "Effort step per set", min: 0, max: 1, step: 0.25, show: (x) => `${x} RPE`, when: (v) => v.kind === 0 }, rest("rest", "Rest between sets"), { key: "rounds", label: "Rounds", min: 1, max: 3, step: 1 }, rest("after", "Rest after each round")],
  },
  falling: {
    name: "Falling",
    blurb: "Load drops set to set; the first set is the hardest effort.",
    specs: [load("from", "First load"), load("to", "Last load"), { key: "loads", label: "Loads", min: 2, max: 6, step: 1 }, { key: "per", label: "Sets at each load", min: 1, max: 3, step: 1 }, ...stopSpecs("", "The first set stops"), { key: "step", label: "Effort step per load", min: 0, max: 1, step: 0.25, show: (x) => `${x} RPE`, when: (v) => v.kind === 0 }, rest("rest", "Rest between sets"), { key: "rounds", label: "Rounds", min: 1, max: 3, step: 1 }, rest("after", "Rest after each round")],
  },
  arc: {
    name: "Arc",
    blurb: "Up to a peak load and back down the same loads.",
    specs: [load("low", "Edge load"), load("peak", "Peak load"), { key: "sets", label: "Sets", min: 3, max: 7, step: 2 }, ...stopSpecs("", "The peak set stops"), { key: "step", label: "Effort step per set", min: 0, max: 1.5, step: 0.25, show: (x) => `${x} RPE`, when: (v) => v.kind === 0 }, rest("rest", "Rest between sets"), rest("after", "Rest after the block")],
  },
  clustered: {
    name: "Clustered",
    blurb: "Sets broken into mini-sets with short rests inside.",
    specs: [load("load", "Load"), { key: "clusters", label: "Clusters", min: 1, max: 6, step: 1 }, { key: "minis", label: "Mini-sets per cluster", min: 2, max: 5, step: 1 }, ...stopSpecs("", "Each mini-set stops"), { key: "intra", label: "Rest inside a cluster", min: 10, max: 60, step: 5, unit: "s" }, rest("rest", "Rest between clusters"), rest("after", "Rest after the block")],
  },
  interleaved: {
    name: "Interleaved",
    blurb: "Two kinds of set, alternating.",
    specs: [{ key: "pairs", label: "Pairs", min: 1, max: 8, step: 1 }, load("aLoad", "First set's load"), ...stopSpecs("a", "First set stops"), rest("aRest", "Rest after it"), load("bLoad", "Second set's load"), ...stopSpecs("b", "Second set stops"), rest("bRest", "Rest after it")],
  },
};

export interface Block {
  shape: ShapeKey;
  v: Values;
}

const stopOf = (v: Values, p = ""): Stop => {
  const k = (s: string) => (p ? `${p}${s[0].toUpperCase()}${s.slice(1)}` : s);
  return { kind: v[k("kind")] as StopKind, rpe: v[k("rpe")], cap: v[k("cap")] ?? 0, reps: v[k("reps")] };
};

/** Sensible starting dials for a new block of a shape. */
export function blankBlock(shape: ShapeKey): Block {
  const stop = { kind: 0, rpe: 7.5, cap: 0, reps: 5 };
  const v: Record<ShapeKey, Values> = {
    constant: { load: 75, sets: 4, ...stop, rest: 150, ecc: 0, after: 180 },
    rising: { from: 70, to: 85, sets: 4, ...stop, step: 0.5, rest: 150, rounds: 1, after: 180 },
    falling: { from: 80, to: 70, loads: 3, per: 1, ...stop, step: 0, rest: 150, rounds: 1, after: 180 },
    arc: { low: 75, peak: 85, sets: 5, ...stop, kind: 2, reps: 3, step: 1, rest: 180, after: 180 },
    clustered: { load: 80, clusters: 4, minis: 3, ...stop, kind: 2, reps: 2, intra: 20, rest: 180, after: 180 },
    interleaved: { pairs: 3, aLoad: 85, aKind: 2, aRpe: 7.5, aCap: 0, aReps: 2, aRest: 120, bLoad: 70, bKind: 0, bRpe: 7.5, bCap: 0, bReps: 6, bRest: 120 },
  };
  return { shape, v: v[shape] };
}

// ---------- planning ----------

interface Planned {
  block: number;
  group: string;
  load: number;
  stop: Stop;
  rest: number;
  minis?: number;
  intra?: number;
  ecc?: number;
}

const between = (a: number, b: number, i: number, n: number) => (n <= 1 ? a : round05(a + ((b - a) * i) / (n - 1)));
const withRpe = (s: Stop, rpe: number): Stop => (s.kind === 0 ? { ...s, rpe: Math.max(1, rpe) } : s);

function plan(blocks: Block[]): Planned[] {
  const out: Planned[] = [];
  blocks.forEach((b, bi) => {
    const v = b.v;
    const push = (p: Omit<Planned, "block">) => out.push({ block: bi, ...p });
    const stop = stopOf(v);
    const start = out.length;
    switch (b.shape) {
      case "constant":
        for (let i = 0; i < v.sets; i++) push({ group: "Set", load: v.load, stop, rest: v.rest, ecc: v.ecc || undefined });
        break;
      case "rising":
        for (let r = 0; r < v.rounds; r++)
          for (let i = 0; i < v.sets; i++)
            push({ group: v.rounds > 1 ? `Round ${r + 1}` : i === v.sets - 1 ? "Top" : "Climb", load: between(v.from, v.to, i, v.sets), stop: withRpe(stop, stop.rpe - v.step * (v.sets - 1 - i)), rest: i === v.sets - 1 && r < v.rounds - 1 ? v.after : v.rest });
        break;
      case "falling":
        for (let r = 0; r < v.rounds; r++)
          for (let i = 0; i < v.loads; i++)
            for (let k = 0; k < v.per; k++)
              push({ group: v.rounds > 1 ? `Round ${r + 1}` : `Load ${i + 1}`, load: between(v.from, v.to, i, v.loads), stop: withRpe(stop, stop.rpe - v.step * i), rest: i === v.loads - 1 && k === v.per - 1 && r < v.rounds - 1 ? v.after : v.rest });
        break;
      case "arc": {
        const mid = (v.sets - 1) / 2;
        for (let i = 0; i < v.sets; i++) {
          const away = Math.abs(i - mid);
          push({ group: i < mid ? "Ascend" : i === mid ? "Peak" : "Descend", load: between(v.peak, v.low, away, mid + 1), stop: withRpe(stop, stop.rpe - v.step * away), rest: v.rest });
        }
        break;
      }
      case "clustered":
        for (let i = 0; i < v.clusters; i++) push({ group: "Cluster", load: v.load, stop, rest: v.rest, minis: v.minis, intra: v.intra });
        break;
      case "interleaved":
        for (let i = 0; i < v.pairs; i++) {
          push({ group: "First", load: v.aLoad, stop: stopOf(v, "a"), rest: v.aRest });
          push({ group: "Second", load: v.bLoad, stop: stopOf(v, "b"), rest: v.bRest });
        }
        break;
    }
    // A block's last set rests for the block's "after" (interleaved keeps its own last rest).
    if (out.length > start && b.shape !== "interleaved") out[out.length - 1].rest = v.after;
  });
  if (out.length) out[out.length - 1].rest = 0;
  return out;
}

// ---------- simulation ----------

export interface LabSet {
  n: number;
  block: number;
  group: string;
  load: number;
  /** Reps per mini-set for a cluster; one entry for a straight set. */
  parts: number[];
  intra?: number;
  ecc?: number;
  /** RPE at the end of the set (the last mini-set for a cluster), from reps against the capacity left. */
  rpe: number;
  /** What the stop rule asked for, when it was an RPE. */
  target: number | null;
  stopKind: StopKind;
  /** The rule asked for more reps than the capacity left; the set ends sooner. */
  cutShort: boolean;
  /** Past RPE 9, or 7.5 at six reps or more. */
  overCeiling: boolean;
  /** Reps of capacity already lost when the set starts. */
  fatigue: number;
  fresh: number | null;
  stopV: number | null;
  single: boolean;
  road: "load" | "fatigue" | null;
  rest: number;
}

/** Reps for one stop rule against the capacity left, and the RPE they end at. */
function runSet(load: number, capacity: number, s: Stop): { reps: number; rpe: number; cut: boolean } {
  let reps: number;
  let cut = false;
  if (s.kind === 0) {
    reps = Math.floor(capacity - (10 - s.rpe) + 1e-9);
    if (s.cap) reps = Math.min(reps, s.cap);
    if (reps < 1) {
      reps = 1;
      cut = capacity < 1;
    }
  } else {
    reps = s.kind === 1 ? dropRep(load) : s.reps;
    if (reps > Math.floor(capacity + 1e-9)) {
      reps = Math.max(1, Math.floor(capacity + 1e-9));
      cut = true;
    }
  }
  return { reps, rpe: round1(Math.min(10, 10 - (capacity - reps))), cut };
}

export function simulate(blocks: Block[], ctx: DesignCtx): LabSet[] {
  let f: Fatigue = { fast: 0, slow: 0, h: FATIGUE.fastHalfLife[0] };
  return plan(blocks).map((p, i) => {
    const startLoss = f.fast + f.slow;
    const parts: number[] = [];
    let rpe = 0;
    let cutShort = false;
    for (let m = 0; m < (p.minis ?? 1); m++) {
      const r = runSet(p.load, maxRepsAt(p.load) - f.fast - f.slow, p.stop);
      parts.push(r.reps);
      rpe = r.rpe;
      cutShort ||= r.cut;
      f = afterSet(f, r.reps, r.rpe);
      if (p.minis && m < p.minis - 1) f = rested(f, p.intra ?? 0);
    }
    f = rested(f, p.rest);
    const maxPart = Math.max(...parts);
    return {
      n: i + 1,
      block: p.block,
      group: p.group,
      load: p.load,
      parts,
      intra: p.intra,
      ecc: p.ecc,
      rpe,
      target: p.stop.kind === 0 ? p.stop.rpe : null,
      stopKind: p.stop.kind,
      cutShort,
      overCeiling: rpe > rpeCeiling(maxPart) + 0.05,
      fatigue: round1(startLoss),
      fresh: ctx.fresh(p.load),
      stopV: ctx.stop(p.load, rpe),
      single: parts.length === 1 && parts[0] === 1,
      road: ctx.lstar == null ? null : p.load >= ctx.lstar ? "load" : "fatigue",
      rest: p.rest,
    };
  });
}

// ---------- what the session adds up to ----------

/** Loads at or above this count as heavy: strength-specific practice. */
export const HEAVY = 80;

export interface Readout {
  reps: number;
  sets: number;
  minutes: number;
  neural: number;
  /** Share of reps at HEAVY % or more. */
  heavy: number;
  /** Reps that count toward growth: every rep on the load road, and fatigue-road reps within three of failure. Null without an L*. */
  effective: number | null;
  /** Share of reps done before the peak-force drop, within each (mini-)set. */
  quality: number;
  /** Mean velocity loss at the end of a set, %, weighted by reps; null without bar speeds. */
  velocityLoss: number | null;
  lean: "strength" | "hypertrophy" | "mixed";
  why: string;
}

export function readout(sets: LabSet[], lstar: number | null): Readout {
  let reps = 0;
  let heavy = 0;
  let effective = 0;
  let quality = 0;
  let neural = 0;
  let vlSum = 0;
  let vlReps = 0;
  let seconds = 0;
  for (const s of sets) {
    const total = s.parts.reduce((a, b) => a + b, 0);
    reps += total;
    if (s.load >= HEAVY) heavy += total;
    neural += total * (100 / (100 - Math.min(99, s.load))) ** 2;
    for (const part of s.parts) quality += Math.min(part, dropRep(s.load));
    // Rep k of the last part sits at RIR (rir + last − k): count those at 3 or under.
    const rir = 10 - s.rpe;
    const last = s.parts[s.parts.length - 1];
    const deep = Math.max(0, Math.min(last, last - Math.ceil(last + rir - 3) + 1));
    if (lstar != null) effective += s.load >= lstar ? total : deep;
    if (s.fresh != null && s.stopV != null && s.fresh > 0) {
      vlSum += ((s.fresh - s.stopV) / s.fresh) * 100 * total;
      vlReps += total;
    }
    seconds += total * (4 + Math.max(0, (s.ecc ?? 0) - 1.5)) + (s.parts.length - 1) * (s.intra ?? 0) + s.rest;
  }
  const h = reps ? heavy / reps : 0;
  const eff = lstar == null ? null : effective;
  const velocityLoss = vlReps ? vlSum / vlReps : null;
  // Provisional: strength work is mostly heavy and ends early; hypertrophy work is
  // a volume of effective reps on lighter loads. Everything else is mixed.
  let lean: Readout["lean"] = "mixed";
  if (h >= 0.5 && (velocityLoss ?? 0) < 25) lean = "strength";
  else if (h < 0.5 && (eff ?? 0) >= 25) lean = "hypertrophy";
  const why =
    lean === "strength"
      ? "Most reps are heavy, and sets end before bar speed falls far."
      : lean === "hypertrophy"
        ? "Most reps are lighter, and enough of them count: on the load road, or close to failure below it."
        : h >= 0.5
          ? "Mostly heavy, but sets run deep enough that it isn't clean strength work."
          : "Mostly lighter loads, without the effective-rep volume growth work needs.";
  return { reps, sets: sets.length, minutes: Math.round(seconds / 60), neural, heavy: h, effective: eff, quality: reps ? quality / reps : 0, velocityLoss, lean, why };
}
