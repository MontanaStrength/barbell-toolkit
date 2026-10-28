// Effective volume — the R × T hypertrophy pricing of a single set.
//
// Per rep: stimulus = R × T, where R is the recruitment gate (are the prime
// mover's high-threshold units in play?) and T is tension quality (how hard
// are they firing?). Each factor takes the stronger of two routes — load
// (via the population recruitment curve) or fatigue (via proximity to
// failure). The set's credit is the sum,
// normalized by the hard-set ratio: the same load taken to terminal RIR 2
// (the top of the near-failure flat zone) counts as 1.0, so a hard set ≈ 1.0
// effective set at any load and going deeper caps rather than double-counts.
//
// Pure math over load% + reps + RPE. Callers own resolving load% (weight ÷
// e1RM) and the lift class; this module never sees a log or a device.

import { maxRepsAtIntensity } from '../strength/loadCurve';
import {
  RT_PARAMS,
  rLoad,
  tLoad,
  type RecruitmentLiftClass,
} from './recruitmentCurve';

/** Bump whenever the R × T effective-set compatibility calculation changes. */
export const EFFECTIVE_VOLUME_MODEL_VERSION =
  'effective-volume-rt-2026-07-02';

/** One set as the pricer sees it. `rpe` may be fractional (e.g. 9.5). */
export interface EffectiveSetInput {
  reps: number;
  /** Load as %1RM, 0–100+ (supra-max clamps to 100 for curve reads). */
  intensityPct: number;
  /** Logged or prescribed RPE, 1–10. */
  rpe: number;
}

/**
 * Fatigue route of the recruitment gate: full at RIR ≤ 2 (the flat zone the
 * corridor bridge requires), decaying beyond.
 */
export function rFatigue(rir: number): number {
  if (rir <= 2) return 1;
  return Math.exp(-RT_PARAMS.K_R_FATIGUE * (rir - 2));
}

/** Grind tension: full at RIR ≤ 1, decaying beyond. */
export function tFatigue(rir: number): number {
  if (rir <= 1) return 1;
  return Math.exp(-RT_PARAMS.K_T_FATIGUE * (rir - 1));
}

/**
 * Very-light-load gate on recruitment: below ~30% 1RM even
 * near-failure work may not reach the high-threshold pool. Smoothstep 0→1
 * across LOW_LOAD_GATE_START→FULL.
 */
export function lowLoadGate(loadPct: number): number {
  const { LOW_LOAD_GATE_START: start, LOW_LOAD_GATE_FULL: full } = RT_PARAMS;
  const x = (loadPct - start) / (full - start);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/** R × T for a single rep at a given RIR. */
function repStimulus(
  intensityPct: number,
  rir: number,
  liftClass: RecruitmentLiftClass | null,
): number {
  const loadR = liftClass != null ? rLoad(intensityPct, liftClass) : 0;
  const loadT = liftClass != null ? tLoad(intensityPct, liftClass) : 0;

  const gate = Math.max(loadR, rFatigue(rir)) * lowLoadGate(intensityPct);
  const tension = Math.max(loadT, tFatigue(rir));

  return gate * tension;
}

/** Σ R × T over a set of `reps` ending at `terminalRir`. */
function rawSetStimulus(
  reps: number,
  intensityPct: number,
  terminalRir: number,
  liftClass: RecruitmentLiftClass | null,
): number {
  let sum = 0;
  for (let i = 1; i <= reps; i++) {
    sum += repStimulus(intensityPct, terminalRir + (reps - i), liftClass);
  }
  return sum;
}

/**
 * Effective-set credit for one straight set (or one technique mini-set):
 * ≈ 1.0 for a hard set at any load, fractional for submax work, ≈ 0 for
 * light far-from-failure work. Capped per set by the short-set taper —
 * technique protocols exceed 1 per slot by summing their (tapered) mini-sets,
 * not by one set overflowing.
 */
export function effectiveSetCredit(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  const reps = Math.floor(set.reps);
  if (reps <= 0 || set.intensityPct <= 0 || !Number.isFinite(set.intensityPct)) return 0;

  const intensityPct = Math.min(100, set.intensityPct);
  const terminalRir = Math.min(9, Math.max(0, 10 - set.rpe));

  const raw = rawSetStimulus(reps, intensityPct, terminalRir, liftClass);

  // Hard-set ratio denominator: the same load taken to terminal RIR 2.
  const capacity = maxRepsAtIntensity(intensityPct);
  const denomReps = Math.min(RT_PARAMS.REP_CAP, Math.max(1, Math.floor(capacity - 2)));
  const denom = rawSetStimulus(denomReps, intensityPct, 2, liftClass);
  if (denom <= 0) return 0;

  // Short-set taper (the cap, replacing a flat 1.0). A set's stimulating dose
  // saturates at ~STIM_FULL_REPS reps, so a hard set SHORTER than that earns a
  // proportional fraction, not a full set — a single heavy rep or a 3-rep myo
  // mini-set is not a whole effective set. Applied as the cap so it only pulls
  // down sets that would otherwise hit ~1.0 (short + near-failure); sets already
  // below it (e.g. an over-L* cluster triple at RIR 4-5, ~0.37) are untouched.
  // Calibrated 2026-07-02 against Hanley's velocity-instrumented sub-L* myo
  // (model 5.0 → felt 4 / velocity ~3.4; taper lands it ~3.8) and the schema
  // grid (heavy singles stop reading as full hypertrophy sets). Only bites below
  // ~5 reps — the under-studied short-set regime; the load-to-failure literature
  // (5–30 reps) is unaffected.
  const shortSetCap = Math.min(1, reps / RT_PARAMS.STIM_FULL_REPS);
  return Math.min(shortSetCap, raw / denom);
}
