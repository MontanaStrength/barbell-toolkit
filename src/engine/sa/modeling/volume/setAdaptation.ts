import { must } from '../../utils/must';
// Set adaptation model — one sensor-optional read of a working set.
//
// Ordinary production inputs are the default: exercise class, %e1RM, reps,
// RPE/RIR-derived effort, and set structure. Standard concentric repetitions
// assume the athlete intends to accelerate as forcefully as sound technique
// allows. Force-equivalent intensity (FEI) is therefore a latent population
// estimate unless an explicitly reliable observation is supplied. Evidence
// quality changes uncertainty and confidence; it never multiplies the estimated
// stimulus down merely because no sensor exists.
//
// The calculation order is:
//
//   set mechanics -> primitive stimulus signature -> adaptation vector + cost
//
// Hypertrophy and both cost channels delegate to the existing live pricers.
// Their numerical behavior is a compatibility contract. Strength, power, and
// local endurance are versioned heuristic projections from the signature.

import {
  EFFECTIVE_VOLUME_MODEL_VERSION,
  effectiveSetCredit,
  lowLoadGate,
  rFatigue,
  type EffectiveSetInput,
} from './effectiveVolume';
import {
  calibratedCentralFatigueCost,
  calibratedPeripheralCost,
  COST_REFERENCE_LOAD,
  FATIGUE_COST_MODEL_VERSION,
  type PeripheralOpts,
  terminalRir,
} from './fatigueCost';
import {
  freshEI,
  RECRUITMENT_CURVES,
  RECRUITMENT_CURVE_MODEL_VERSION,
  tLoad,
  type RecruitmentLiftClass,
} from './recruitmentCurve';
import {
  LOAD_CURVE_MODEL_VERSION,
  maxRepsAtIntensity,
} from '../strength/loadCurve';
import {
  BENEFIT_VECTOR_MODEL_VERSION,
  BENEFIT_VECTOR_PARAMS,
  localEnduranceUnits,
  strengthPracticeUnits,
} from './benefitVector';
import {
  meanWithinSetQuality,
  setRepCapacity,
  WITHIN_SET_QUALITY_CONFIG,
  WITHIN_SET_QUALITY_MODEL_VERSION,
} from './withinSetQuality';
import type { PowerExerciseCategory } from '../../types';
import {
  computePowerDose,
  POWER_ADAPTATION_CONFIG,
  POWER_ADAPTATION_MODEL_VERSION,
  type PowerAdaptationReasonCode,
  type SetExecutionPrescription,
} from './powerAdaptation';

export type { SetExecutionPrescription } from './powerAdaptation';

export type SetEvidenceLevel =
  | 'load_reps_only'
  | 'load_reps_rpe'
  | 'rep_level_performance'
  | 'velocity_data'
  | 'direct_force_data';

export type IntensityEvidenceSource =
  | 'load_and_e1rm'
  | 'prescribed_percentage'
  | 'estimated_from_reps_rpe';

export type SensorSmoothingMethod =
  | 'none'
  | 'rolling_average_peak'
  | 'percentile_force'
  | 'propulsive_force'
  | 'early_propulsive_impulse';

/**
 * One optional observation. `reliability` is required because the model must
 * not assume a sensor value deserves more weight than the population prior.
 * It is an explicit caller judgment in [0, 1], not a value inferred here.
 */
export interface MechanicalObservation {
  value: number;
  reliability: number;
  /** Observation uncertainty in the same fractional unit as `value`. */
  uncertainty: number | null;
  /** Optional upstream sensor-quality read. Metadata only in model v1. */
  sensorQuality: number | null;
  /** Optional upstream smoothing description. Metadata only in model v1. */
  smoothing: SensorSmoothingMethod | null;
}

export interface SetMechanicsEvidence {
  level: SetEvidenceLevel | null;
  intensitySource: IntensityEvidenceSource | null;
  /**
   * Sensitivity/calibration seam for the population FEI prior. This widens the
   * plausible range and lowers route certainty; it does not move the mean.
   */
  estimatedFeiUncertainty: number | null;
  /** Peak external force / gravitational force of estimated 1RM, as a fraction. */
  measuredForceEquivalentIntensity: MechanicalObservation | null;
  /** Current-rep/reference-rep force, as a fraction. */
  forceRetention: MechanicalObservation | null;
  /** Reference-relative velocity loss, as a fraction in [0, 1]. */
  velocityLoss: MechanicalObservation | null;
  /** Realized/reference concentric velocity ratio. One matches the prior. */
  realizedVelocityRatio: MechanicalObservation | null;
}

export interface SetAdaptationInput extends EffectiveSetInput {
  /** Population force-curve class for the exercise, independent of data quality. */
  liftClass: RecruitmentLiftClass | null;
  /**
   * False when intensity itself was inferred from reps/RPE. The inferred prior
   * cannot open the force route by itself, but a reliability-weighted direct
   * FEI observation may. Legacy hypertrophy/cost pricing remains gated.
   */
  forceRouteEligible: boolean | null;
  /**
   * Explicit non-standard execution method. Missing means the standard
   * concentric invariant. This categorical prescription does not alter FEI
   * and does not assert that its target output was realized.
   */
  executionPrescription: SetExecutionPrescription | null;
  /** Exercise-side power mechanics. Defaults conservatively for direct callers. */
  powerExerciseCategory: PowerExerciseCategory | null;
  /** Similarity to the target movement in [0, 1]. Defaults to exact (1). */
  movementSpecificity: number | null;
  /** Short-rest fatigue carried into a grouped continuation set. */
  carriedDepletion: number | null;
  evidence: SetMechanicsEvidence | null;
}

export interface LatentEstimate {
  /** Central modeled estimate. */
  value: number;
  /** Heuristic spread, not a statistically validated standard deviation. */
  uncertainty: number;
  /** Heuristic plausible range used to inspect route stability. */
  plausibleLow: number;
  plausibleHigh: number;
}

