// Benefit vector — four currencies that price what a set buys. The set and
// session adaptation stack exposes them to evaluation and to the explicitly
// selected vector optimizer. Ordinary generation still defaults to the legacy
// optimizer; changing that rollout boundary requires Hanley's approval.
//
//   hypertrophy    — effectiveSetCredit (exists, unchanged; not re-exported here)
//   maxStrength    — specific heavy PRACTICE, in quality-rep units. Per-rep
//                    central-drive demand (R · tLoad^κ) normalized so one
//                    quality triple @ ~85% ≈ 3.0, intensity-gated to
//                    genuinely heavy work — sub-heavy grinding is hypertrophy's
//                    business, speed work is power's.
//   power          — full-intent fast reps at speed loads: in the speed band,
//                    far enough from failure that intent can be fast.
//   localEndurance — dense working TIME, in minutes; long sets and density
//                    blocks earn it, short sets don't.
//
// All seeds WAVY. The accrued hypertrophy ledger remains a single currency per
// muscle; this vector is a prescription/evaluation language.

import {
  recruitmentGate,
  terminalRir,
  COST_PARAMS,
} from './fatigueCost';
import { tLoad, type RecruitmentLiftClass } from './recruitmentCurve';
import type { EffectiveSetInput } from './effectiveVolume';
import { getExerciseById } from '../../exercises/exerciseLibrary';

/** Bump whenever the native benefit currencies or references change. */
export const BENEFIT_VECTOR_MODEL_VERSION =
  'benefit-vector-a2a-2026-07-17';

/** Tunable seeds for the benefit pricers (Hanley's numbers; all WAVY). */
export const BENEFIT_VECTOR_PARAMS = {
  /** maxStrength reference rep: one crisp rep @ this intensity at this RIR
   *  defines 1.0 practice unit — so a quality triple @ 85% prices ≈ 3.0.
   *  The unit is rep-denominated and felt-checkable. */
  STR_REF_INTENSITY_PCT: 85,
  STR_REF_RIR: 3,
  /** Intensity gate for practice credit: 0 at/below START, full at/above
   *  FULL (smoothstep). Keeps sub-heavy grinding (whose per-rep drive is
   *  real but whose adaptation is hypertrophy) out of the strength-practice
   *  ledger — heavy specificity is the currency. */
  STR_PRACTICE_INT_GATE_START: 75,
  STR_PRACTICE_INT_GATE_FULL: 85,
  /** Close-variant practice credit: the specific movement earns 1.0;
   *  a same-pattern variant (bench ↔ close-grip) earns this; a different
   *  pattern (bench ↔ OHP) earns 0. The e1RM cross-ratio machinery is the
   *  same-pattern authority, so pattern identity is the v1 confidence
   *  proxy. */
  VARIANT_PRACTICE_CREDIT: 0.75,
  /** Power band (%1RM) — where speed work lives. */
  PWR_INT_MIN: 55,
  PWR_INT_MAX: 78,
  /** A rep earns full power credit at/above this RIR (fresh enough for full
   *  intent) and none at/below PWR_RIR_NONE — fatigued reps aren't fast. */
  PWR_RIR_FULL: 4,
  PWR_RIR_NONE: 2,
  /** localEndurance: assumed seconds per rep, and the rep-count ramp below
   *  which a set earns no endurance credit (short sets are not dense time). */
  END_SECONDS_PER_REP: 3,
  END_REPS_RAMP_START: 10,
  END_REPS_RAMP_FULL: 15,
} as const;

const smoothstep = (x: number, lo: number, hi: number): number => {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
};

/** Per-rep central-drive demand at a given intensity/RIR, reused as the
 *  practice measure. */
const repDrive = (intensityPct: number, rir: number, liftClass: RecruitmentLiftClass): number =>
  recruitmentGate(intensityPct, rir, liftClass) * Math.pow(tLoad(intensityPct, liftClass), COST_PARAMS.KAPPA);

/**
 * maxStrength practice units for one set — Σ per-rep demand ÷ the reference
 * rep's demand, intensity-gated. Unclassed lifts price 0 (no force curve →
 * no specificity claim). A quality triple @ 85% ≈ 3.0 by construction.
 */
