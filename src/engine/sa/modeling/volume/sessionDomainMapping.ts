/** Session domain mapping assigns modeled set and group adaptation to hypertrophy muscles, target strength movements, power zones and endurance tasks with explicit confidence and cost. */

import { getExerciseById } from '../../exercises/exerciseLibrary';
import { powerCategoryForExerciseId } from '../../exercises/powerSuitability';
import { BENEFIT_VECTOR_MODEL_VERSION, variantPracticeCredit } from './benefitVector';
import { EFFECTIVE_SET_MODEL_CONFIG, type EffectiveSetVector, type NativeAdaptationDose, type SetAdaptationResult, type SetExecutionPrescription, type TrainingCostVector } from './setAdaptation';
import type { SessionAdaptationEvent, SessionAdaptationEventSource, SessionDomainAllocation, SessionDomainAllocations, SessionEventConfidence } from './sessionAdaptation';
import type { SetGroupAdaptationResult } from './setGroupAdaptation';
import { SECONDARY_CREDIT } from '../../exercises/exerciseLibrary';

export const SESSION_ADAPTATION_DOMAIN_MODEL_VERSION =
  'session-adaptation-domains-v2' as const;

export type SessionPowerVelocityZone = 'high' | 'moderate' | 'low';

export type SessionEnduranceTaskZone =
  | 'brief'
  | 'sustained'
  | 'density';

export const SESSION_ADAPTATION_DOMAIN_CONFIG = {
  version: SESSION_ADAPTATION_DOMAIN_MODEL_VERSION,
  dependencies: {
    benefitVector: BENEFIT_VECTOR_MODEL_VERSION,
    setAdaptation: EFFECTIVE_SET_MODEL_CONFIG.version,
  },
  hypertrophy: {
    primaryMuscleAllocation: 1,
    secondaryMuscleAllocation: SECONDARY_CREDIT,
  },
  powerVelocityZones: {
    highMinimumPotential: 0.70,
    moderateMinimumPotential: 0.45,
  },
  enduranceTaskZones: {
    briefMaximumMinutes: 0.50,
  },
} as const;

export interface SessionEventMappingOptions {
  strengthTargetExerciseIds: readonly string[] | null;
  executionPrescription: SetExecutionPrescription | null;
  enduranceTaskZone: SessionEnduranceTaskZone | null;
  source: SessionAdaptationEventSource | null;
  costVectorOverride: TrainingCostVector | null;
  preSaturationVectorOverride: EffectiveSetVector | null;
  nativeDoseOverride: NativeAdaptationDose | null;
  extraExplanationCodes: readonly string[] | null;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function confidenceForSet(
  result: SetAdaptationResult,
): SessionEventConfidence {
  return {
    score: result.confidence.score,
    band: result.confidence.band,
    evidenceLevels: [result.confidence.evidenceLevel],
    missingInputs: [...result.confidence.missingInputs],
    estimatedInputs: [...result.confidence.estimatedInputs],
  };
}

export function muscleAllocations(
  exerciseId: string,
  keyForMuscle: (muscle: string) => string,
): SessionDomainAllocation[] {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) {
    return [{
      key: keyForMuscle(`exercise:${exerciseId}`),
      weight: 1,
    }];
  }

  return [
    ...exercise.primaryMuscles.map(muscle => ({
      key: keyForMuscle(muscle),
      weight:
        SESSION_ADAPTATION_DOMAIN_CONFIG.hypertrophy
          .primaryMuscleAllocation,
    })),
    ...exercise.secondaryMuscles.map(muscle => ({
      key: keyForMuscle(muscle),
      weight:
        SESSION_ADAPTATION_DOMAIN_CONFIG.hypertrophy
          .secondaryMuscleAllocation,
    })),
  ];
}

export function strengthAllocations(
  exerciseId: string,
  targets: readonly string[] | null,
): SessionDomainAllocation[] {
  const targetAllocations = unique(targets ?? [])
    .map(targetExerciseId => ({
      key: `strength:exercise:${targetExerciseId}`,
      weight: variantPracticeCredit(exerciseId, targetExerciseId),
    }))
    .filter(allocation => allocation.weight > 0);

  return targetAllocations.length > 0
    ? targetAllocations
    : [{ key: `strength:exercise:${exerciseId}`, weight: 1 }];
}