export interface SetMechanics {
  /** Load / e1RM on the 0–100 scale; `intensitySource` records its provenance. */
  externalIntensityPct: number;
  intensitySource: IntensityEvidenceSource;
  /**
   * Population force-load estimate before any optional observation, expressed
   * as peak external force / gravitational force of e1RM.
   */
  estimatedForceEquivalentIntensityFraction: LatentEstimate | null;
  /** Sanitized optional observation, retained separately from the estimate. */
  measuredForceEquivalentIntensityFraction: MechanicalObservation | null;
  /**
   * Population estimate after optional reliability-weighted refinement. Still
   * a modeled latent value, never relabeled as a measurement.
   */
  modeledForceEquivalentIntensityFraction: LatentEstimate | null;
  /** Sanitized optional force-retention observation. Missing remains null. */
  forceRetentionFraction: MechanicalObservation | null;
  /** Velocity-loss observation normalized to [0, 1]. Missing remains null. */
  velocityLossFraction: MechanicalObservation | null;
  /** Sanitized realized/reference velocity observation. Missing remains null. */
  realizedVelocityRatio: MechanicalObservation | null;
  /** Entering state used by strength quality before the first repetition. */
  strengthQualityEntryState: StrengthQualityEntryState;
  /** Capacity-consumption estimate. It is not force retention or velocity loss. */
  estimatedQualityRetention: number;
}

export interface StrengthQualityEntryState {
  /** Canonical population repetitions-to-failure estimate at the load. */
  freshRepCapacity: number;
  /** Repetitions performed plus terminal reserve in the realized set. */
  realizedRepCapacity: number;
  /** Recovered short-rest state explicitly supplied by group composition. */
  carriedDepletion: number;
  /** How strongly reported effort supports interpreting a capacity gap as fatigue. */
  excessEffortEvidenceWeight: number;
  /** Depletion implied when realized capacity is below the fresh load prior. */
  excessEffortDepletion: number;
  /** Greater source wins so the same fatigue state is not counted twice. */
  modeledDepletion: number;
}

export interface StimulusSignature {
  /** Bounded heuristic route score, not a literal recruitment probability. */
  forceRouteActivation: number;
  /** Plausible activation range induced by FEI uncertainty. */
  forceRouteActivationRange: {
    low: number;
    high: number;
  };
  /** Fatigue-route recruitment averaged across the set's reps. */
  fatigueRouteActivation: number;
  /** Combined recruitment via the stronger route, without double-counting. */
  totalRecruitment: number;
  /** Existing normalized R × T hypertrophy exposure. */
  meaningfulTensionExposure: number;
  /**
   * Dimensionless per-repetition high-force weighting. This contains no
   * accumulated repetitions, quality weighting, or movement specificity.
   */
  perRepHighForceCoefficient: number;
  /**
   * External-load specificity to maximal-strength expression, normalized to
   * the configured 85% reference. This is distinct from force recruitment.
   */
  strengthLoadSpecificity: number;
  /**
   * Modeled speed-load/quality exposure under an explicit explosive
   * prescription. This is not an observed or guaranteed bar velocity.
   */
  highVelocityExposure: number;
  /** Exercise mechanics category used by the power projection. */
  powerExerciseCategory: PowerExerciseCategory;
  /** Category and execution compatibility before set-state degradation. */
  powerSuitability: number;
  /** Estimated force-production component of the force-velocity trace. */
  estimatedPowerForceProduction: number;
  /** Estimated movement-velocity component of the force-velocity trace. */
  estimatedPowerVelocityPotential: number;
  /** Power-specific rep-quality retention, including carried depletion. */
  powerQualityRetention: number;
  /** Fraction of propulsive output retained after end-range braking. */
  powerBrakingRetention: number;
  /** Category prior for rapid force expression. */
  rapidForceExpression: number;
  /** Modeled output-quality retention; sensor-refined only when reliable. */
  qualityRetention: number;
  /** Target-movement similarity supplied by the caller. */
  movementSpecificity: number;
}

export interface EffectiveSetVector {
  /** Existing hard-set-equivalent hypertrophy credit. */
  hypertrophy: number;
  /** Rep-saturated strength-reference-set credit. */
  strength: number;
  /** Bounded power-equivalent set credit. */
  power: number;
  /** Bounded local-endurance-equivalent set credit. */
  localEndurance: number;
}

export interface TrainingCostVector {
  /** Existing calibrated peripheral/local cost points. */
  localMuscular: number;
  /** Existing calibrated lasting central-fatigue cost points. */
  lastingCentral: number;
}

export interface NativeAdaptationDose {
  /** Unsaturated high-force dose; preserves underlying exposure as reps rise. */
  unsaturatedHighForceDose: number;
  /** High-force dose after rep saturation, before specificity/normalization. */
  saturatedHighForceDose: number;
  /** Saturated dose after load and movement specificity, before normalization. */
  strengthProjectionDose: number;
  /** Unsaturated repetitions after the configured retained-quality weighting. */
  qualityWeightedStrengthReps: number;
  /** Smoothly saturated rep exposure used by the strength projection. */
  saturatedStrengthRepExposure: number;
  /** Existing heavy-specificity practice diagnostic, denominated in reps. */
  strengthPracticeReps: number;
  /** Unnormalized modeled power dose, not measured velocity or power. */
  highVelocity: number;
  /** Unsaturated primitive force-velocity dose across qualifying reps. */
  unsaturatedPowerDose: number;
  /** Power-owned rep-saturated primitive dose used for normalization. */
  saturatedPowerDose: number;
  /** Unsaturated repetitions after power-specific quality weighting. */
  qualityWeightedPowerReps: number;
  /** Smoothly saturated rep exposure used by the power projection. */
  saturatedPowerRepExposure: number;
  /** Existing rep-gated dense-work dose, denominated in minutes. */
  localEnduranceMinutes: number;
}

