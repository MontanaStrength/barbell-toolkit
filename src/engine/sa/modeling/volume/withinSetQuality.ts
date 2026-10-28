import { must } from '../../utils/must';
// Within-set output quality — how much of a repetition's output survives the
// fatigue produced earlier in the same set.
//
// Proximity to failure has two causes and only one of them is degradation. A
// repetition sits at low RIR either because the load is near-maximal (a fresh
// single at 92%) or because repetitions have already been performed (the tenth
// rep of a twelve). The first is task specificity and belongs to the load and
// force-route axes; only the second is a loss of output, and it is what this
// module prices. Keying quality to absolute RIR conflates the two and reads a
// crisp near-limit single as fully degraded.
//
// The axis is therefore the fraction of repetition capacity consumed BEFORE
// the repetition. A genuinely fresh set begins at zero. A continuation segment
// begins at its recovered entering-depletion state, then consumes the remaining
// capacity across the repetitions it can still perform.

export const WITHIN_SET_QUALITY_MODEL_VERSION =
  'within-set-quality-capacity-v2' as const;

export const WITHIN_SET_QUALITY_CONFIG = {
  version: WITHIN_SET_QUALITY_MODEL_VERSION,
  /**
   * Curvature over consumed capacity. One is linear decay; below one penalizes
   * long sets harder, above one holds output through the early repetitions and
   * drops it away late. Seeded above one because output is held early in a set
   * rather than shed evenly, and because linear decay compresses the heavy
   * reference below a moderate five at 80%. Seed, not a measured value.
   */
  consumedExponent: 1.5,
} as const;

export interface WithinSetQualityState {
  /** Fraction of capacity already consumed before the segment begins. */
  enteringDepletion: number | null;
  /** Optional sensitivity override; production uses the versioned config. */
  consumedExponent: number | null;
}

/** Number preserves the v1 consumed-exponent call form for existing callers. */
export type WithinSetQualityOptions = WithinSetQualityState | number;

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

function qualityState(
  options: WithinSetQualityOptions,
): WithinSetQualityState {
  return typeof options === 'number'
    ? { enteringDepletion: null, consumedExponent: options }
    : options;
}

/** Realized segment capacity: repetitions completed plus terminal reserve. */
export function setRepCapacity(reps: number, terminalRir: number): number {
  if (!Number.isFinite(reps) || reps <= 0) return 0;

  const reserve = Number.isFinite(terminalRir) ? Math.max(0, terminalRir) : 0;

  return reps + reserve;
}

/**
 * Retained output quality of one repetition, addressed by its 1-based position
 * in the segment. Position one is fully retained only when entering depletion
 * is zero.
 */
export function repWithinSetQuality(
  position: number,
  reps: number,
  terminalRir: number,
  options: WithinSetQualityOptions,
): number {
  if (!Number.isFinite(position)) return 0;

  const wholeReps = Number.isFinite(reps) ? Math.floor(reps) : 0;
  if (wholeReps <= 0 || position < 1 || position > wholeReps) return 0;

  const state = qualityState(options);
  const consumedExponent =
    state.consumedExponent ?? WITHIN_SET_QUALITY_CONFIG.consumedExponent;
  if (!Number.isFinite(consumedExponent) || consumedExponent <= 0) return 0;

  const capacity = setRepCapacity(reps, terminalRir);
  if (capacity <= 0) return 0;

  const enteringDepletion = Number.isFinite(state.enteringDepletion)
    ? clamp01(must(state.enteringDepletion, 'state.enteringDepletion'))
    : 0;
  const remainingCapacity = 1 - enteringDepletion;
  const consumed = clamp01(
    enteringDepletion
      + remainingCapacity * ((position - 1) / capacity),
  );

  return Math.max(0, 1 - Math.pow(consumed, consumedExponent));
}

/** Mean retained quality across every repetition of the set. */
export function meanWithinSetQuality(
  reps: number,
  terminalRir: number,
  options: WithinSetQualityOptions,
): number {
  if (!Number.isFinite(reps)) return 0;

  const wholeReps = Math.floor(reps);
  if (wholeReps <= 0) return 0;

  const state = qualityState(options);
  let total = 0;
  for (let position = 1; position <= wholeReps; position++) {
    total += repWithinSetQuality(
      position,
      wholeReps,
      terminalRir,
      state,
    );
  }

  return total / wholeReps;
}
