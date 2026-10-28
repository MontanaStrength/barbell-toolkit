// Recruitment curve — the population force–load model behind L* and the
// tension ramp. The single home for L* in the engine: volume pricing
// (effectiveVolume.ts) and, later, the calibration system's schema-door
// routing both read this primitive.
//
// Under the standard maximal-safe-acceleration concentric invariant, a fresh
// rep at load% expresses a peak force of
// Multiple(load%) × load, with Multiple linear in load% (the population F–V
// line, fit from Hanley's Tendo bench probe; SPEC §7). Effective Intensity
// EI = Multiple × load% / 100 is that force as a fraction of e1RM. L* is the
// load where fresh EI crosses the lift's recruitment line — below it the
// high-threshold pool is reached only through fatigue, above it the load
// recruits on its own.
//
// Above L*, expressed peak force plateaus while bar speed keeps falling —
// per-fiber tension (rate coding) is still climbing toward 1RM. tLoad encodes
// that as a linear, velocity-anchored ramp (the T-ramp decision in
// recruitment-tension-model.md).
//
// Everything here is population-level, computed from load% alone. No device
// input, no athlete data.

import { MovementPattern } from '../../types';
import { getExerciseById } from '../../exercises/exerciseLibrary';
import { assertNever } from '../../utils/assertNever';

/** Bump whenever the population force curve or recruitment thresholds change. */
export const RECRUITMENT_CURVE_MODEL_VERSION =
  'recruitment-curve-2026-07-01';

/** Lift classes with a population recruitment curve. Everything else prices
 *  on the fatigue route alone because single-joint peak-force behavior remains
 *  uncharacterized. */
export type RecruitmentLiftClass = 'upper-press' | 'squat' | 'hinge';

interface RecruitmentCurveParams {
  /** Slope of the fresh-Multiple line (Multiple = m·load% + b). */
  m: number;
  /** Intercept of the fresh-Multiple line. */
  b: number;
  /** Fresh-EI fraction treated as full high-threshold recruitment. */
  recruitmentLine: number;
}

/**
 * Tunable seeds for the R × T pricing model (Hanley's numbers — coaching
 * calls, deliberately conservative and biased toward requiring fatigue when
 * the population force route is uncertain).
 */
export const RT_PARAMS = {
  /** Tension at exactly L* — the bottom of the rate-coding ramp. */
  T_AT_LSTAR: 0.6,
  /** Half-width (in load% points) of the smooth R_load blend around L*.
   *  Widened 3 → 5 (Hanley, 2026-07-01) after a real-data run showed credit
   *  swinging ~3× across three points of intensity right where his working
   *  weights sit — the boundary must be a gradient, not a cliff, because
   *  e1RM error lands exactly there. */
  LSTAR_BAND_PCT: 5,
  /** Decay/rep of the recruitment gate beyond RIR 2 (fatigue route).
   *  Steeper than K_T_FATIGUE on purpose: sub-L* far-from-failure work
   *  must price ≈ 0. */
  K_R_FATIGUE: 0.6,
  /** Decay/rep of grind tension beyond RIR 1. */
  K_T_FATIGUE: 0.35,
  /** Low-load gate: 0 at/below start, 1 at/above full (load%). */
  LOW_LOAD_GATE_START: 30,
  LOW_LOAD_GATE_FULL: 40,
  /** Safety cap on the reps priced in a normalization denominator. */
  REP_CAP: 30,
  /** Reps at/above which a hard set earns full credit; shorter hard sets taper
   *  proportionally (the stimulating-rep saturation point). Seeded 5 — the
   *  effective-reps "last ~5 before failure" heuristic — and calibrated against
   *  Hanley's velocity-instrumented sub-L* myo (2026-07-02). Below this, a set's
   *  credit is capped at reps/STIM_FULL_REPS; above it, unaffected. */
  STIM_FULL_REPS: 5,
} as const;

/**
 * Population fresh force–load lines per lift class. The F–V line is fit from
 * bench probe data (SPEC §7); squat/hinge borrow it with a higher recruitment
 * line (larger muscles keep recruiting toward ~100% MVC). These values are
 * WAVY and change only with explicit model review.
 */