export type SetAdaptationReasonCode =
  | 'population_fei_estimate'
  | 'sensor_refined_fei_estimate'
  | 'force_retention_refined_quality'
  | 'velocity_loss_refined_quality'
  | 'low_reliability_force_observation'
  | 'low_reliability_velocity_observation'
  | 'force_curve_unavailable'
  | 'force_route_enabled_by_observation'
  | 'force_route_disabled_untrusted_intensity'
  | 'force_route_dominant'
  | 'fatigue_route_dominant'
  | 'mixed_recruitment_routes'
  | 'meaningful_tension_high'
  | 'per_rep_high_force_coefficient_high'
  | 'strength_load_specificity_below_reference'
  | 'strength_load_specificity_above_reference'
  | 'strength_quality_entering_depletion'
  | 'strength_quality_group_carry'
  | 'strength_quality_excess_effort_inferred'
  | 'high_velocity_exposure'
  | 'quality_degraded'
  | 'explosive_execution_not_prescribed'
  | 'movement_specificity_reduced'
  | 'force_retention_missing'
  | 'velocity_loss_missing'
  | 'realized_velocity_missing'
  | PowerAdaptationReasonCode;

export interface ModelConfidence {
  evidenceLevel: SetEvidenceLevel;
  /** Confidence in the available inputs, independent of route attribution. */
  evidenceConfidence: number;
  /** Stability of the force-route attribution across the plausible FEI range. */
  forceRouteCertainty: number;
  /** Combined inspectability score. It never scales the adaptation vector. */
  score: number;
  band: 'low' | 'medium' | 'high';
  /** Unavailable inputs/observations; sensor entries are optional, not required. */
  missingInputs: string[];
  estimatedInputs: string[];
}

export interface SetAdaptationResult {
  modelVersion: typeof EFFECTIVE_SET_MODEL_CONFIG.version;
  dependencyVersions: typeof EFFECTIVE_SET_MODEL_CONFIG.dependencies;
  mechanics: SetMechanics;
  stimulusSignature: StimulusSignature;
  effectiveSetVector: EffectiveSetVector;
  nativeDose: NativeAdaptationDose;
  costVector: TrainingCostVector;
  /** Exact compatibility field for every existing scalar consumer. */
  compatibilityEffectiveSets: number;
  confidence: ModelConfidence;
  explanationCodes: SetAdaptationReasonCode[];
}

