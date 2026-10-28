// How a planned session is likely to feel, set by set: each set's RPE read
// against the capacity left after the sets before it, rather than fresh.
//
// Provisional model (Oct 28, 2026). Right after a set, capacity at that load
// is down by the reps just done. Most of it returns quickly, with a half-life
// of 10 s after an easy set and 30 s after one taken to failure; a small share
// (2% after an easy set, 8% after failure) lingers with a 15-minute half-life.
// Tuned so straight sets of ten at 65% climb about half an RPE a set on two
// minutes' rest, as SA's straight-set solver assumes, and so a set to failure
// at 75% leaves about 3 reps of deficit after a minute and 1 after three, as
// rest-interval studies report.

import { maxRepsAt } from "./effort";
import type { PlanSet } from "./designs";

export const FATIGUE = { fastHalfLife: [10, 30], slowShare: [0.02, 0.08], slowHalfLife: 900 };

interface State {
  fast: number;
  slow: number;
  h: number;
}

const depth = (rpe: number) => Math.min(1, Math.max(0, (rpe - 5) / 5));
function afterSet(f: State, reps: number, rpe: number): State {
  const w = depth(rpe);
  const share = FATIGUE.slowShare[0] + (FATIGUE.slowShare[1] - FATIGUE.slowShare[0]) * w;
  return {
    fast: f.fast + reps * (1 - share),
    slow: f.slow + reps * share,
    h: FATIGUE.fastHalfLife[0] + (FATIGUE.fastHalfLife[1] - FATIGUE.fastHalfLife[0]) * w,
  };
}
const rested = (f: State, s: number): State => ({
  fast: f.fast * Math.pow(0.5, s / f.h),
  slow: f.slow * Math.pow(0.5, s / FATIGUE.slowHalfLife),
  h: f.h,
});

/** Reps the card plans for a set, per mini-set; null for sets the stop decides. */
function planned(s: PlanSet): number[] | null {
  switch (s.reps.kind) {
    case "fixed":
      return [s.reps.n];
    case "cluster":
      return s.reps.parts;
    case "upTo":
    case "toStop":
    case "timed":
      return null;
  }
}

/**
 * The RPE each set is likely to end at, given the sets before it. Null where
 * the set's reps aren't fixed (the stop decides, and the session's fatigue
 * state from there on is unknown).
 */
export function feltRpe(sets: PlanSet[]): Array<number | null> {
  let f: State = { fast: 0, slow: 0, h: FATIGUE.fastHalfLife[0] };
  let known = true;
  return sets.map((s) => {
    const parts = planned(s);
    if (!parts || !known) {
      // After a set whose reps we can't count, the state is unknown; assume it
      // left the lifter about where its RPE says and carry on with that.
      if (parts == null) {
        const about = s.reps.kind === "upTo" ? s.reps.n : s.reps.kind === "toStop" ? s.reps.about : 0;
        if (about) f = rested(afterSet(f, about, s.rpe), s.next || 0);
        else known = false;
      }
      return null;
    }
    let rpe = 0;
    parts.forEach((reps, i) => {
      const left = maxRepsAt(s.pct) - f.fast - f.slow;
      rpe = Math.min(10, 10 - (left - reps));
      f = afterSet(f, reps, Math.max(1, rpe));
      if (i < parts.length - 1 && s.reps.kind === "cluster") f = rested(f, s.reps.intraRest);
    });
    // A start-to-start clock leaves the interval less the work.
    const work = parts.reduce((a, b) => a + b, 0) * 4 + (parts.length - 1) * (s.reps.kind === "cluster" ? s.reps.intraRest : 0);
    f = rested(f, s.clock ? Math.max(0, s.next - work) : s.next);
    return Math.round(rpe * 10) / 10;
  });
}
