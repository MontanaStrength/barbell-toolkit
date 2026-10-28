import { must } from '../../utils/must';
// Set-group composition around the unchanged set-level adaptation primitive.
//
// A group is an ordered series of real set segments. Each segment retains its
// own adaptation result and cost. Between segments, the existing grouped-set
// carry model converts structured rest into partial recovery. When segment RPE
// is not observed or independently prescribed, the existing rep-scaled RPE
// drift model estimates how that unresolved carry changes realized effort.
//
// This layer does not saturate session adaptation, alter a set-level
// equation, or reinterpret confidence as a stimulus multiplier.

import {
  ACCRUED_FATIGUE_MODEL_VERSION,
  HEURISTIC_DRIFT_PER_SET,
  driftRateForReps,
  readinessAdjustedDrift,
} from '../hypertrophy/accruedFatigueModel';
import {
  COST_PARAMS,
  FATIGUE_COST_MODEL_VERSION,
} from './fatigueCost';
import {
  GROUP_RECOVERY_CONFIG,
  PARTIAL_GROUP_RECOVERY_MODEL_VERSION,
  recoverGroupDepletion,
  type PartialGroupRecoveryResult,
} from './groupRecovery';
import {
  computeSetAdaptation,
  EFFECTIVE_SET_MODEL_CONFIG,
  type EffectiveSetVector,
  type ModelConfidence,
  type NativeAdaptationDose,
  type SetAdaptationInput,
  type SetAdaptationReasonCode,
  type SetAdaptationResult,
  type TrainingCostVector,
} from './setAdaptation';

export const SET_GROUP_ADAPTATION_MODEL_VERSION =
  'set-group-adaptation-v1.1' as const;

export type SetGroupStructure =
  | 'cluster'
  | 'rest_pause'
  | 'myo_reps'
  | 'drop_set'
  | 'wave'
  | 'tapered'
  | 'repeated_mini_sets';

/**
 * `group_baseline` means the RPE belongs to the fresh first segment and needs
 * carry-aware drift. Observed and segment-specific values are already realized
 * at that segment, so the composer preserves them.
 */
export type SegmentEffortSource =
  | 'group_baseline'
  | 'segment_specific'
  | 'observed';

export type SetGroupAdaptationReasonCode =
  | 'partial_group_recovery'
  | 'partial_cluster_recovery'
  | 'minimal_group_recovery'
  | 'near_complete_group_recovery'
  | 'missing_group_rest_fallback'
  | 'group_rpe_drift_applied'
  | 'observed_segment_rpe_preserved'
  | 'segment_specific_rpe_preserved'
  | 'group_initial_depletion'
  | 'grouped_central_cost_tail_applied';

export interface SetGroupSegmentInput {
  id: string | null;
  set: SetAdaptationInput;
  /** Rest immediately before this segment. Ignored for the first segment. */
  restBeforeSeconds: number | null;
  effortSource: SegmentEffortSource | null;
}

export interface SetGroupAdaptationInput {
  structure: SetGroupStructure;
  segments: readonly SetGroupSegmentInput[];
  /** Depletion entering the group from earlier work, before segment one. */
  initialCarriedDepletion: number | null;
  /** Optional 0–100 readiness score used only to select the existing drift rate. */
  readinessScore: number | null;
}

export interface SetGroupRecoveryTraceEntry {
  segmentIndex: number;
  restBeforeSeconds: number | null;
  usedMissingRestFallback: boolean;
  accumulatedDepletionBeforeRecovery: number;
  retainedFraction: number;
  recoveredDepletion: number;
  carriedDepletion: number;
  nominalRpe: number;
  realizedRpe: number;
  rpeDrift: number;
  localCostWeight: 1;
  lastingCentralCostWeight: number;
}

export interface SetGroupSegmentResult {
  id: string | null;
  segmentIndex: number;
  effortSource: SegmentEffortSource;
  nominalInput: SetAdaptationInput;
  realizedInput: SetAdaptationInput;
  adaptation: SetAdaptationResult;
  /** Cost contribution after the existing compound-set central-tail rule. */
  creditedCostVector: TrainingCostVector;
}

