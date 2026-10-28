/**
 * Accrued fatigue model for resistance training
 *
 * The Metabolic Load formula treats each set in isolation. In reality, later sets at
 * the same load/reps feel harder (RPE drift). We use a rep-scaled heuristic: effective
 * RPE = prescribed + driftRateForReps(reps) × set index (0-based). Literature: ~0.3–0.5 RPE drift
 * per set (Helms et al.; work rate and session RPE). We use this for capping and
 * display so prescriptions stay in the target zone under fatigue-aware counting.
 */

import { must } from '../../utils/must';
import {
  driftRateForReps,
} from '../effort/effortPrior';

export {
  HEURISTIC_DRIFT_PER_SET,
  readinessAdjustedDrift,
  driftRateForReps,
  repsForDrift,
} from '../effort/effortPrior';

export const ACCRUED_FATIGUE_MODEL_VERSION =
  'accrued-fatigue-rpe-drift-v1' as const;

/**
 * Effective RPE for set index i (0-based): prescribed + drift × i.
 * Used when aggregating Metabolic Load so later sets contribute more metabolic load.
 */
export function effectiveRPEHeuristic(
  setIndex0Based: number,
  prescribedRPE: number,
  driftPerSet: number,
): number {
  const effective = prescribedRPE + driftPerSet * setIndex0Based;
  return Math.min(10, Math.max(1, effective));
}


/**
 * Total Metabolic Load for a sequence of sets using heuristic effective RPE per set.
 */
export function calculateSessionMetabolicLoadWithFatigue(
  sets: Array<{ intensityPct: number; reps: number; rpe: number }>,
  _restSec: number,
  mode: 'none' | 'heuristic',
  calculateSetMetabolicLoad: (intensityPct: number, reps: number, rpe: number) => number,
): { totalLoad: number; perSetLoads: number[]; effectiveRPEs: number[] } {
  const perSetLoads: number[] = [];
  const effectiveRPEs: number[] = [];

  for (let i = 0; i < sets.length; i++) {
    const s = must(sets[i], 'sets[i]');
    const effectiveRPE = mode === 'none' ? s.rpe : effectiveRPEHeuristic(i, s.rpe, driftRateForReps(s.reps));
    effectiveRPEs.push(effectiveRPE);
    const load = calculateSetMetabolicLoad(s.intensityPct, s.reps, effectiveRPE);
    perSetLoads.push(load);
  }

  const totalLoad = perSetLoads.reduce((a, b) => a + b, 0);
  return { totalLoad, perSetLoads, effectiveRPEs };
}

export interface TaperedPrescription {
  leadSets: number;
  leadReps: number;
  leadRPE: number;
  taperSets: number;
  taperReps: number;
  taperRPE: number;
  totalReps: number;
  totalMetabolicLoad: number;
  description: string;
}

/**
 * Heuristic Metabolic Load total for a tapered prescription (used for cap and display).
 * Builds lead + taper sets and sums Metabolic Load using effective RPE = prescribed + driftRateForReps(reps) × set index.
 */
export function getTaperedHeuristicTotal(
  leadSets: number,
  leadReps: number,
  leadRPE: number,
  taperSets: number,
  taperReps: number,
  taperRPE: number,
  intensityPct: number,
  calculateSetMetabolicLoad: (intensityPct: number, reps: number, rpe: number) => number,
): number {
  const sets: Array<{ intensityPct: number; reps: number; rpe: number }> = [];
  for (let i = 0; i < leadSets; i++) {
    sets.push({ intensityPct, reps: leadReps, rpe: leadRPE });
  }
  for (let i = 0; i < taperSets; i++) {
    sets.push({ intensityPct, reps: taperReps, rpe: taperRPE });
  }
  const result = calculateSessionMetabolicLoadWithFatigue(sets, 0, 'heuristic', calculateSetMetabolicLoad);
  return result.totalLoad;
}

/**
 * Given a chosen tapered prescription, return no-fatigue and heuristic totals (for display).
 */
export function taperedMetabolicTotals(
  tapered: TaperedPrescription,
  intensityPct: number,
  calculateSetMetabolicLoad: (intensityPct: number, reps: number, rpe: number) => number,
): { totalNoFatigue: number; totalHeuristic: number } {
  const heuristicTotal = getTaperedHeuristicTotal(
    tapered.leadSets,
    tapered.leadReps,
    tapered.leadRPE,
    tapered.taperSets,
    tapered.taperReps,
    tapered.taperRPE,
    intensityPct,
    calculateSetMetabolicLoad,
  );
  return { totalNoFatigue: tapered.totalMetabolicLoad, totalHeuristic: heuristicTotal };
}

export interface ForceMetabolicPrescription {
  forceBlock: { sets: number; reps: number; rpe: number };
  metabolicBlock: { sets: number; reps: number; rpe: number };
  intensityPct: number;
  totalMetabolicLoad: number;
}

/**
 * Heuristic Metabolic Load total for a force-metabolic prescription.
 *
 * Force and metabolic sets alternate (F-M-F-M...).
 * If one block has more sets, the extras are appended at the end.
 *
 * RPE drift applies across the entire sequence (set index 0-based).
 */
export function forceMetabolicMetabolicTotals(
  scheme: ForceMetabolicPrescription,
  calculateSetMetabolicLoad: (intensityPct: number, reps: number, rpe: number) => number,
): { totalNoFatigue: number; totalHeuristic: number } {
  const forceSet = { intensityPct: scheme.intensityPct, reps: scheme.forceBlock.reps, rpe: scheme.forceBlock.rpe };
  const metabSet = { intensityPct: scheme.intensityPct, reps: scheme.metabolicBlock.reps, rpe: scheme.metabolicBlock.rpe };

  const sets: Array<{ intensityPct: number; reps: number; rpe: number }> = [];

  const maxPairs = Math.max(scheme.forceBlock.sets, scheme.metabolicBlock.sets);
  for (let i = 0; i < maxPairs; i++) {
    if (i < scheme.forceBlock.sets) sets.push({ ...forceSet });
    if (i < scheme.metabolicBlock.sets) sets.push({ ...metabSet });
  }

  const result = calculateSessionMetabolicLoadWithFatigue(sets, 0, 'heuristic', calculateSetMetabolicLoad);
  return { totalNoFatigue: scheme.totalMetabolicLoad, totalHeuristic: result.totalLoad };
}
