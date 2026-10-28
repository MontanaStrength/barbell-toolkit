/**
 * Population priors retained from the original accrued-fatigue model.
 *
 * These values are calibration inputs, not a complete sequence model. The
 * chronological projector determines how work carries through recovery.
 */
export const HEURISTIC_DRIFT_PER_SET = 0.35;

/** Readiness-modulated population prior for RPE drift per ordinary set. */
export function readinessAdjustedDrift(compositeReadiness: number): number {
  if (compositeReadiness >= 80) return 0.30;
  if (compositeReadiness >= 65) return 0.35;
  if (compositeReadiness >= 50) return 0.40;
  if (compositeReadiness >= 30) return 0.45;
  return 0.50;
}

/**
 * Rep-count population prior for the next-set RPE effect at reference rest.
 * The chronological projector calibrates its deposited dose to preserve this
 * observed/tuned behavior at the reference transition.
 */
export function driftRateForReps(reps: number): number {
  if (reps <= 1) return 0.15;
  if (reps <= 3) return 0.22;
  if (reps <= 5) return 0.28;
  if (reps <= 8) return 0.33;
  return 0.38;
}

/** Parse a rep specification to the most fatiguing planned rep count. */
export function repsForDrift(
  repsSpec: string | number | null | undefined,
): number {
  if (typeof repsSpec === 'number') return repsSpec;
  const values = String(repsSpec ?? '').match(/\d+/g)?.map(Number) ?? [];
  return values.length > 0 ? Math.max(...values) : 5;
}