export const RECRUITMENT_CURVES: Record<RecruitmentLiftClass, RecruitmentCurveParams> = {
  'upper-press': { m: -0.0114, b: 2.09, recruitmentLine: 0.87 },
  'squat':       { m: -0.0114, b: 2.09, recruitmentLine: 0.90 },
  'hinge':       { m: -0.0114, b: 2.09, recruitmentLine: 0.90 },
};

/** Fresh Multiple (peak force ÷ bar load) predicted at a load%. */
export function freshMultiple(loadPct: number, liftClass: RecruitmentLiftClass): number {
  const { m, b } = RECRUITMENT_CURVES[liftClass];
  return m * loadPct + b;
}

/** Fresh Effective Intensity (peak force ÷ e1RM, as a fraction) at a load%. */
export function freshEI(loadPct: number, liftClass: RecruitmentLiftClass): number {
  return (freshMultiple(loadPct, liftClass) * loadPct) / 100;
}

const lstarCache = new Map<RecruitmentLiftClass, number>();

/**
 * L* — the load% where fresh EI crosses the recruitment line. Solves
 * m·L² + b·L − 100·line = 0 and takes the lower (physical) root.
 */
export function solveLstar(liftClass: RecruitmentLiftClass): number {
  const cached = lstarCache.get(liftClass);
  if (cached != null) return cached;

  const { m, b, recruitmentLine } = RECRUITMENT_CURVES[liftClass];
  const disc = b * b + 4 * m * 100 * recruitmentLine;
  // Negative discriminant means the line is never reached (mis-tuned params);
  // fall back to "everything is sub-L*" rather than throw mid-pricing.
  if (disc < 0) return 100;
  // With m < 0 the two roots bracket the EI peak; the crossing on the way up
  // is the smaller root.
  const lstar = (-b + Math.sqrt(disc)) / (2 * m);
  const clamped = Math.min(100, Math.max(1, lstar));

  lstarCache.set(liftClass, clamped);
  return clamped;
}

/**
 * The rate-coding tension ramp. Above L*: linear from T_AT_LSTAR to 1.0 at
 * 100% 1RM (velocity-anchored — see the T-ramp decision). Below L*: falls
 * away linearly toward 0; sub-L* tension is earned through the grind
 * (tFatigue), not the load.
 */
export function tLoad(loadPct: number, liftClass: RecruitmentLiftClass): number {
  const lstar = solveLstar(liftClass);
  const { T_AT_LSTAR } = RT_PARAMS;

  if (loadPct >= lstar) {
    if (loadPct >= 100) return 1;
    return T_AT_LSTAR + (1 - T_AT_LSTAR) * ((loadPct - lstar) / (100 - lstar));
  }

  return Math.max(0, T_AT_LSTAR * (loadPct / lstar));
}

/**
 * The load route of the recruitment gate: 0 well below L*, 1 above, blended
 * with a smoothstep over L* ± LSTAR_BAND_PCT. L* is a band, not a cliff —
 * the research grades it reliable-not-valid, so nothing may step on it.
 */
export function rLoad(loadPct: number, liftClass: RecruitmentLiftClass): number {
  const lstar = solveLstar(liftClass);
  const band = RT_PARAMS.LSTAR_BAND_PCT;

  const x = (loadPct - (lstar - band)) / (2 * band);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/**
 * Which recruitment curve an exercise prices against, from its movement
 * pattern. Pressing (horizontal + vertical) shares the bench-derived
 * upper-press curve; squat and hinge patterns get their (wavier) curves;
 * everything else — pulls, carries, core, isolation — returns null and
 * prices on the fatigue route alone.
 */
export function liftClassForRecruitment(exerciseId: string): RecruitmentLiftClass | null {
  const def = getExerciseById(exerciseId);
  if (!def) return null;

  switch (def.movementPattern) {
    case MovementPattern.HORIZONTAL_PUSH:
    case MovementPattern.VERTICAL_PUSH:
      return 'upper-press';
    case MovementPattern.SQUAT:
      return 'squat';
    case MovementPattern.HINGE:
      return 'hinge';
    // No recruitment curve has been fitted for these, so they price on the
    // fatigue route alone.
    case MovementPattern.HORIZONTAL_PULL:
    case MovementPattern.VERTICAL_PULL:
    case MovementPattern.CARRY:
    case MovementPattern.CORE:
    case MovementPattern.ISOLATION:
      return null;
    default:
      return assertNever(def.movementPattern);
  }
}