export function strengthPracticeUnits(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  const p = BENEFIT_VECTOR_PARAMS;
  const reps = Math.floor(set.reps);
  if (liftClass == null || reps <= 0 || set.intensityPct <= 0) return 0;

  const intensityPct = Math.min(100, set.intensityPct);
  const gate = smoothstep(intensityPct, p.STR_PRACTICE_INT_GATE_START, p.STR_PRACTICE_INT_GATE_FULL);
  if (gate === 0) return 0;

  const ref = repDrive(p.STR_REF_INTENSITY_PCT, p.STR_REF_RIR, liftClass);
  if (ref <= 0) return 0;

  const tRir = terminalRir(set.rpe);
  let units = 0;
  for (let i = 1; i <= reps; i++) {
    units += repDrive(intensityPct, tRir + (reps - i), liftClass) / ref;
  }
  return units * gate;
}

/**
 * Power practice units for one set — reps in the speed band, each scaled by
 * how fresh it is (fatigued reps cannot realize the prescribed speed).
 * Class-free.
 *
 * EXPLOSIVE EXECUTION IS PRESCRIPTIVE, not inferable: a moderate hypertrophy
 * set and a dynamic-effort set can share (reps, %1RM, RPE) — only the scheme
 * knows the bar was meant to fly. The prescription does not claim high
 * realized velocity; load and retained quality still constrain output.
 * Without the flag every fresh moderate rep in the hypertrophy window would
 * masquerade as power practice. The pricer therefore prices 0 by default.
 */
export function powerPracticeUnits(
  set: EffectiveSetInput,
  opts: { fastIntent: boolean | null },
): number {
  if (opts.fastIntent !== true) return 0;
  const p = BENEFIT_VECTOR_PARAMS;
  const reps = Math.floor(set.reps);
  if (reps <= 0 || set.intensityPct < p.PWR_INT_MIN || set.intensityPct > p.PWR_INT_MAX) return 0;

  const tRir = terminalRir(set.rpe);
  let units = 0;
  for (let i = 1; i <= reps; i++) {
    const rir = tRir + (reps - i);
    units += smoothstep(rir, p.PWR_RIR_NONE, p.PWR_RIR_FULL);
  }
  return units;
}

/** localEndurance units (minutes of dense working time) for one SET — long
 *  sets earn their working duration, short sets earn ~nothing. */
export function localEnduranceUnits(set: EffectiveSetInput): number {
  const p = BENEFIT_VECTOR_PARAMS;
  const reps = Math.floor(set.reps);
  if (reps <= 0) return 0;
  const minutes = (reps * p.END_SECONDS_PER_REP) / 60;
  return minutes * smoothstep(reps, p.END_REPS_RAMP_START, p.END_REPS_RAMP_FULL);
}

/** localEndurance units for a DENSITY block — the definitional unit: its
 *  prescribed working minutes. */
export function localEnduranceUnitsForDensityBlock(durationMinutes: number): number {
  return Math.max(0, durationMinutes);
}

/**
 * Close-variant practice credit: how much practice on `exerciseId`
 * counts toward `mainExerciseId`'s specific-practice ledger. Exact movement
 * 1.0; same movement pattern (the e1RM cross-ratio's own scope) at the
 * variant credit; different pattern 0.
 */
export function variantPracticeCredit(exerciseId: string, mainExerciseId: string): number {
  if (exerciseId === mainExerciseId) return 1;
  const a = getExerciseById(exerciseId);
  const b = getExerciseById(mainExerciseId);
  if (!a || !b) return 0;
  return a.movementPattern === b.movementPattern
    ? BENEFIT_VECTOR_PARAMS.VARIANT_PRACTICE_CREDIT
    : 0;
}

/**
 * Legacy shadow read in native currencies. These fields are not normalized
 * against compatible reference units: strength/power are practice reps and
 * local endurance is rep-gated minutes. Do not compare its dimensions as a
 * vector; new normalized reads use `EffectiveSetVector`, while their native
 * calibration doses remain separately inspectable.
 *
 * `hypertrophy` is filled by the caller from `effectiveSetCredit` (kept out of
 * here to avoid a circular seam with effectiveVolume).
 */
export interface BenefitVector {
  hypertrophy: number;
  maxStrength: number;
  power: number;
  localEndurance: number;
}
