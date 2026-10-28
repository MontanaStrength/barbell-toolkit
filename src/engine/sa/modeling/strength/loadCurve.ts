import { must } from '../../utils/must';
// Canonical load curve: single source of truth for reps ↔ intensity ↔ RPE
// conversion across the engine.
//
// Source: Nuzzo et al. (2023) meta-regression of >7,000 lifters
// (Low Rep Capacity stratum). The dataset renders as a 21 RPE × 30 reps
// grid but collapses mathematically to a 1D curve in effective reps to
// failure (reps + RIR, where RIR = 10 − RPE). Every diagonal of the grid
// holds a single value within rounding, so we store the curve as 40
// entries indexed by effective reps and look up
//   loadFrac(reps, rpe) = curve[reps + (10 − rpe)]
// with linear interpolation.
//
// Previously the codebase used Brzycki for the prescription path
// (rpeAtIntensity, intensityForRPE, maxRepsAtIntensity) and Nuzzo only
// for back-calculating e1RM from logged sets. The split caused
// prescribed RPEs to systematically under-predict at high intensities:
// Brzycki said a triple at 85% was RPE 6.6 when the Nuzzo curve puts it
// at ~RPE 7.4 and real lifter experience (Shaun, forum post p387053)
// puts it at RPE 8. Unifying both directions on the Nuzzo curve closes
// most of the gap and keeps the formula consistent across prescription
// and analysis. Per-exercise and per-user calibration on top is deferred
// to a later pass.
//
// Public API:
//   loadFracForRepsAndRPE      reps + RPE  → fraction of 1RM (0-1)
//   loadFracForEffectiveReps   effReps     → fraction of 1RM (0-1)
//   effectiveRepsForLoadFrac   load frac   → effective reps to failure
//   maxRepsAtIntensity         %1RM        → max reps to failure
//   intensityForRPE            reps + RPE  → %1RM (1-100, integer)
//   rpeAtIntensity             reps + %1RM → RPE  (1-10, one decimal)
//   estimateLoadForTarget      e1RM + reps + RPE → raw weight

import { INTENSITY_PCT_SCALE_MAX, RPE_SCALE_MAX } from '../../limits';

export const LOAD_CURVE_MODEL_VERSION =
  'load-curve-nuzzo-low-rep-capacity-v1' as const;

const TABLE_MIN_RPE = 0;

// Index = effective reps to failure (reps + RIR).
// Index 0 is unused so the array indexes directly by effective-rep count.
// Source: Nuzzo et al. (2023), Low Rep Capacity stratum.
export const LOAD_FRAC_BY_EFFECTIVE_REPS: readonly number[] = [
  0,
  1.0000, 0.9657, 0.9323, 0.8999, 0.8684, //  1- 5
  0.8379, 0.8084, 0.7800, 0.7525, 0.7260, //  6-10
  0.7006, 0.6760, 0.6525, 0.6298, 0.6081, // 11-15
  0.5872, 0.5671, 0.5479, 0.5294, 0.5116, // 16-20
  0.4946, 0.4782, 0.4625, 0.4474, 0.4329, // 21-25
  0.4189, 0.4055, 0.3926, 0.3802, 0.3682, // 26-30
  0.3567, 0.3457, 0.3350, 0.3247, 0.3148, // 31-35
  0.3053, 0.2961, 0.2872, 0.2786, 0.2703, // 36-40
];

export const MAX_EFFECTIVE_REPS = LOAD_FRAC_BY_EFFECTIVE_REPS.length - 1; // 40
const MIN_LOAD_FRAC = must(LOAD_FRAC_BY_EFFECTIVE_REPS[MAX_EFFECTIVE_REPS], 'LOAD_FRAC_BY_EFFECTIVE_REPS[MAX_EFFECTIVE_REPS]');   // ~0.2703

// Logger's "suggest weight" path historically capped effective reps at 15
// to keep high-rep low-RPE suggestions from collapsing to tiny weights
// that would surprise users. Preserved through the Nuzzo migration as a
// safety floor on estimateLoadForTarget; can be revisited separately.
const ESTIMATE_LOAD_EFFECTIVE_REP_CAP = 15;

/**
 * Load% (fraction of 1RM, 0-1) for a target rep count at a target RPE.
 * Returns null when inputs are out of supported range
 * (RPE outside [0, 10] or reps < 1).
 */
export function loadFracForRepsAndRPE(reps: number, rpe: number): number | null {
  if (rpe < TABLE_MIN_RPE || rpe > RPE_SCALE_MAX) return null;
  if (reps <= 0) return null;
  return loadFracForEffectiveReps(reps + (RPE_SCALE_MAX - rpe));
}

/**
 * Load% (fraction of 1RM, 0-1) for a given effective-reps-to-failure value.
 * Linearly interpolates between integer table entries. Clamps above
 * MAX_EFFECTIVE_REPS to the table tail. Returns null below 1 effective
 * rep (loads > 1RM are undefined on this curve).
 */
