import { must } from '../../utils/must';
// Power-development projection for one set.
//
// The projection is deliberately sensor-optional. Exercise mechanics and the
// categorical execution prescription define the population prior; reliable
// observations refine the same force-velocity trace. No confidence term scales
// the dose, and no fatigue-cost coefficient is reused as a benefit coefficient.

import type { PowerExerciseCategory } from '../../types';

export const POWER_ADAPTATION_MODEL_VERSION = 'power-adaptation-v1' as const;

export type SetExecutionPrescription =
  | 'explosive_ballistic'
  | 'explosive_non_ballistic'
  | 'tempo_constrained';

export type PowerAdaptationReasonCode =
  | 'ballistic_power_qualified'
  | 'nonballistic_power_qualified'
  | 'nonballistic_braking_limit'
  | 'power_execution_incompatible'
  | 'power_execution_not_prescribed'
  | 'power_quality_degraded'
  | 'power_rep_dose_saturated'
  | 'carried_depletion_reduced_power'
  | 'realized_velocity_refined_power'
  | 'exercise_power_suitability_limited';

interface RefiningObservation {
  value: number;
  reliability: number;
}

interface PowerExerciseProfile {
  velocityPotential: number;
  brakingRetention: number;
  rapidForceExpression: number;
  intrinsicPowerExecution: boolean;
}

export interface PowerDoseInput {
  reps: number;
  intensityPct: number;
  rpe: number;
  recruitmentByRep: readonly number[];
  exerciseCategory: PowerExerciseCategory;
  executionPrescription: SetExecutionPrescription | null;
  movementSpecificity: number;
  carriedDepletion: number | null;
  forceRetention: RefiningObservation | null;
  velocityLoss: RefiningObservation | null;
  realizedVelocityRatio: RefiningObservation | null;
}

export interface PowerDoseResult {
  unsaturatedDose: number;
  saturatedDose: number;
  qualityWeightedReps: number;
  saturatedRepExposure: number;
  estimatedForceProduction: number;
  estimatedVelocityPotential: number;
  qualityRetention: number;
  suitability: number;
  brakingRetention: number;
  rapidForceExpression: number;
  executionCompatibility: number;
  explanationCodes: PowerAdaptationReasonCode[];
}

