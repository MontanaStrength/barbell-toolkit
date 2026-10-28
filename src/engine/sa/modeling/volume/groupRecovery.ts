import { must } from '../../utils/must';
// Shared carried-depletion recovery state for compound set structures.
//
// This is neither stimulus nor cost. It is the deterministic state supplied to
// both sides of the model. The v1 curve preserves the existing grouped-cost
// behavior exactly: linear recovery, a missing-rest fallback, and a bounded
// accumulated-depletion state.

export const PARTIAL_GROUP_RECOVERY_MODEL_VERSION =
  'partial-group-recovery-linear-v1' as const;

export const GROUP_RECOVERY_CONFIG = {
  version: PARTIAL_GROUP_RECOVERY_MODEL_VERSION,
  depletionPerCompletedSegment: 0.28,
  fullRecoverySeconds: 100,
  maximumCarriedDepletion: 0.9,
  missingRestRetainedFraction: 0.8,
} as const;

export interface PartialGroupRecoveryInput {
  /** Depletion accumulated before the current rest interval. */
  accumulatedDepletion: number;
  /** Rest immediately before the next segment. Missing uses the fallback. */
  restSeconds: number | null;
}

export interface PartialGroupRecoveryResult {
  modelVersion: typeof PARTIAL_GROUP_RECOVERY_MODEL_VERSION;
  accumulatedDepletion: number;
  restSeconds: number | null;
  usedMissingRestFallback: boolean;
  retainedFraction: number;
  recoveredDepletion: number;
  carriedDepletion: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function recoverGroupDepletion(
  input: PartialGroupRecoveryInput,
): PartialGroupRecoveryResult {
  const accumulatedDepletion = clamp(
    Number.isFinite(input.accumulatedDepletion)
      ? input.accumulatedDepletion
      : 0,
    0,
    GROUP_RECOVERY_CONFIG.maximumCarriedDepletion,
  );
  const hasRest = input.restSeconds != null
    && Number.isFinite(input.restSeconds);
  const restSeconds = hasRest
    ? Math.max(0, must(input.restSeconds, 'input.restSeconds'))
    : null;
  const retainedFraction = restSeconds == null
    ? GROUP_RECOVERY_CONFIG.missingRestRetainedFraction
    : clamp(
      1 - restSeconds / GROUP_RECOVERY_CONFIG.fullRecoverySeconds,
      0,
      1,
    );
  const carriedDepletion = accumulatedDepletion * retainedFraction;

  return {
    modelVersion: PARTIAL_GROUP_RECOVERY_MODEL_VERSION,
    accumulatedDepletion,
    restSeconds,
    usedMissingRestFallback: restSeconds == null,
    retainedFraction,
    recoveredDepletion: accumulatedDepletion - carriedDepletion,
    carriedDepletion,
  };
}