export function loadFracForEffectiveReps(effectiveReps: number): number | null {
  if (effectiveReps < 1) return null;
  const clamped = Math.min(MAX_EFFECTIVE_REPS, effectiveReps);
  const lower = Math.floor(clamped);
  const upper = Math.min(MAX_EFFECTIVE_REPS, Math.ceil(clamped));
  const lowerFrac = LOAD_FRAC_BY_EFFECTIVE_REPS[lower];
  const upperFrac = LOAD_FRAC_BY_EFFECTIVE_REPS[upper];
  if (lowerFrac == null || upperFrac == null) return null;
  if (lower === upper) return lowerFrac;
  const t = clamped - lower;
  return lowerFrac + t * (upperFrac - lowerFrac);
}

/**
 * Inverse lookup: effective reps to failure for a given load% fraction (0-1).
 * Returns the table extremes (1 and MAX_EFFECTIVE_REPS) for out-of-range
 * loads. Linear scan is fine — the table has 40 entries.
 */
export function effectiveRepsForLoadFrac(loadFrac: number): number {
  if (loadFrac >= 1.0) return 1;
  if (loadFrac <= MIN_LOAD_FRAC) return MAX_EFFECTIVE_REPS;
  for (let i = 1; i < MAX_EFFECTIVE_REPS; i++) {
    const hi = must(LOAD_FRAC_BY_EFFECTIVE_REPS[i], 'LOAD_FRAC_BY_EFFECTIVE_REPS[i]');
    const lo = must(LOAD_FRAC_BY_EFFECTIVE_REPS[i + 1], 'LOAD_FRAC_BY_EFFECTIVE_REPS[i + 1]');
    if (loadFrac <= hi && loadFrac >= lo) {
      const denom = hi - lo;
      if (denom <= 0) return i;
      const t = (hi - loadFrac) / denom;
      return i + t;
    }
  }
  return MAX_EFFECTIVE_REPS;
}

// ── Public prescription helpers ────────────────────────────────────────
// These preserve the API surface the engine used when these helpers
// lived in optimizerEngine.ts as Brzycki implementations. Same inputs,
// same outputs, Nuzzo curve underneath.

/** Max reps possible at a given %1RM (intensityPct on 0-100 scale). */
export const maxRepsAtIntensity = (intensityPct: number): number => {
  if (intensityPct >= INTENSITY_PCT_SCALE_MAX) return 1;
  if (intensityPct <= 0) return MAX_EFFECTIVE_REPS;
  return effectiveRepsForLoadFrac(intensityPct / 100);
};

/** Derive %1RM (1-100, integer) needed to achieve a target RPE at a given rep count. */
export const intensityForRPE = (reps: number, targetRPE: number): number => {
  if (reps <= 0) return 1;
  const rir = Math.max(0, RPE_SCALE_MAX - targetRPE);
  const effectiveReps = reps + rir;
  const frac = loadFracForEffectiveReps(effectiveReps);
  if (frac == null) return 1;
  return Math.max(1, Math.min(INTENSITY_PCT_SCALE_MAX, Math.round(frac * 100)));
};

/** Derive the RPE (1-10, one decimal) for a given rep count at a given %1RM. */
export const rpeAtIntensity = (reps: number, intensityPct: number): number => {
  if (intensityPct >= INTENSITY_PCT_SCALE_MAX) return RPE_SCALE_MAX;
  if (reps <= 0) return 1;
  const maxReps = maxRepsAtIntensity(intensityPct);
  const rir = Math.max(0, maxReps - reps);
  const rpe = RPE_SCALE_MAX - rir;
  return Math.min(RPE_SCALE_MAX, Math.max(1, Math.round(rpe * 10) / 10));
};

/**
 * Given an estimated 1RM, project the load needed for a target rep count
 * at a target RPE. Returns raw weight in the same unit as e1rm.
 * Returns 0 for invalid inputs.
 *
 * Caps effective reps at ESTIMATE_LOAD_EFFECTIVE_REP_CAP — see the
 * constant for rationale.
 */
export function estimateLoadForTarget(
  e1rm: number,
  targetReps: number,
  targetRpe: number,
): number {
  if (e1rm <= 0 || targetReps <= 0) return 0;
  const rir = (targetRpe >= 5 && targetRpe <= RPE_SCALE_MAX) ? (RPE_SCALE_MAX - targetRpe) : 0;
  const effectiveReps = Math.min(ESTIMATE_LOAD_EFFECTIVE_REP_CAP, targetReps + rir);
  if (effectiveReps <= 1) return e1rm;
  const frac = loadFracForEffectiveReps(effectiveReps);
  if (frac == null) return 0;
  return e1rm * frac;
}