export interface SetGroupConfidence {
  /** Lowest segment score: the group is only as inspectable as its weakest link. */
  score: number;
  band: ModelConfidence['band'];
  evidenceLevels: ModelConfidence['evidenceLevel'][];
  missingInputs: string[];
  estimatedInputs: string[];
}

export interface SetGroupAdaptationResult {
  modelVersion: typeof SET_GROUP_ADAPTATION_MODEL_VERSION;
  dependencyVersions: typeof SET_GROUP_ADAPTATION_CONFIG.dependencies;
  structure: SetGroupStructure;
  segmentResults: SetGroupSegmentResult[];
  groupAdaptationVector: EffectiveSetVector;
  groupCostVector: TrainingCostVector;
  nativeDose: NativeAdaptationDose;
  /** Sum of segment compatibility scalars; no session saturation is applied. */
  compatibilityEffectiveSets: number;
  recoveryTrace: SetGroupRecoveryTraceEntry[];
  confidence: SetGroupConfidence;
  explanationCodes: Array<
    SetAdaptationReasonCode | SetGroupAdaptationReasonCode
  >;
}

export const SET_GROUP_ADAPTATION_CONFIG = {
  version: SET_GROUP_ADAPTATION_MODEL_VERSION,
  dependencies: {
    setAdaptation: EFFECTIVE_SET_MODEL_CONFIG.version,
    fatigueCost: FATIGUE_COST_MODEL_VERSION,
    accruedFatigue: ACCRUED_FATIGUE_MODEL_VERSION,
    recovery: PARTIAL_GROUP_RECOVERY_MODEL_VERSION,
  },
  recovery: {
    depletionPerCompletedSegment:
      GROUP_RECOVERY_CONFIG.depletionPerCompletedSegment,
    fullRecoverySeconds: GROUP_RECOVERY_CONFIG.fullRecoverySeconds,
    maximumCarriedDepletion:
      GROUP_RECOVERY_CONFIG.maximumCarriedDepletion,
    missingRestRetainedFraction:
      GROUP_RECOVERY_CONFIG.missingRestRetainedFraction,
  },
  effortDrift: {
    baselineReadinessDrift: HEURISTIC_DRIFT_PER_SET,
    maximumRpe: 10,
    minimumRpe: 1,
  },
  explanations: {
    minimalRecoveryRetainedFraction: 0.90,
    nearCompleteRecoveryRetainedFraction: 0.10,
  },
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function emptyVector(): EffectiveSetVector {
  return {
    hypertrophy: 0,
    strength: 0,
    power: 0,
    localEndurance: 0,
  };
}

function emptyCost(): TrainingCostVector {
  return {
    localMuscular: 0,
    lastingCentral: 0,
  };
}

function emptyNativeDose(): NativeAdaptationDose {
  return {
    unsaturatedHighForceDose: 0,
    saturatedHighForceDose: 0,
    strengthProjectionDose: 0,
    qualityWeightedStrengthReps: 0,
    saturatedStrengthRepExposure: 0,
    strengthPracticeReps: 0,
    highVelocity: 0,
    unsaturatedPowerDose: 0,
    saturatedPowerDose: 0,
    qualityWeightedPowerReps: 0,
    saturatedPowerRepExposure: 0,
    localEnduranceMinutes: 0,
  };
}

function addVector(
  total: EffectiveSetVector,
  value: EffectiveSetVector,
): void {
  total.hypertrophy += value.hypertrophy;
  total.strength += value.strength;
  total.power += value.power;
  total.localEndurance += value.localEndurance;
}

function addNativeDose(
  total: NativeAdaptationDose,
  value: NativeAdaptationDose,
): void {
  total.unsaturatedHighForceDose += value.unsaturatedHighForceDose;
  total.saturatedHighForceDose += value.saturatedHighForceDose;
  total.strengthProjectionDose += value.strengthProjectionDose;
  total.qualityWeightedStrengthReps += value.qualityWeightedStrengthReps;
  total.saturatedStrengthRepExposure +=
    value.saturatedStrengthRepExposure;
  total.strengthPracticeReps += value.strengthPracticeReps;
  total.highVelocity += value.highVelocity;
  total.unsaturatedPowerDose += value.unsaturatedPowerDose;
  total.saturatedPowerDose += value.saturatedPowerDose;
  total.qualityWeightedPowerReps += value.qualityWeightedPowerReps;
  total.saturatedPowerRepExposure += value.saturatedPowerRepExposure;
  total.localEnduranceMinutes += value.localEnduranceMinutes;
}

function confidenceBand(score: number): ModelConfidence['band'] {
  const p = EFFECTIVE_SET_MODEL_CONFIG.confidence;
  if (score >= p.highThreshold) return 'high';
  if (score >= p.mediumThreshold) return 'medium';
  return 'low';
}

function readinessDriftScale(readinessScore: number | null): number {
  if (readinessScore == null || !Number.isFinite(readinessScore)) return 1;

  return readinessAdjustedDrift(clamp(readinessScore, 0, 100))
    / SET_GROUP_ADAPTATION_CONFIG.effortDrift.baselineReadinessDrift;
}

function centralCostWeight(
  structure: SetGroupStructure,
  segmentIndex: number,
): number {
  if (segmentIndex === 0) return 1;

  return structure === 'wave' || structure === 'tapered'
    ? 1
    : COST_PARAMS.NEURAL_TAIL_WEIGHT;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function composeSetGroupAdaptation(
  input: SetGroupAdaptationInput,
): SetGroupAdaptationResult {
  const groupAdaptationVector = emptyVector();
  const groupCostVector = emptyCost();
  const nativeDose = emptyNativeDose();
  const segmentResults: SetGroupSegmentResult[] = [];
  const recoveryTrace: SetGroupRecoveryTraceEntry[] = [];
  const reasons: Array<
    SetAdaptationReasonCode | SetGroupAdaptationReasonCode
  > = [];
  const initialDepletion = clamp(
    Number.isFinite(input.initialCarriedDepletion)
      ? must(input.initialCarriedDepletion, 'input.initialCarriedDepletion')
      : 0,
    0,
    SET_GROUP_ADAPTATION_CONFIG.recovery.maximumCarriedDepletion,
  );
  const readinessScale = readinessDriftScale(input.readinessScore);
  const priorDriftRates: number[] = [];
  let compatibilityEffectiveSets = 0;

  if (initialDepletion > 0) reasons.push('group_initial_depletion');

  for (let index = 0; index < input.segments.length; index++) {
    const segment = must(input.segments[index], 'input.segments[index]');
    const effortSource = segment.effortSource ?? 'group_baseline';
    const accumulatedBeforeRecovery = clamp(
      initialDepletion
        + index
          * SET_GROUP_ADAPTATION_CONFIG.recovery
            .depletionPerCompletedSegment,
      0,
      SET_GROUP_ADAPTATION_CONFIG.recovery.maximumCarriedDepletion,
    );
    const recovery = index === 0
      ? {
        modelVersion: PARTIAL_GROUP_RECOVERY_MODEL_VERSION,
        accumulatedDepletion: accumulatedBeforeRecovery,
        restSeconds: null,
        usedMissingRestFallback: false,
        retainedFraction: initialDepletion > 0 ? 1 : 0,
        recoveredDepletion: 0,
        carriedDepletion: initialDepletion,
      } satisfies PartialGroupRecoveryResult
      : recoverGroupDepletion({
        accumulatedDepletion: accumulatedBeforeRecovery,
        restSeconds: segment.restBeforeSeconds ?? null,
      });
    const meanPriorDrift = priorDriftRates.length > 0
      ? priorDriftRates.reduce((sum, value) => sum + value, 0)
        / priorDriftRates.length
      : 0;
    const retainedSegmentEquivalents =
      recovery.carriedDepletion
      / SET_GROUP_ADAPTATION_CONFIG.recovery
        .depletionPerCompletedSegment;
    const rpeDrift = effortSource === 'group_baseline'
      ? meanPriorDrift * retainedSegmentEquivalents * readinessScale
      : 0;
    const nominalRpe = Number.isFinite(segment.set.rpe)
      ? segment.set.rpe
      : 7.5;
    const realizedRpe = clamp(
      nominalRpe + rpeDrift,
      SET_GROUP_ADAPTATION_CONFIG.effortDrift.minimumRpe,
      SET_GROUP_ADAPTATION_CONFIG.effortDrift.maximumRpe,
    );
    const realizedInput: SetAdaptationInput = {
      ...segment.set,
      rpe: realizedRpe,
      carriedDepletion: recovery.carriedDepletion,
    };
    const adaptation = computeSetAdaptation(realizedInput);
    const lastingCentralCostWeight = centralCostWeight(
      input.structure,
      index,
    );
    const creditedCostVector: TrainingCostVector = {
      localMuscular: adaptation.costVector.localMuscular,
      lastingCentral:
        adaptation.costVector.lastingCentral
        * lastingCentralCostWeight,
    };

    addVector(groupAdaptationVector, adaptation.effectiveSetVector);
    addNativeDose(nativeDose, adaptation.nativeDose);
    groupCostVector.localMuscular += creditedCostVector.localMuscular;
    groupCostVector.lastingCentral +=
      creditedCostVector.lastingCentral;
    compatibilityEffectiveSets +=
      adaptation.compatibilityEffectiveSets;
    reasons.push(...adaptation.explanationCodes);

    if (index > 0) {
      if (recovery.usedMissingRestFallback) {
        reasons.push('missing_group_rest_fallback');
      }
      if (recovery.retainedFraction > 0 && recovery.retainedFraction < 1) {
        reasons.push('partial_group_recovery');
        if (input.structure === 'cluster') {
          reasons.push('partial_cluster_recovery');
        }
      }
      if (
        recovery.retainedFraction
          >= SET_GROUP_ADAPTATION_CONFIG.explanations
            .minimalRecoveryRetainedFraction
      ) {
        reasons.push('minimal_group_recovery');
      }
      if (
        recovery.retainedFraction
          <= SET_GROUP_ADAPTATION_CONFIG.explanations
            .nearCompleteRecoveryRetainedFraction
      ) {
        reasons.push('near_complete_group_recovery');
      }
    }
    if (rpeDrift > 0) reasons.push('group_rpe_drift_applied');
    if (effortSource === 'observed') {
      reasons.push('observed_segment_rpe_preserved');
    }
    if (effortSource === 'segment_specific') {
      reasons.push('segment_specific_rpe_preserved');
    }
    if (lastingCentralCostWeight < 1) {
      reasons.push('grouped_central_cost_tail_applied');
    }

    segmentResults.push({
      id: segment.id ?? null,
      segmentIndex: index,
      effortSource,
      nominalInput: segment.set,
      realizedInput,
      adaptation,
      creditedCostVector,
    });
    recoveryTrace.push({
      segmentIndex: index,
      restBeforeSeconds: recovery.restSeconds,
      usedMissingRestFallback: recovery.usedMissingRestFallback,
      accumulatedDepletionBeforeRecovery: accumulatedBeforeRecovery,
      retainedFraction: recovery.retainedFraction,
      recoveredDepletion: recovery.recoveredDepletion,
      carriedDepletion: recovery.carriedDepletion,
      nominalRpe,
      realizedRpe,
      rpeDrift,
      localCostWeight: 1,
      lastingCentralCostWeight,
    });
    priorDriftRates.push(driftRateForReps(segment.set.reps));
  }

  const confidenceScores = segmentResults.map(
    segment => segment.adaptation.confidence.score,
  );
  const confidenceScore = confidenceScores.length > 0
    ? Math.min(...confidenceScores)
    : 0;
  const missingInputs = segmentResults.flatMap(
    segment => segment.adaptation.confidence.missingInputs,
  );
  if (recoveryTrace.some(trace => trace.usedMissingRestFallback)) {
    missingInputs.push('intraGroupRestSeconds');
  }

  return {
    modelVersion: SET_GROUP_ADAPTATION_MODEL_VERSION,
    dependencyVersions: SET_GROUP_ADAPTATION_CONFIG.dependencies,
    structure: input.structure,
    segmentResults,
    groupAdaptationVector,
    groupCostVector,
    nativeDose,
    compatibilityEffectiveSets,
    recoveryTrace,
    confidence: {
      score: confidenceScore,
      band: confidenceBand(confidenceScore),
      evidenceLevels: segmentResults.map(
        segment => segment.adaptation.confidence.evidenceLevel,
      ),
      missingInputs: unique(missingInputs),
      estimatedInputs: unique(
        segmentResults.flatMap(
          segment => segment.adaptation.confidence.estimatedInputs,
        ),
      ),
    },
    explanationCodes: unique(reasons),
  };
}