export const EFFECTIVE_SET_MODEL_CONFIG = {
  /** Bump with any equation, coefficient, reference, or dependency change. */
  version: 'effective-set-vector-v1.5',
  dependencies: {
    effectiveVolume: EFFECTIVE_VOLUME_MODEL_VERSION,
    recruitmentCurve: RECRUITMENT_CURVE_MODEL_VERSION,
    loadCurve: LOAD_CURVE_MODEL_VERSION,
    fatigueCost: FATIGUE_COST_MODEL_VERSION,
    nativeBenefit: BENEFIT_VECTOR_MODEL_VERSION,
    powerAdaptation: POWER_ADAPTATION_MODEL_VERSION,
    withinSetQuality: WITHIN_SET_QUALITY_MODEL_VERSION,
  },
  forceRoute: {
    /**
     * Production invariant: standard concentric repetitions are modeled as
     * intending maximal safe acceleration. This is not an input, multiplier,
     * measurement, or uncertainty term.
     */
    standardConcentricExecution: 'maximal_safe_acceleration',
    /** Fixed physiological/model transition width around the FEI threshold. */
    transitionHalfWidth: 0.05,
    /** Default threshold when inspecting configuration; classed lifts override it. */
    defaultRecruitmentThreshold: 0.90,
    /**
     * Population-prior FEI spread. Rep-level/velocity/force evidence only
     * narrows this through an explicit observation and reliability; its label
     * alone is not treated as a better force estimate.
     */
    uncertaintyByEvidence: {
      load_reps_only: 0.10,
      load_reps_rpe: 0.08,
      rep_level_performance: 0.08,
      velocity_data: 0.08,
      direct_force_data: 0.08,
    } satisfies Record<SetEvidenceLevel, number>,
  },
  quality: {
    /**
     * Retained output is priced by consumed capacity, not absolute RIR.
     * Repetitions consume capacity within a segment; group carry or a
     * high-effort shortfall against the load prior may also consume capacity
     * before the segment begins.
     */
    version: WITHIN_SET_QUALITY_MODEL_VERSION,
    consumedExponent: WITHIN_SET_QUALITY_CONFIG.consumedExponent,
    enteringState: {
      version: 'strength-quality-entering-depletion-max-v1',
      /**
       * Group carry and load-capacity-implied excess effort describe the same
       * entering state. Use the greater estimate instead of adding them.
       */
      composition: 'maximum_not_sum',
      maximumDepletion: 0.999,
      /**
       * Low-RPE targets are often coarse floors rather than precise exertion
       * observations. Let excess effort identify entering fatigue smoothly
       * only as the set approaches a clearly informative hard effort.
       */
      excessEffortRpeGate: {
        noneAtOrBelow: 7,
        fullAtOrAbove: 9,
      },
      /**
       * A capacity mismatch can also reflect daily e1RM error or individual
       * rep-capacity variance, so only half is attributed to entering fatigue.
       */
      excessEffortDepletionScale: 0.5,
    },
  },
  strength: {
    highForceCoefficient: {
      version: 'strength-high-force-coefficient-v1',
      /**
       * Strength owns this seed. Its initial value preserves the reviewed
       * tension curve without coupling benefit to the fatigue-cost config.
       */
      tensionExponent: 1.5,
    },
    /**
     * A degraded high-force repetition still produces some strength-relevant
     * exposure. Quality scales that exposure; it does not erase it.
     */
    degradedQualityFloor: 0.35,
    repExposure: {
      version: 'strength-rep-exposure-exp-v1',
      /**
       * Exponential e-fold scale in quality-weighted repetitions. Every
       * additional rep adds exposure, with a marginal of exp(-x / scale).
       */
      saturationScaleQualityReps: 2,
    },
    loadSpecificity: {
      version: 'strength-load-specificity-relative-v1',
      /**
       * A coarse task-specificity prior. External load is normalized to the
       * configured strength reference before this exponent is applied.
       */
      exponent: 1,
      maximumModeledIntensityPct: 100,
    },
  },
  references: {
    strength: {
      liftClass: 'upper-press',
      reps: 3,
      intensityPct: 85,
      rpe: 7,
      description: 'Three exact-movement upper-press reps at 85% e1RM, terminal RIR 3, under the maximal-safe-acceleration concentric invariant, with zero entering depletion and retained quality.',
    },
    power: POWER_ADAPTATION_CONFIG.reference,
    localEndurance: {
      reps: 15,
      secondsPerRep: BENEFIT_VECTOR_PARAMS.END_SECONDS_PER_REP,
      maxCreditPerSet: 2,
      description: `One continuous 15-rep set at the modeled ${BENEFIT_VECTOR_PARAMS.END_SECONDS_PER_REP} seconds per rep (0.75 dense-work minutes).`,
    },
    cost: {
      pointsPerReferenceSet: COST_REFERENCE_LOAD,
      description: `Existing calibrated cost scale; each channel has its own ${COST_REFERENCE_LOAD}-point reference set.`,
    },
  },
  confidence: {
    evidenceBase: {
      load_reps_only: 0.45,
      load_reps_rpe: 0.60,
      rep_level_performance: 0.72,
      velocity_data: 0.78,
      direct_force_data: 0.80,
    } satisfies Record<SetEvidenceLevel, number>,
    routeWeightFloor: 0.75,
    mediumThreshold: 0.50,
    highThreshold: 0.72,
    lowReliabilityObservation: 0.40,
  },
  explanations: {
    dominantRouteMin: 0.15,
    highExposureMin: 0.65,
    degradedQualityMax: 0.60,
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

function boundedReferenceCredit(
  rawDose: number,
  referenceDose: number,
  maxCredit: number,
): number {
  if (rawDose <= 0 || referenceDose <= 0 || maxCredit <= 1) return 0;

  const scale = referenceDose / -Math.log(1 - 1 / maxCredit);
  return maxCredit * (1 - Math.exp(-rawDose / scale));
}

function observationOrNull(
  observation: MechanicalObservation | null,
  normalizeValue: (value: number) => number,
): MechanicalObservation | null {
  if (!observation || !Number.isFinite(observation.value)) return null;

  const uncertainty = observation.uncertainty != null
    && Number.isFinite(observation.uncertainty)
    ? Math.max(0, observation.uncertainty)
    : null;
  const sensorQuality = observation.sensorQuality != null
    && Number.isFinite(observation.sensorQuality)
    ? clamp01(observation.sensorQuality)
    : null;

  return {
    ...observation,
    value: normalizeValue(observation.value),
    reliability: Number.isFinite(observation.reliability)
      ? clamp01(observation.reliability)
      : 0,
    uncertainty,
    sensorQuality,
  };
}

function isUsableObservation(
  observation: MechanicalObservation | null,
): boolean {
  return observation != null && observation.reliability > 0;
}

function evidenceLevel(
  input: SetAdaptationInput,
  observations: {
    measuredFei: MechanicalObservation | null;
    forceRetention: MechanicalObservation | null;
    velocityLoss: MechanicalObservation | null;
    realizedVelocityRatio: MechanicalObservation | null;
  },
): SetEvidenceLevel {
  const declared = input.evidence?.level;
  if (
    declared === 'load_reps_only'
    || declared === 'load_reps_rpe'
    || declared === 'rep_level_performance'
  ) {
    return declared;
  }

  const hasForceEvidence =
    isUsableObservation(observations.measuredFei)
    || isUsableObservation(observations.forceRetention);
  const hasVelocityEvidence =
    isUsableObservation(observations.velocityLoss)
    || isUsableObservation(observations.realizedVelocityRatio);

  if (declared === 'direct_force_data') {
    if (hasForceEvidence) return 'direct_force_data';
    if (hasVelocityEvidence) return 'velocity_data';
    return 'load_reps_rpe';
  }
  if (declared === 'velocity_data') {
    if (hasVelocityEvidence) return 'velocity_data';
    return 'load_reps_rpe';
  }
  if (hasForceEvidence) return 'direct_force_data';
  if (hasVelocityEvidence) return 'velocity_data';
  return 'load_reps_rpe';
}

function latentEstimate(value: number, uncertainty: number): LatentEstimate {
  const spread = Math.max(0.001, uncertainty);

  return {
    value,
    uncertainty: spread,
    plausibleLow: Math.max(0, value - spread),
    plausibleHigh: Math.max(0, value + spread),
  };
}

function refineLatentEstimate(
  prior: LatentEstimate,
  observation: MechanicalObservation | null,
): LatentEstimate {
  if (!observation || observation.reliability <= 0) return prior;

  const weight = observation.reliability;
  const observedUncertainty = observation.uncertainty ?? prior.uncertainty;
  const value = prior.value * (1 - weight) + observation.value * weight;

  // Mixture variance preserves disagreement between the prior and observation.
  // A high-reliability but contradictory sensor read can widen, not blindly
  // narrow, the latent estimate.
  const delta = observation.value - prior.value;
  const variance =
    (1 - weight) * prior.uncertainty ** 2
    + weight * observedUncertainty ** 2
    + weight * (1 - weight) * delta ** 2;

  return latentEstimate(value, Math.sqrt(Math.max(0.000001, variance)));
}

function forceRouteActivationAt(
  forceEquivalentIntensity: number,
  threshold: number,
): number {
  const width = EFFECTIVE_SET_MODEL_CONFIG.forceRoute.transitionHalfWidth;
  return smoothstep(
    forceEquivalentIntensity,
    threshold - width,
    threshold + width,
  );
}

function populationFeiEstimate(
  intensityPct: number,
  liftClass: RecruitmentLiftClass,
): number {
  return freshEI(intensityPct, liftClass);
}

function strengthQualityEntryState(
  reps: number,
  intensityPct: number,
  rpe: number,
  carriedDepletion: number | null,
): StrengthQualityEntryState {
  if (reps <= 0) {
    return {
      freshRepCapacity: 0,
      realizedRepCapacity: 0,
      carriedDepletion: 0,
      excessEffortEvidenceWeight: 0,
      excessEffortDepletion: 0,
      modeledDepletion: 0,
    };
  }

  const maximumDepletion =
    EFFECTIVE_SET_MODEL_CONFIG.quality.enteringState.maximumDepletion;
  const carried = Number.isFinite(carriedDepletion)
    ? clamp(must(carriedDepletion, 'carriedDepletion'), 0, maximumDepletion)
    : 0;
  const modeledIntensity = clamp(intensityPct, 0, 100);
  const freshCapacity = Math.max(
    1,
    maxRepsAtIntensity(modeledIntensity),
  );
  const realizedCapacity = setRepCapacity(reps, terminalRir(rpe));
  const rawExcessEffort = clamp(
    1 - realizedCapacity / freshCapacity,
    0,
    maximumDepletion,
  );
  const rpeGate =
    EFFECTIVE_SET_MODEL_CONFIG.quality.enteringState.excessEffortRpeGate;
  const excessEffortEvidenceWeight = smoothstep(
    rpe,
    rpeGate.noneAtOrBelow,
    rpeGate.fullAtOrAbove,
  );
  const excessEffort =
    rawExcessEffort
    * excessEffortEvidenceWeight
    * EFFECTIVE_SET_MODEL_CONFIG.quality.enteringState
      .excessEffortDepletionScale;

  return {
    freshRepCapacity: freshCapacity,
    realizedRepCapacity: realizedCapacity,
    carriedDepletion: carried,
    excessEffortEvidenceWeight,
    excessEffortDepletion: excessEffort,
    modeledDepletion: Math.max(carried, excessEffort),
  };
}

function inferredQualityRetention(
  reps: number,
  rpe: number,
  enteringDepletion: number,
): number {
  return meanWithinSetQuality(
    reps,
    terminalRir(rpe),
    {
      enteringDepletion,
      consumedExponent:
        EFFECTIVE_SET_MODEL_CONFIG.quality.consumedExponent,
    },
  );
}

function refinedQualityRetention(
  estimated: number,
  forceRetention: MechanicalObservation | null,
  velocityLoss: MechanicalObservation | null,
): number {
  let value = estimated;

  if (forceRetention) {
    value = value * (1 - forceRetention.reliability)
      + clamp01(forceRetention.value) * forceRetention.reliability;
  }

  if (velocityLoss) {
    const retainedVelocity = 1 - clamp01(velocityLoss.value);
    value = value * (1 - velocityLoss.reliability)
      + retainedVelocity * velocityLoss.reliability;
  }

  return clamp01(value);
}

function perRepHighForceCoefficient(
  activation: number,
  intensityPct: number,
  liftClass: RecruitmentLiftClass | null,
): number {
  if (liftClass == null) return 0;

  const tension = Math.pow(
    tLoad(Math.min(100, Math.max(0, intensityPct)), liftClass),
    EFFECTIVE_SET_MODEL_CONFIG.strength.highForceCoefficient
      .tensionExponent,
  );

  return clamp01(activation * lowLoadGate(intensityPct) * tension);
}

function strengthLoadSpecificityAt(intensityPct: number): number {
  const config = EFFECTIVE_SET_MODEL_CONFIG.strength.loadSpecificity;
  const referenceIntensity =
    EFFECTIVE_SET_MODEL_CONFIG.references.strength.intensityPct;

  const modeledIntensity = clamp(
    intensityPct,
    0,
    config.maximumModeledIntensityPct,
  );

  return Math.pow(
    modeledIntensity / referenceIntensity,
    config.exponent,
  );
}

function qualityWeightedStrengthRepExposure(
  reps: number,
  quality: number,
): number {
  if (reps <= 0) return 0;

  const floor =
    EFFECTIVE_SET_MODEL_CONFIG.strength.degradedQualityFloor;
  const qualityWeight = floor + (1 - floor) * quality;

  return reps * qualityWeight;
}

function saturatedStrengthRepExposure(
  qualityWeightedReps: number,
  saturationScale: number,
): number {
  if (qualityWeightedReps <= 0) return 0;

  return saturationScale
    * (1 - Math.exp(-qualityWeightedReps / saturationScale));
}

function strengthRawDose(
  perRepCoefficient: number,
  saturatedRepExposure: number,
  loadSpecificity: number,
  specificity: number,
): number {
  return perRepCoefficient
    * saturatedRepExposure
    * loadSpecificity
    * specificity;
}

function referenceForceActivation(
  intensityPct: number,
  liftClass: RecruitmentLiftClass,
): number {
  const threshold = RECRUITMENT_CURVES[liftClass].recruitmentLine;
  return forceRouteActivationAt(
    populationFeiEstimate(intensityPct, liftClass),
    threshold,
  );
}

function strengthReferenceDose(): number {
  const ref = EFFECTIVE_SET_MODEL_CONFIG.references.strength;
  const activation = referenceForceActivation(
    ref.intensityPct,
    ref.liftClass,
  );
  const force = perRepHighForceCoefficient(
    activation,
    ref.intensityPct,
    ref.liftClass,
  );
  const quality = inferredQualityRetention(ref.reps, ref.rpe, 0);
  const qualityWeightedReps = qualityWeightedStrengthRepExposure(
    ref.reps,
    quality,
  );
  const saturatedRepExposure = saturatedStrengthRepExposure(
    qualityWeightedReps,
    EFFECTIVE_SET_MODEL_CONFIG.strength.repExposure
      .saturationScaleQualityReps,
  );
  const loadSpecificity = strengthLoadSpecificityAt(
    ref.intensityPct,
  );

  return strengthRawDose(
    force,
    saturatedRepExposure,
    loadSpecificity,
    1,
  );
}

function powerReferenceDose(): number {
  const ref = EFFECTIVE_SET_MODEL_CONFIG.references.power;
  const forceActivation = referenceForceActivation(
    ref.intensityPct,
    ref.liftClass,
  );
  const power = computePowerDose({
    carriedDepletion: null,
    forceRetention: null,
    velocityLoss: null,
    realizedVelocityRatio: null,
    reps: ref.reps,
    intensityPct: ref.intensityPct,
    rpe: ref.rpe,
    recruitmentByRep: recruitmentTrace(
      ref.reps,
      ref.rpe,
      ref.intensityPct,
      forceActivation,
    ),
    exerciseCategory: ref.exerciseCategory,
    executionPrescription: ref.executionPrescription,
    movementSpecificity: 1,
  });

  return power.saturatedDose;
}

function enduranceReferenceDose(): number {
  const ref = EFFECTIVE_SET_MODEL_CONFIG.references.localEndurance;
  return (ref.reps * ref.secondsPerRep) / 60;
}

export const STRENGTH_REFERENCE_DOSE = strengthReferenceDose();
export const POWER_REFERENCE_DOSE = powerReferenceDose();
const ENDURANCE_REFERENCE_DOSE = enduranceReferenceDose();

function averageFatigueRoute(
  reps: number,
  rpe: number,
  intensityPct: number,
): number {
  if (reps <= 0) return 0;

  const terminal = terminalRir(rpe);
  const loadGate = lowLoadGate(intensityPct);
  let total = 0;

  for (let i = 1; i <= reps; i++) {
    const rir = terminal + (reps - i);
    total += rFatigue(rir) * loadGate;
  }

  return total / reps;
}

function averageTotalRecruitment(
  reps: number,
  rpe: number,
  intensityPct: number,
  forceActivation: number,
): number {
  const trace = recruitmentTrace(
    reps,
    rpe,
    intensityPct,
    forceActivation,
  );
  if (trace.length === 0) return 0;

  return trace.reduce((total, value) => total + value, 0) / trace.length;
}

function recruitmentTrace(
  reps: number,
  rpe: number,
  intensityPct: number,
  forceActivation: number,
): number[] {
  if (reps <= 0) return [];

  const terminal = terminalRir(rpe);
  const loadGate = lowLoadGate(intensityPct);
  const force = forceActivation * loadGate;

  return Array.from({ length: reps }, (_, index) => {
    const rir = terminal + (reps - index - 1);
    const fatigue = rFatigue(rir) * loadGate;
    return Math.max(force, fatigue);
  });
}

function confidenceBand(score: number): ModelConfidence['band'] {
  const p = EFFECTIVE_SET_MODEL_CONFIG.confidence;
  if (score >= p.highThreshold) return 'high';
  if (score >= p.mediumThreshold) return 'medium';
  return 'low';
}

function uniqueReasons(
  reasons: SetAdaptationReasonCode[],
): SetAdaptationReasonCode[] {
  return [...new Set(reasons)];
}

export function computeSetAdaptation(
  input: SetAdaptationInput,
): SetAdaptationResult {
  const reps = Number.isFinite(input.reps) ? Math.max(0, Math.floor(input.reps)) : 0;
  const intensityPct = Number.isFinite(input.intensityPct)
    ? Math.max(0, input.intensityPct)
    : 0;
  const rpe = Number.isFinite(input.rpe) ? input.rpe : 7.5;
  const externalIntensityForceRouteEligible =
    input.forceRouteEligible ?? true;
  const specificity = input.movementSpecificity == null
    || !Number.isFinite(input.movementSpecificity)
    ? 1
    : clamp01(input.movementSpecificity);
  const intensitySource =
    input.evidence?.intensitySource ?? 'prescribed_percentage';
  const measuredFei = observationOrNull(
    input.evidence?.measuredForceEquivalentIntensity ?? null,
    value => Math.max(0, value),
  );
  const forceRetention = observationOrNull(
    input.evidence?.forceRetention ?? null,
    value => Math.max(0, value),
  );
  const velocityLoss = observationOrNull(
    input.evidence?.velocityLoss ?? null,
    clamp01,
  );
  const realizedVelocityRatio = observationOrNull(
    input.evidence?.realizedVelocityRatio ?? null,
    value => Math.max(0, value),
  );
  const level = evidenceLevel(input, {
    measuredFei,
    forceRetention,
    velocityLoss,
    realizedVelocityRatio,
  });
  const defaultUncertainty =
    EFFECTIVE_SET_MODEL_CONFIG.forceRoute.uncertaintyByEvidence[level];
  const suppliedUncertainty = input.evidence?.estimatedFeiUncertainty;
  const uncertainty = suppliedUncertainty == null
    || !Number.isFinite(suppliedUncertainty)
    ? defaultUncertainty
    : Math.max(0.001, suppliedUncertainty);

  const populationFei = input.liftClass != null && intensityPct > 0
    ? populationFeiEstimate(
      Math.min(100, intensityPct),
      input.liftClass,
    )
    : null;
  const priorFei = populationFei == null
    ? null
    : latentEstimate(populationFei, uncertainty);
  const modeledFei = priorFei
    ? refineLatentEstimate(priorFei, measuredFei)
    : null;

  const threshold = input.liftClass != null
    ? RECRUITMENT_CURVES[input.liftClass].recruitmentLine
    : EFFECTIVE_SET_MODEL_CONFIG.forceRoute.defaultRecruitmentThreshold;
  const observationRouteWeight = measuredFei?.reliability ?? 0;
  const forceRouteEvidenceWeight = externalIntensityForceRouteEligible
    ? 1
    : observationRouteWeight;
  const centralForceActivation = reps > 0
    && forceRouteEvidenceWeight > 0
    && modeledFei
    ? forceRouteActivationAt(modeledFei.value, threshold)
      * forceRouteEvidenceWeight
    : 0;
  const activationLow = reps > 0
    && forceRouteEvidenceWeight > 0
    && modeledFei
    ? forceRouteActivationAt(modeledFei.plausibleLow, threshold)
      * forceRouteEvidenceWeight
    : 0;
  const activationHigh = reps > 0
    && forceRouteEvidenceWeight > 0
    && modeledFei
    ? forceRouteActivationAt(modeledFei.plausibleHigh, threshold)
      * forceRouteEvidenceWeight
    : 0;

  const qualityEntryState = strengthQualityEntryState(
    reps,
    intensityPct,
    rpe,
    input.carriedDepletion,
  );
  const estimatedQuality = inferredQualityRetention(
    reps,
    rpe,
    qualityEntryState.modeledDepletion,
  );
  const quality = reps > 0
    ? refinedQualityRetention(
      estimatedQuality,
      forceRetention,
      velocityLoss,
    )
    : 0;
  const fatigueActivation = averageFatigueRoute(reps, rpe, intensityPct);
  const recruitmentByRep = recruitmentTrace(
    reps,
    rpe,
    intensityPct,
    centralForceActivation,
  );
  const totalRecruitment = averageTotalRecruitment(
    reps,
    rpe,
    intensityPct,
    centralForceActivation,
  );
  const highForceCoefficient = perRepHighForceCoefficient(
    centralForceActivation,
    intensityPct,
    input.liftClass,
  );
  const powerExerciseCategory = input.powerExerciseCategory
    ?? 'conventional_non_ballistic_compound';
  const powerDose = computePowerDose({
    reps,
    intensityPct,
    rpe,
    recruitmentByRep,
    exerciseCategory: powerExerciseCategory,
    executionPrescription: input.executionPrescription ?? null,
    movementSpecificity: specificity,
    carriedDepletion: input.carriedDepletion ?? null,
    forceRetention,
    velocityLoss,
    realizedVelocityRatio,
  });
  const estimatedVelocityExposure =
    clamp01(
      powerDose.estimatedVelocityPotential
      * powerDose.qualityRetention
      * powerDose.executionCompatibility,
    );

  const compatibilityLiftClass = externalIntensityForceRouteEligible
    ? input.liftClass
    : null;
  const set = { reps, intensityPct, rpe };
  const hypertrophy = effectiveSetCredit(set, compatibilityLiftClass);
  const localEnduranceMinutes = localEnduranceUnits(set);
  const qualityWeightedStrengthReps =
    qualityWeightedStrengthRepExposure(reps, quality);
  const strengthRepExposure = saturatedStrengthRepExposure(
    qualityWeightedStrengthReps,
    EFFECTIVE_SET_MODEL_CONFIG.strength.repExposure
      .saturationScaleQualityReps,
  );
  const unsaturatedHighForceDose =
    highForceCoefficient * qualityWeightedStrengthReps;
  const saturatedHighForceDose =
    highForceCoefficient * strengthRepExposure;
  const strengthLoadSpecificity =
    strengthLoadSpecificityAt(intensityPct);
  const strengthProjectionDose = strengthRawDose(
    highForceCoefficient,
    strengthRepExposure,
    strengthLoadSpecificity,
    specificity,
  );
  const strengthPracticeReps = strengthPracticeUnits(
    set,
    compatibilityLiftClass,
  );
  const rawPower = powerDose.saturatedDose;

  const strength = STRENGTH_REFERENCE_DOSE > 0
    ? strengthProjectionDose / STRENGTH_REFERENCE_DOSE
    : 0;
  const power = boundedReferenceCredit(
    rawPower,
    POWER_REFERENCE_DOSE,
    EFFECTIVE_SET_MODEL_CONFIG.references.power.maxCreditPerSet,
  );
  const localEndurance = boundedReferenceCredit(
    localEnduranceMinutes,
    ENDURANCE_REFERENCE_DOSE,
    EFFECTIVE_SET_MODEL_CONFIG.references.localEndurance.maxCreditPerSet,
  );

  const carriedDepletion = input.carriedDepletion;
  const peripheralOpts: PeripheralOpts = {
    carriedDepletion: carriedDepletion !== null && Number.isFinite(carriedDepletion) ? carriedDepletion : null,
  };
  const costVector: TrainingCostVector = {
    localMuscular: calibratedPeripheralCost(set, peripheralOpts),
    lastingCentral: calibratedCentralFatigueCost(
      set,
      compatibilityLiftClass,
    ),
  };

  const centralDecisionCertainty = Math.abs(2 * centralForceActivation - 1);
  const rangeAgreement = 1 - clamp01(activationHigh - activationLow);
  const routeCertainty = reps > 0
    && modeledFei
    && forceRouteEvidenceWeight > 0
    ? clamp01(
      centralDecisionCertainty
      * rangeAgreement
      * (externalIntensityForceRouteEligible ? 1 : observationRouteWeight),
    )
    : 0;
  let evidenceConfidence =
    EFFECTIVE_SET_MODEL_CONFIG.confidence.evidenceBase[level];
  const observations = [
    measuredFei,
    forceRetention,
    velocityLoss,
    realizedVelocityRatio,
  ]
    .filter((observation): observation is MechanicalObservation =>
      observation != null);
  for (const observation of observations) {
    evidenceConfidence = Math.min(
      evidenceConfidence,
      0.5 + 0.5 * observation.reliability,
    );
  }
  const routeWeight =
    EFFECTIVE_SET_MODEL_CONFIG.confidence.routeWeightFloor
    + (1 - EFFECTIVE_SET_MODEL_CONFIG.confidence.routeWeightFloor)
      * routeCertainty;
  const confidenceScore = clamp01(evidenceConfidence * routeWeight);

  const missingInputs: string[] = [];
  if (level === 'load_reps_only') missingInputs.push('rpe');
  if (!measuredFei) missingInputs.push('measuredForceEquivalentIntensity');
  if (!forceRetention) missingInputs.push('forceRetention');
  if (!velocityLoss) missingInputs.push('velocityLoss');
  if (!realizedVelocityRatio) missingInputs.push('realizedVelocityRatio');

  const estimatedInputs: string[] = [
    'fatigueRouteActivation',
    'strengthQualityEnteringDepletion',
    'qualityRetention',
    'powerForceProduction',
    'powerVelocityPotential',
    'powerQualityRetention',
  ];
  if (intensitySource === 'estimated_from_reps_rpe') {
    estimatedInputs.unshift('externalIntensity');
  }
  if (priorFei) estimatedInputs.unshift('forceEquivalentIntensity');

  const reasons: SetAdaptationReasonCode[] = [];
  if (priorFei) reasons.push('population_fei_estimate');
  if (priorFei && measuredFei && measuredFei.reliability > 0) {
    reasons.push('sensor_refined_fei_estimate');
  }
  if (reps > 0 && forceRetention && forceRetention.reliability > 0) {
    reasons.push('force_retention_refined_quality');
  }
  if (reps > 0 && velocityLoss && velocityLoss.reliability > 0) {
    reasons.push('velocity_loss_refined_quality');
  }
  if (
    measuredFei
    && measuredFei.reliability
      < EFFECTIVE_SET_MODEL_CONFIG.confidence.lowReliabilityObservation
  ) {
    reasons.push('low_reliability_force_observation');
  }
  if (
    [velocityLoss, realizedVelocityRatio].some(
      observation =>
        observation != null
        && observation.reliability
          < EFFECTIVE_SET_MODEL_CONFIG.confidence.lowReliabilityObservation,
    )
  ) {
    reasons.push('low_reliability_velocity_observation');
  }
  if (input.liftClass == null) reasons.push('force_curve_unavailable');
  if (
    !externalIntensityForceRouteEligible
    && observationRouteWeight > 0
    && modeledFei
    && activationHigh > 0
  ) {
    reasons.push('force_route_enabled_by_observation');
  }
  if (forceRouteEvidenceWeight <= 0) {
    reasons.push('force_route_disabled_untrusted_intensity');
  }

  if (reps > 0) {
    const routeGap =
      EFFECTIVE_SET_MODEL_CONFIG.explanations.dominantRouteMin;
    if (centralForceActivation >= fatigueActivation + routeGap) {
      reasons.push('force_route_dominant');
    } else if (fatigueActivation >= centralForceActivation + routeGap) {
      reasons.push('fatigue_route_dominant');
    } else {
      reasons.push('mixed_recruitment_routes');
    }
  }

  if (
    hypertrophy
      >= EFFECTIVE_SET_MODEL_CONFIG.explanations.highExposureMin
  ) {
    reasons.push('meaningful_tension_high');
  }
  if (
    highForceCoefficient
      >= EFFECTIVE_SET_MODEL_CONFIG.explanations.highExposureMin
  ) {
    reasons.push('per_rep_high_force_coefficient_high');
  }
  if (highForceCoefficient > 0 && strengthLoadSpecificity < 1) {
    reasons.push('strength_load_specificity_below_reference');
  }
  if (highForceCoefficient > 0 && strengthLoadSpecificity > 1) {
    reasons.push('strength_load_specificity_above_reference');
  }
  if (qualityEntryState.modeledDepletion > 0) {
    reasons.push('strength_quality_entering_depletion');
  }
  if (qualityEntryState.carriedDepletion > 0) {
    reasons.push('strength_quality_group_carry');
  }
  if (qualityEntryState.excessEffortDepletion > 0) {
    reasons.push('strength_quality_excess_effort_inferred');
  }
  if (
    estimatedVelocityExposure
      >= EFFECTIVE_SET_MODEL_CONFIG.explanations.highExposureMin
  ) {
    reasons.push('high_velocity_exposure');
  }
  if (
    reps > 0 &&
    quality
      <= EFFECTIVE_SET_MODEL_CONFIG.explanations.degradedQualityMax
  ) {
    reasons.push('quality_degraded');
  }
  reasons.push(...powerDose.explanationCodes);
  if (powerDose.executionCompatibility <= 0) {
    reasons.push('explosive_execution_not_prescribed');
  }
  if (specificity < 1) reasons.push('movement_specificity_reduced');
  if (!forceRetention) reasons.push('force_retention_missing');
  if (!velocityLoss) reasons.push('velocity_loss_missing');
  if (!realizedVelocityRatio) reasons.push('realized_velocity_missing');

  return {
    modelVersion: EFFECTIVE_SET_MODEL_CONFIG.version,
    dependencyVersions: EFFECTIVE_SET_MODEL_CONFIG.dependencies,
    mechanics: {
      externalIntensityPct: intensityPct,
      intensitySource,
      estimatedForceEquivalentIntensityFraction: priorFei,
      measuredForceEquivalentIntensityFraction: measuredFei,
      modeledForceEquivalentIntensityFraction: modeledFei,
      forceRetentionFraction: forceRetention,
      velocityLossFraction: velocityLoss,
      realizedVelocityRatio,
      strengthQualityEntryState: qualityEntryState,
      estimatedQualityRetention: estimatedQuality,
    },
    stimulusSignature: {
      forceRouteActivation: centralForceActivation,
      forceRouteActivationRange: {
        low: activationLow,
        high: activationHigh,
      },
      fatigueRouteActivation: fatigueActivation,
      totalRecruitment,
      meaningfulTensionExposure: hypertrophy,
      perRepHighForceCoefficient: highForceCoefficient,
      strengthLoadSpecificity,
      highVelocityExposure: estimatedVelocityExposure,
      powerExerciseCategory,
      powerSuitability: powerDose.suitability,
      estimatedPowerForceProduction:
        powerDose.estimatedForceProduction,
      estimatedPowerVelocityPotential:
        powerDose.estimatedVelocityPotential,
      powerQualityRetention: powerDose.qualityRetention,
      powerBrakingRetention: powerDose.brakingRetention,
      rapidForceExpression: powerDose.rapidForceExpression,
      qualityRetention: quality,
      movementSpecificity: specificity,
    },
    effectiveSetVector: {
      hypertrophy,
      strength,
      power,
      localEndurance,
    },
    nativeDose: {
      unsaturatedHighForceDose,
      saturatedHighForceDose,
      strengthProjectionDose,
      qualityWeightedStrengthReps,
      saturatedStrengthRepExposure: strengthRepExposure,
      strengthPracticeReps,
      highVelocity: powerDose.unsaturatedDose,
      unsaturatedPowerDose: powerDose.unsaturatedDose,
      saturatedPowerDose: powerDose.saturatedDose,
      qualityWeightedPowerReps: powerDose.qualityWeightedReps,
      saturatedPowerRepExposure: powerDose.saturatedRepExposure,
      localEnduranceMinutes,
    },
    costVector,
    compatibilityEffectiveSets: hypertrophy,
    confidence: {
      evidenceLevel: level,
      evidenceConfidence,
      forceRouteCertainty: routeCertainty,
      score: confidenceScore,
      band: confidenceBand(confidenceScore),
      missingInputs,
      estimatedInputs,
    },
    explanationCodes: uniqueReasons(reasons),
  };
}
