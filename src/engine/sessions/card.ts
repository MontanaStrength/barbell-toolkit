// A design filled in from one lifter's profile: a stop velocity for every set
// from their own fresh speed at that load, and the road each set is on from
// their L*. Bar weights are rounded to plates by the page, which knows the unit.

import { NEURAL_TARGET, rpeStopFraction, STRENGTH_SWEET, type LiftKey } from "../constants";
import { neuralLoad, stopVelocity } from "../metrics";
import type { Profile } from "../profile";
import { resolve, type Design, type DesignCtx, type PlanSet, type Reps, type Values } from "./designs";

export type Road = "load" | "fatigue";

export interface CardSet extends PlanSet {
  n: number;
  /** Fresh mean velocity at this load, m/s. */
  fresh: number | null;
  /**
   * End the set when a rep's mean velocity falls below this, m/s. For a single
   * there is nothing left to stop, so it is the check instead: a single slower
   * than this is harder than its RPE.
   */
  stopV: number | null;
  /** One rep: the velocity is a check, not a stop. */
  single: boolean;
  /** Load road at or above L*: the bar recruits. Fatigue road below it. */
  road: Road | null;
}

export interface Card {
  values: Values;
  /** The values each knob may take, as resolved for this lifter. */
  options: Record<string, number[]>;
  sets: CardSet[];
  rules: string[];
  totals: {
    sets: number;
    /** Planned reps; "up to" sets count their ceiling, "to the stop" sets their estimate. Null for a timed block. */
    reps: number | null;
    /** Hanley neural dose over every counted set; null for a timed block. */
    neural: number | null;
    /** The neural-dose band a session of this family aims for. */
    target: [number, number];
    minutes: number;
    /** True when some reps are a ceiling or an estimate rather than a fixed count. */
    approximate: boolean;
  };
}

export function contextFor(profile: Profile, lift: LiftKey, mvt: number): DesignCtx {
  // Never past the lifter's own MVT, however far the line is extrapolated.
  const fresh = (pct: number) => {
    const v = profile.vAt(pct);
    return v == null || !Number.isFinite(v) ? null : Math.max(v, mvt);
  };
  return {
    lift,
    lstar: profile.lstar,
    fresh,
    stop: (pct, rpe) => stopVelocity(fresh(pct), mvt, rpeStopFraction(rpe)),
  };
}

export function repCount(r: Reps): number | null {
  switch (r.kind) {
    case "fixed":
    case "upTo":
      return r.n;
    case "toStop":
      return r.about;
    case "cluster":
      return r.parts.reduce((s, x) => s + x, 0);
    case "timed":
      return null;
  }
}

/** Seconds a set takes: about 4 s a rep, plus a slow eccentric, plus rests inside a cluster. */
function workSeconds(s: PlanSet): number {
  if (s.reps.kind === "timed") return s.reps.minutes * 60;
  const reps = repCount(s.reps) ?? 0;
  const ecc = s.tempo ? Math.max(0, Number(s.tempo.split("-")[0]) - 1.5) : 0;
  const intra = s.reps.kind === "cluster" ? (s.reps.parts.length - 1) * s.reps.intraRest : 0;
  return reps * (4 + ecc) + intra;
}

export function buildCard(d: Design, ctx: DesignCtx, input: Partial<Values> = {}): Card {
  const { values, options } = resolve(d, ctx, input);
  const built = d.build(values, ctx);
  const sets: CardSet[] = built.sets.map((s, i) => ({
    ...s,
    n: i + 1,
    fresh: ctx.fresh(s.pct),
    stopV: ctx.stop(s.pct, s.rpe),
    single: s.reps.kind === "fixed" && s.reps.n === 1,
    road: ctx.lstar == null ? null : s.pct >= ctx.lstar ? "load" : "fatigue",
  }));

  let reps: number | null = 0;
  let neural: number | null = 0;
  let seconds = 0;
  let approximate = false;
  for (const [i, s] of sets.entries()) {
    const r = repCount(s.reps);
    if (r == null) {
      // A timed block has no rep count to add up, so neither has the session.
      reps = null;
      neural = null;
    } else {
      if (s.reps.kind === "upTo" || s.reps.kind === "toStop") approximate = true;
      if (reps != null) reps += r;
      if (neural != null) neural += neuralLoad(r, 1, s.pct);
    }
    const last = i === sets.length - 1;
    seconds += last ? workSeconds(s) : s.clock ? s.next : workSeconds(s) + s.next;
  }

  return {
    values,
    options,
    sets,
    rules: built.rules,
    totals: {
      sets: sets.length,
      reps,
      neural,
      target: d.family === "strength" ? STRENGTH_SWEET : NEURAL_TARGET,
      minutes: Math.round(seconds / 60),
      approximate,
    },
  };
}