export function powerVelocityZone(
  estimatedVelocityPotential: number,
): SessionPowerVelocityZone {
  const p = SESSION_ADAPTATION_DOMAIN_CONFIG.powerVelocityZones;
  if (estimatedVelocityPotential >= p.highMinimumPotential) return 'high';
  if (
    estimatedVelocityPotential >= p.moderateMinimumPotential
  ) {
    return 'moderate';
  }
  return 'low';
}

export function inferredPowerExecution(
  exerciseId: string,
  prescribed: SetExecutionPrescription | null,
): string {
  if (prescribed != null) return prescribed;

  const category = powerCategoryForExerciseId(exerciseId);
  return category === 'ballistic'
    || category === 'olympic_lift_derivative'
    || category === 'jump_or_throw'
    ? 'intrinsic_ballistic'
    : 'standard_concentric';
}

export function defaultEnduranceTaskZone(
  result: SetAdaptationResult,
): SessionEnduranceTaskZone {
  return result.nativeDose.localEnduranceMinutes
      <= SESSION_ADAPTATION_DOMAIN_CONFIG.enduranceTaskZones
        .briefMaximumMinutes
    ? 'brief'
    : 'sustained';
}

export function domainAllocationsForSet(
  exerciseId: string,
  result: SetAdaptationResult,
  options: SessionEventMappingOptions,
): SessionDomainAllocations {
  const exercise = getExerciseById(exerciseId);
  const category = result.stimulusSignature.powerExerciseCategory;
  const velocityZone = powerVelocityZone(
    result.stimulusSignature.estimatedPowerVelocityPotential,
  );
  const execution = inferredPowerExecution(
    exerciseId,
    options.executionPrescription,
  );
  const enduranceZone =
    options.enduranceTaskZone ?? defaultEnduranceTaskZone(result);

  return {
    hypertrophy: muscleAllocations(
      exerciseId,
      muscle => `hypertrophy:muscle:${muscle}`,
    ),
    strength: strengthAllocations(
      exerciseId,
      options.strengthTargetExerciseIds,
    ),
    power: [{
      key: [
        'power',
        exercise?.movementPattern ?? `exercise:${exerciseId}`,
        category,
        execution,
        velocityZone,
      ].join(':'),
      weight: 1,
    }],
    localEndurance: muscleAllocations(
      exerciseId,
      muscle => `endurance:muscle:${muscle}:${enduranceZone}`,
    ),
  };
}

/** Map one reviewed set result into the session composer's neutral event seam. */
export function sessionEventForSetAdaptation(
  exerciseId: string,
  id: string,
  result: SetAdaptationResult,
  options: SessionEventMappingOptions,
): SessionAdaptationEvent {
  return {
    id,
    exerciseId,
    source: options.source ?? 'set',
    preSaturationVector:
      options.preSaturationVectorOverride
      ?? result.effectiveSetVector,
    nativeDose: options.nativeDoseOverride ?? result.nativeDose,
    costVector: options.costVectorOverride ?? result.costVector,
    domainAllocations: domainAllocationsForSet(
      exerciseId,
      result,
      options,
    ),
    confidence: confidenceForSet(result),
    explanationCodes: unique([
      ...result.explanationCodes,
      ...(options.extraExplanationCodes ?? []),
    ]),
  };
}

/** Flatten a composed group into realized, cost-correct session events. */
export function sessionEventsForSetGroup(
  exerciseId: string,
  group: SetGroupAdaptationResult,
  options: Omit<
    SessionEventMappingOptions,
    'source' | 'costVectorOverride'
  >,
): SessionAdaptationEvent[] {
  return group.segmentResults.map(segment => {
    const segmentExecution =
      segment.realizedInput.executionPrescription ?? options.executionPrescription;
    return sessionEventForSetAdaptation(
      exerciseId,
      segment.id ?? `segment-${segment.segmentIndex}`,
      segment.adaptation,
      {
        ...options,
        source: 'group_segment',
        executionPrescription: segmentExecution,
        costVectorOverride: segment.creditedCostVector,
        extraExplanationCodes: [
          ...group.explanationCodes,
          ...(options.extraExplanationCodes ?? []),
        ],
      },
    );
  });
}