export const POWER_ADAPTATION_CONFIG = {
  version: POWER_ADAPTATION_MODEL_VERSION,
  forceVelocity: {
    /** External-load share of modeled concentric force expression. */
    externalLoadWeight: 0.8,
    /** Recruitment share of modeled concentric force expression. */
    recruitmentWeight: 0.2,
    /** Curvature of the population load-to-velocity prior. */
    velocityLoadExponent: 1.5,
    /** Fractional velocity-potential loss at a load fraction of one. */
    velocityLoadPenalty: 0.65,
    /** Plausible cap for a reliable reference-relative velocity observation. */
    maximumRealizedVelocityRatio: 1.25,
  },
  quality: {
    /** A rep at or below this RIR has no retained high-output quality. */
    rirNone: 1,
    /** A rep at or above this RIR has full RIR-derived output quality. */
    rirFull: 4,
    /**
     * Sensor-free within-set output-retention loss per preceding continuous
     * repetition. This is an interpretable population prior, not a velocity
     * measurement.
     */
    expectedLossPerPriorRep: 0.055,
    /** Lower bound for the sensor-free within-set retention prior. */
    minimumWithinSetRetention: 0.35,
    /** Fraction of carried local depletion expressed as lost power quality. */
    carriedDepletionWeight: 0.6,
  },
  repExposure: {
    version: 'power-rep-exposure-exp-v1',
    /**
     * Exponential e-fold scale in rep position. Every qualifying rep adds
     * non-negative dose, while the first few reps carry most adaptation value.
     */
    saturationScaleReps: 2.5,
  },
  profiles: {
    ballistic: {
      velocityPotential: 0.95,
      brakingRetention: 0.95,
      rapidForceExpression: 0.95,
      intrinsicPowerExecution: true,
    },
    olympic_lift_derivative: {
      velocityPotential: 0.88,
      brakingRetention: 0.90,
      rapidForceExpression: 1,
      intrinsicPowerExecution: true,
    },
    jump_or_throw: {
      velocityPotential: 1,
      brakingRetention: 1,
      rapidForceExpression: 1,
      intrinsicPowerExecution: true,
    },
    accommodating_resistance_explosive: {
      velocityPotential: 0.78,
      brakingRetention: 0.82,
      rapidForceExpression: 0.85,
      intrinsicPowerExecution: false,
    },
    conventional_non_ballistic_compound: {
      velocityPotential: 0.68,
      brakingRetention: 0.48,
      rapidForceExpression: 0.60,
      intrinsicPowerExecution: false,
    },
    isolation: {
      velocityPotential: 0.42,
      brakingRetention: 0.40,
      rapidForceExpression: 0.30,
      intrinsicPowerExecution: false,
    },
    tempo_or_constrained: {
      velocityPotential: 0.20,
      brakingRetention: 0.35,
      rapidForceExpression: 0.15,
      intrinsicPowerExecution: false,
    },
  } satisfies Record<PowerExerciseCategory, PowerExerciseProfile>,
  executionCompatibility: {
    explosive_ballistic: {
      ballistic: 1,
      olympic_lift_derivative: 0.95,
      jump_or_throw: 1,
      accommodating_resistance_explosive: 0.80,
      conventional_non_ballistic_compound: 0.45,
      isolation: 0.25,
      tempo_or_constrained: 0.05,
    },
    explosive_non_ballistic: {
      ballistic: 0.80,
      olympic_lift_derivative: 0.85,
      jump_or_throw: 0.80,
      accommodating_resistance_explosive: 1,
      conventional_non_ballistic_compound: 1,
      isolation: 0.50,
      tempo_or_constrained: 0.10,
    },
    tempo_constrained: {
      ballistic: 0.05,
      olympic_lift_derivative: 0.05,
      jump_or_throw: 0.05,
      accommodating_resistance_explosive: 0.05,
      conventional_non_ballistic_compound: 0.05,
      isolation: 0.05,
      tempo_or_constrained: 0.05,
    },
  } satisfies Record<
    SetExecutionPrescription,
    Record<PowerExerciseCategory, number>
  >,
  explanations: {
    degradedQualityMax: 0.60,
    meaningfulSaturationRatio: 0.90,
    limitedSuitabilityMax: 0.35,
    incompatibleExecutionMax: 0.50,
  },
  reference: {
    liftClass: 'upper-press',
    exerciseCategory: 'jump_or_throw',
    executionPrescription: 'explosive_ballistic',
    reps: 3,
    intensityPct: 55,
    rpe: 6,
    maxCreditPerSet: 1.5,
    description:
      'The saturated primitive force-velocity dose of three fresh, exact-movement ballistic upper-body throw repetitions at 55% e1RM and terminal RIR 4. The prescription remains the calibration anchor; the denominator is the reproducible accumulated primitive dose.',
  },
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const clamp01 = (value: number): number => clamp(value, 0, 1);

function smoothstep(value: number, low: number, high: number): number {
  if (value <= low) return 0;
  if (value >= high) return 1;

  const x = (value - low) / (high - low);
  return x * x * (3 - 2 * x);
}

function executionCompatibility(
  category: PowerExerciseCategory,
  prescription: SetExecutionPrescription | null,
): number {
  if (prescription != null) {
    return POWER_ADAPTATION_CONFIG.executionCompatibility[prescription][
      category
    ];
  }

  return POWER_ADAPTATION_CONFIG.profiles[category].intrinsicPowerExecution
    ? 1
    : 0;
}

function retainedObservation(
  prior: number,
  observation: RefiningObservation | null | undefined,
  observed: number,
): number {
  if (!observation || observation.reliability <= 0) return prior;

  return prior * (1 - observation.reliability)
    + observed * observation.reliability;
}

function uniqueReasons(
  reasons: PowerAdaptationReasonCode[],
): PowerAdaptationReasonCode[] {
  return [...new Set(reasons)];
}

export function computePowerDose(input: PowerDoseInput): PowerDoseResult {
  const reps = Math.max(0, Math.floor(input.reps));
  const loadFraction = clamp(input.intensityPct / 100, 0, 1);
  const specificity = clamp01(input.movementSpecificity);
  const profile = POWER_ADAPTATION_CONFIG.profiles[input.exerciseCategory];
  const compatibility = executionCompatibility(
    input.exerciseCategory,
    input.executionPrescription,
  );
  const suitability = profile.velocityPotential
    * profile.brakingRetention
    * profile.rapidForceExpression
    * compatibility;
  const carriedDepletion = Number.isFinite(input.carriedDepletion)
    ? clamp01(must(input.carriedDepletion, 'input.carriedDepletion'))
    : 0;
  const carriedRetention = 1
    - carriedDepletion
      * POWER_ADAPTATION_CONFIG.quality.carriedDepletionWeight;
  const baseVelocityPotential = clamp01(
    1
    - POWER_ADAPTATION_CONFIG.forceVelocity.velocityLoadPenalty
      * loadFraction
        ** POWER_ADAPTATION_CONFIG.forceVelocity.velocityLoadExponent,
  );
  const observedVelocityRatio = input.realizedVelocityRatio
    ? clamp(
      input.realizedVelocityRatio.value,
      0,
      POWER_ADAPTATION_CONFIG.forceVelocity.maximumRealizedVelocityRatio,
    )
    : 1;
  const velocityRatio = retainedObservation(
    1,
    input.realizedVelocityRatio,
    observedVelocityRatio,
  );
  const terminalRir = clamp(10 - input.rpe, 0, 9);

  let unsaturatedDose = 0;
  let saturatedDose = 0;
  let qualityWeightedReps = 0;
  let saturatedRepExposure = 0;
  let forceTotal = 0;
  let velocityTotal = 0;
  let qualityTotal = 0;

  for (let index = 0; index < reps; index++) {
    const rir = terminalRir + (reps - index - 1);
    const rirQuality = smoothstep(
      rir,
      POWER_ADAPTATION_CONFIG.quality.rirNone,
      POWER_ADAPTATION_CONFIG.quality.rirFull,
    );
    const expectedWithinSetRetention = Math.max(
      POWER_ADAPTATION_CONFIG.quality.minimumWithinSetRetention,
      1
      - index
        * POWER_ADAPTATION_CONFIG.quality.expectedLossPerPriorRep,
    );
    const progress = reps <= 1 ? 1 : index / (reps - 1);
    const observedVelocityRetention = input.velocityLoss
      ? 1 - clamp01(input.velocityLoss.value) * progress
      : expectedWithinSetRetention;
    const velocityRetention = retainedObservation(
      expectedWithinSetRetention,
      input.velocityLoss,
      observedVelocityRetention,
    );
    const observedForceRetention = input.forceRetention
      ? clamp01(input.forceRetention.value)
      : 1;
    const forceRetention = retainedObservation(
      1,
      input.forceRetention,
      1 - (1 - observedForceRetention) * progress,
    );
    const recruitment = clamp01(input.recruitmentByRep[index] ?? 0);
    const estimatedForce = clamp01(
      (
        POWER_ADAPTATION_CONFIG.forceVelocity.externalLoadWeight
          * loadFraction
        + POWER_ADAPTATION_CONFIG.forceVelocity.recruitmentWeight
          * recruitment
      )
      * forceRetention,
    );
    const estimatedVelocity = clamp(
      baseVelocityPotential
        * profile.velocityPotential
        * velocityRetention
        * velocityRatio,
      0,
      POWER_ADAPTATION_CONFIG.forceVelocity.maximumRealizedVelocityRatio,
    );
    const quality = rirQuality * carriedRetention;
    const primitiveDose = estimatedForce
      * estimatedVelocity
      * profile.brakingRetention
      * profile.rapidForceExpression
      * compatibility
      * specificity
      * quality;
    const marginalWeight = Math.exp(
      -index / POWER_ADAPTATION_CONFIG.repExposure.saturationScaleReps,
    );

    unsaturatedDose += primitiveDose;
    saturatedDose += primitiveDose * marginalWeight;
    qualityWeightedReps += quality * velocityRetention;
    saturatedRepExposure += quality * velocityRetention * marginalWeight;
    forceTotal += estimatedForce;
    velocityTotal += estimatedVelocity;
    qualityTotal += quality * velocityRetention;
  }

  const qualityRetention = reps > 0 ? qualityTotal / reps : 0;
  const reasons: PowerAdaptationReasonCode[] = [];
  if (compatibility <= 0) {
    reasons.push('power_execution_not_prescribed');
  } else if (
    compatibility
      <= POWER_ADAPTATION_CONFIG.explanations.incompatibleExecutionMax
  ) {
    reasons.push('power_execution_incompatible');
  }
  if (
    compatibility > 0
    && (
      input.exerciseCategory === 'ballistic'
      || input.exerciseCategory === 'jump_or_throw'
    )
  ) {
    reasons.push('ballistic_power_qualified');
  } else if (compatibility > 0) {
    reasons.push('nonballistic_power_qualified');
  }
  if (
    compatibility > 0
    && profile.brakingRetention < 1
    && input.exerciseCategory !== 'ballistic'
    && input.exerciseCategory !== 'jump_or_throw'
  ) {
    reasons.push('nonballistic_braking_limit');
  }
  if (
    reps > 0
    && qualityRetention
      <= POWER_ADAPTATION_CONFIG.explanations.degradedQualityMax
  ) {
    reasons.push('power_quality_degraded');
  }
  if (
    unsaturatedDose > 0
    && saturatedDose / unsaturatedDose
      <= POWER_ADAPTATION_CONFIG.explanations.meaningfulSaturationRatio
  ) {
    reasons.push('power_rep_dose_saturated');
  }
  if (carriedDepletion > 0) {
    reasons.push('carried_depletion_reduced_power');
  }
  if (
    input.realizedVelocityRatio
    && input.realizedVelocityRatio.reliability > 0
  ) {
    reasons.push('realized_velocity_refined_power');
  }
  if (
    compatibility > 0
    && suitability
      <= POWER_ADAPTATION_CONFIG.explanations.limitedSuitabilityMax
  ) {
    reasons.push('exercise_power_suitability_limited');
  }

  return {
    unsaturatedDose,
    saturatedDose,
    qualityWeightedReps,
    saturatedRepExposure,
    estimatedForceProduction: reps > 0 ? forceTotal / reps : 0,
    estimatedVelocityPotential: reps > 0 ? velocityTotal / reps : 0,
    qualityRetention,
    suitability,
    brakingRetention: profile.brakingRetention,
    rapidForceExpression: profile.rapidForceExpression,
    executionCompatibility: compatibility,
    explanationCodes: uniqueReasons(reasons),
  };
}
