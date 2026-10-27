// Force–velocity profile: Force–Load fit, velocity cross-check, L*, drive
// compression and prescription bands. Design decisions (Oct 2026):
//   1. velocity stops scale by goal: v_stop = (1 − f)·v_fresh + f·MVT
//   2. the recruitment line is set per lift
//   3. the load axis is the actual bar weight as % of e1RM (handled by the caller)

import { HYP_RIR, NEURAL_TARGET, STOP_FRACTION, STRENGTH_SWEET, stopFractionFor, type Goal, type StopFractions } from "./constants";
import { neuralLoad, repsToFailure, stopVelocity, tuneSets } from "./metrics";
import { ols, round, solveLstar, type Fit } from "./stats";

export interface ProfilePoint {
  /** Load as % of e1RM. */
  load: number;
  /** Fresh Multiple at this load. */
  mult: number;
  /** Fresh mean velocity at this load (m/s). */
  v: number | null;
}

export interface ProfileInput {
  e1rm: number | null;
  mvt: number;
  recruitLine: number;
  points: ProfilePoint[];
  stops?: StopFractions;
}

export interface Band {
  label: string;
  goal: Goal;
  lo: number;
  hi: number;
  loLb: number | null;
  hiLb: number | null;
  reps: string;
  sets: string;
  stop: number | null;
  neural: number | null;
  note?: string;
}

export interface Profile {
  points: Array<ProfilePoint & { surplus: number; ei: number }>;
  fl: Fit;
  cleanSlope: number | null;
  vFit: Fit;
  velPct: number | null;
  velE1rm: number | null;
  velCrossPct: number | null;
  lstar: number | null;
  lstarLb: number | null;
  eiTop: number | null;
  alpha: number | null;
  beta: number | null;
  driveCurve: Array<{ load: number; fit: number }>;
  bands: Band[];
  hypBands: Band[];
  /** Velocity predicted by the velocity–load fit at a load %. */
  vAt: (load: number) => number | null;
}

const TOP_LOAD = 95;

