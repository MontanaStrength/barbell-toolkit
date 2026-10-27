// Reps, load and effort on one curve, as Strength Architect's solvers use them
// (modeling/strength/loadCurve.ts and schemes/peakForce.ts, origin/main,
// Oct 27, 2026).
//
// The curve is the Nuzzo et al. (2023) meta-regression, Low Rep Capacity
// stratum. Its reps × RPE grid collapses to one line in effective reps to
// failure, reps + reps in reserve (RIR = 10 − RPE), so load for a set is
//   load(reps, RPE) = curve[reps + (10 − RPE)]
// with linear interpolation between the integer entries.

/** Fraction of max by effective reps to failure. Index 0 is unused. */
const CURVE = [
  0,
  1.0, 0.9657, 0.9323, 0.8999, 0.8684, //  1– 5
  0.8379, 0.8084, 0.78, 0.7525, 0.726, //  6–10
  0.7006, 0.676, 0.6525, 0.6298, 0.6081, // 11–15
  0.5872, 0.5671, 0.5479, 0.5294, 0.5116, // 16–20
  0.4946, 0.4782, 0.4625, 0.4474, 0.4329, // 21–25
  0.4189, 0.4055, 0.3926, 0.3802, 0.3682, // 26–30
  0.3567, 0.3457, 0.335, 0.3247, 0.3148, // 31–35
  0.3053, 0.2961, 0.2872, 0.2786, 0.2703, // 36–40
];
const MAX_EFFECTIVE = CURVE.length - 1;

/** Fraction of max that this many effective reps to failure allows; null below one rep. */
export function loadFracForEffectiveReps(effective: number): number | null {
  if (effective < 1) return null;
  const c = Math.min(MAX_EFFECTIVE, effective);
  const lo = Math.floor(c);
  const hi = Math.min(MAX_EFFECTIVE, Math.ceil(c));
  if (lo === hi) return CURVE[lo];
  return CURVE[lo] + (c - lo) * (CURVE[hi] - CURVE[lo]);
}

/** Reps to failure at a load, % of max. */
export function maxRepsAt(pct: number): number {
  const frac = pct / 100;
  if (frac >= 1) return 1;
  if (frac <= CURVE[MAX_EFFECTIVE]) return MAX_EFFECTIVE;
  for (let i = 1; i < MAX_EFFECTIVE; i++) {
    const hi = CURVE[i];
    const lo = CURVE[i + 1];
    if (frac <= hi && frac >= lo) return hi - lo <= 0 ? i : i + (hi - frac) / (hi - lo);
  }
  return MAX_EFFECTIVE;
}

/** The load, whole % of max, at which this many reps lands at this RPE. */
export function intensityForRPE(reps: number, rpe: number): number {
  if (reps <= 0) return 1;
  const frac = loadFracForEffectiveReps(reps + Math.max(0, 10 - rpe));
  if (frac == null) return 1;
  return Math.max(1, Math.min(100, Math.round(frac * 100)));
}

/** The RPE, to one decimal, of this many reps at a load. */
export function rpeAt(reps: number, pct: number): number {
  if (pct >= 100) return 10;
  if (reps <= 0) return 1;
  const rpe = 10 - Math.max(0, maxRepsAt(pct) - reps);
  return Math.min(10, Math.max(1, Math.round(rpe * 10) / 10));
}

/**
 * The most effort the engine prescribes for a set of this many reps:
 * RPE 9 up to five reps, RPE 7.5 from six (limits.ts).
 */
export const rpeCeiling = (reps: number) => (reps >= 6 ? 7.5 : 9);

/**
 * The peak-force drop rep: the last rep still at 95% or more of the first
 * rep's peak force. Reps to failure × a quality ratio that shrinks toward
 * 90%; one rep above 90%.
 *
 * SA's notes on this function describe the reps-to-failure term as Brzycki
 * and tabulate 70% → 6, 75% → 5 and 84% → 3. The code takes it from the
 * curve above, which gives 5, 4 and 2 there; this follows the code.
 */
export function dropRep(pct: number): number {
  const I = Math.max(30, Math.min(pct, 100));
  if (I > 90) return 1;
  const ratio = 0.3 + 0.24 * Math.pow((90 - I) / 30, 0.65);
  return Math.max(1, Math.round(maxRepsAt(I) * ratio));
}

/** An RPE as a lifter says it: to the nearest half point. */
export const halfPoint = (rpe: number) => Math.round(rpe * 2) / 2;