export function computeProfile(input: ProfileInput): Profile {
  const { e1rm, mvt, recruitLine } = input;
  const stops = input.stops ?? STOP_FRACTION;
  const lb = (pct: number) => (e1rm ? (e1rm * pct) / 100 : null);

  const points = input.points
    .filter((p) => Number.isFinite(p.load) && Number.isFinite(p.mult))
    .map((p) => ({ ...p, surplus: (p.mult - 1) * 100, ei: p.mult * p.load }))
    .sort((a, b) => a.load - b.load);

  // Force–Load: Multiple vs load %.
  const fl = ols(points.map((p) => ({ x: p.load, y: p.mult })));
  const cleanSlope =
    points.length >= 2 ? (points[1].mult - points[0].mult) / (points[1].load - points[0].load) : null;

  // Velocity–load fit and the velocity-derived e1RM cross-check.
  const velPts = points.filter((p) => p.v != null);
  const vFit = ols(velPts.map((p) => ({ x: p.load, y: p.v as number })));
  const vAt = (L: number) => (vFit.m != null && vFit.b != null ? vFit.m * L + vFit.b : null);
  let velPct: number | null = null;
  let velE1rm: number | null = null;
  if (vFit.m != null && vFit.m !== 0 && vFit.b != null && e1rm) {
    velPct = (mvt - vFit.b) / vFit.m;
    velE1rm = (e1rm * velPct) / 100;
  }

  // L*: where EI = Multiple · load crosses the line.
  const lstar = solveLstar(fl.m, fl.b, recruitLine);

  // Drive compression: surplus = α · (1 − load/100)^β, fit in log space.
  const drivePts = points.filter((p) => p.surplus > 0 && p.load < 100);
  const dFit = ols(drivePts.map((p) => ({ x: Math.log(1 - p.load / 100), y: Math.log(p.surplus) })));
  const beta = dFit.m;
  const alpha = dFit.b != null ? Math.exp(dFit.b) : null;
  const driveCurve: Array<{ load: number; fit: number }> = [];
  if (alpha != null && beta != null && points.length) {
    const lo = Math.max(50, Math.floor(points[0].load) - 5);
    const hi = Math.min(96, Math.ceil(points[points.length - 1].load) + 5);
    for (let L = lo; L <= hi; L++) driveCurve.push({ load: L, fit: alpha * (1 - L / 100) ** beta });
  }

  // Prescription bands.
  const bands: Band[] = [];
  let hypBands: Band[] = [];
  if (lstar != null) {
    const speedLo = Math.max(45, lstar - 7);
    bands.push({
      label: "Speed",
      goal: "power",
      lo: speedLo,
      hi: lstar,
      loLb: lb(speedLo),
      hiLb: lb(lstar),
      reps: "2–3",
      sets: "3–5",
      stop: stopVelocity(vAt(lstar), mvt, stops.power),
      neural: null,
      note: "Below L*. Move it fast; this work isn't counted toward the neural dose.",
    });
    const edges = [0, 1, 2, 3, 4].map((i) => lstar + ((TOP_LOAD - lstar) * i) / 4);
    const names = ["Entry strength", "Primary strength", "Heavy strength", "Max strength"];
    const repTargets = [6, 4, 3, 2];
    for (let i = 0; i < 4; i++) {
      const lo = edges[i];
      const hi = edges[i + 1];
      const mid = (lo + hi) / 2;
      const reps = repTargets[i];
      const sets = tuneSets(reps, mid, STRENGTH_SWEET);
      bands.push({
        label: names[i],
        goal: "strength",
        lo,
        hi,
        loLb: lb(lo),
        hiLb: lb(hi),
        reps: `${reps - 1}–${reps + 1}`,
        sets: `${sets}`,
        stop: stopVelocity(vAt(hi), mvt, stops.strength),
        neural: neuralLoad(reps, sets, mid),
      });
    }
    const hLo = 55;
    const hHi = 80;
    const hNames = ["Hypertrophy, light", "Hypertrophy, moderate", "Hypertrophy, heavy"];
    hypBands = [0, 1, 2].map((i) => {
      const lo = hLo + ((hHi - hLo) * i) / 3;
      const hi = hLo + ((hHi - hLo) * (i + 1)) / 3;
      const mid = (lo + hi) / 2;
      const fail = repsToFailure(mid);
      const repsHi = Math.round(fail - HYP_RIR[0]);
      const repsLo = Math.round(fail - HYP_RIR[1]);
      const repsMid = Math.round((repsLo + repsHi) / 2);
      const sets = tuneSets(repsMid, mid, NEURAL_TARGET);
      return {
        label: hNames[i],
        goal: "hypertrophy" as Goal,
        lo,
        hi,
        loLb: lb(lo),
        hiLb: lb(hi),
        reps: `${repsLo}–${repsHi}`,
        sets: `${sets}`,
        stop: stopVelocity(vAt(hi), mvt, stopFractionFor("hypertrophy", mid, lstar, stops)),
        neural: neuralLoad(repsMid, sets, mid),
        note:
          mid < lstar
            ? "Mostly below L*. Take these sets to the deep stop or they're junk volume."
            : "Above L*. The load drives recruitment; reps fall.",
      };
    });
  }

  return {
    points,
    fl,
    cleanSlope,
    vFit,
    velPct,
    velE1rm,
    velCrossPct: e1rm && velE1rm != null ? (Math.abs(velE1rm - e1rm) / e1rm) * 100 : null,
    lstar,
    lstarLb: lstar != null ? lb(lstar) : null,
    eiTop: points.length ? points[points.length - 1].ei : null,
    alpha,
    beta,
    driveCurve,
    bands,
    hypBands,
    vAt,
  };
}

export { round };
