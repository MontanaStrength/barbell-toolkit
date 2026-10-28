// Session adaptation composition — diminishing returns over realized set or
// group-segment results.
//
// Set adaptation remains the pricing primitive. This layer never re-estimates
// mechanics, applies fatigue, or changes cost. It only asks how much marginal
// session value a realized pre-session vector adds inside adaptation-specific
// domains (muscle, target movement, power zone, or endurance task).

import {
  EFFECTIVE_SET_MODEL_CONFIG,
  type EffectiveSetVector,
  type ModelConfidence,
  type NativeAdaptationDose,
  type TrainingCostVector,
} from './setAdaptation';
import {
  SET_GROUP_ADAPTATION_MODEL_VERSION,
} from './setGroupAdaptation';
import { assertNever } from '../../utils/assertNever';

export const SESSION_ADAPTATION_MODEL_VERSION =
  'session-adaptation-v1' as const;

export type AdaptationDimension = keyof EffectiveSetVector;

export type SessionOrderSource =
  | 'caller_sequence'
  | 'prescribed_plan_order'
  | 'observed_set_timestamps'
  | 'stored_order_fallback';

export type SessionAdaptationEventSource =
  | 'set'
  | 'group_segment'
  | 'density_estimate';

export type SessionAdaptationReasonCode =
  | 'session_hypertrophy_saturation'
  | 'session_strength_saturation'
  | 'session_power_saturation'
  | 'session_local_endurance_saturation'
  | 'low_marginal_strength_value'
  | 'low_marginal_power_value'
  | 'endurance_density_saturated'
  | 'caller_session_order'
  | 'observed_session_order'
  | 'prescribed_session_order'
  | 'stored_session_order_fallback';

export interface SessionDomainAllocation {
  /** Stable, inspectable identity inside one adaptation dimension. */
  key: string;
  /** Relative domain exposure. Non-positive and non-finite values are ignored. */
  weight: number;
}

export type SessionDomainAllocations = Record<
  AdaptationDimension,
  readonly SessionDomainAllocation[]
>;

export interface SessionEventConfidence {
  score: number;
  band: ModelConfidence['band'];
  evidenceLevels: ModelConfidence['evidenceLevel'][];
  missingInputs: string[];
  estimatedInputs: string[];
}

export interface SessionAdaptationEvent {
  id: string;
  exerciseId: string;
  source: SessionAdaptationEventSource;
  /** Realized normalized set vector before session diminishing returns. */
  preSaturationVector: EffectiveSetVector;
  /** Native diagnostic dose from the same realized set primitive. */
  nativeDose: NativeAdaptationDose;
  /** Existing cost contribution. Session value never scales this. */
  costVector: TrainingCostVector;
  domainAllocations: SessionDomainAllocations;
  confidence: SessionEventConfidence;
  explanationCodes: readonly string[];
}

export interface SessionDomainTraceEntry {
  key: string;
  allocationWeight: number;
  rawDoseBefore: number;
  rawDoseAdded: number;
  rawDoseAfter: number;
  creditedDoseBefore: number;
  marginalCredit: number;
  creditedDoseAfter: number;
  marginalRatio: number;
}

export type SessionEventDomainTrace = Record<
  AdaptationDimension,
  SessionDomainTraceEntry[]
>;

export interface SessionAdaptationEventResult {
  id: string;
  exerciseId: string;
  source: SessionAdaptationEventSource;
  preSaturationVector: EffectiveSetVector;
  marginalCreditedVector: EffectiveSetVector;
  marginalRatios: EffectiveSetVector;
  accumulatedPreSaturationVector: EffectiveSetVector;
  accumulatedCreditedVector: EffectiveSetVector;
  accumulatedCostVector: TrainingCostVector;
  domainTrace: SessionEventDomainTrace;
  explanationCodes: Array<string | SessionAdaptationReasonCode>;
}

export interface SessionDomainTotal {
  key: string;
  rawDose: number;
  creditedDose: number;
}

export type SessionDomainTotals = Record<
  AdaptationDimension,
  SessionDomainTotal[]
>;

export interface SessionAdaptationConfidence {
  /** Lowest event score. Confidence never scales any adaptation value. */
  score: number;
  band: ModelConfidence['band'];
  evidenceLevels: ModelConfidence['evidenceLevel'][];
  missingInputs: string[];
  estimatedInputs: string[];
}

export interface SessionAdaptationResult {
  modelVersion: typeof SESSION_ADAPTATION_MODEL_VERSION;
  dependencyVersions: typeof SESSION_ADAPTATION_CONFIG.dependencies & {
    domainAllocation: string;
  };
  orderSource: SessionOrderSource;
  eventResults: SessionAdaptationEventResult[];
  /** Sum of native diagnostic doses. No session value function alters it. */
  nativeDose: NativeAdaptationDose;
  /** Sum of realized set vectors before session diminishing returns. */
  preSaturationVector: EffectiveSetVector;
  /** Sum of marginal session credits in event order. */
  accumulatedAdaptationVector: EffectiveSetVector;
  /** Existing costs accumulated exactly once and independently of benefit. */
  accumulatedCostVector: TrainingCostVector;
  domainTotals: SessionDomainTotals;
  confidence: SessionAdaptationConfidence;
  explanationCodes: SessionAdaptationReasonCode[];
}

export interface ComposeSessionAdaptationInput {
  events: readonly SessionAdaptationEvent[];
  orderSource: SessionOrderSource | null;
  /** Version of the caller-owned exercise/domain classification. */
  domainModelVersion: string | null;
}

/**
 * Population-prior session-value seeds. These are deliberately coarse and
 * separately versioned by adaptation; they are not claims of exact biological
 * set thresholds.
 */
export const SESSION_ADAPTATION_CONFIG = {
  version: SESSION_ADAPTATION_MODEL_VERSION,
  dependencies: {
    setAdaptation: EFFECTIVE_SET_MODEL_CONFIG.version,
    setGroupAdaptation: SET_GROUP_ADAPTATION_MODEL_VERSION,
  },
  hypertrophy: {
    functionVersion: 'hypertrophy-shifted-log-v1',
    fullValueDose: 1,
    /** Positive, unbounded tail: high session volume still adds small value. */
    logarithmicScale: 4,
  },
  strength: {
    functionVersion: 'strength-shifted-exponential-v1',
    fullValueDose: 1,
    /** Specific high-force practice approaches three credited set units. */
    exponentialTailScale: 2,
  },
  power: {
    functionVersion: 'power-shifted-exponential-v1',
    fullValueDose: 1,
    /** High-quality power exposure saturates faster than strength practice. */
    exponentialTailScale: 1.25,
  },
  localEndurance: {
    functionVersion: 'endurance-shifted-hyperbolic-v1',
    fullValueDose: 1,
    /** Task-specific density approaches five credited set units. */
    hyperbolicTailScale: 4,
  },
  explanations: {
    saturationRatioMax: 0.999999,
    lowMarginalRatioMax: 0.25,
  },
} as const;

const DIMENSIONS: readonly AdaptationDimension[] = [
  'hypertrophy',
  'strength',
  'power',
  'localEndurance',
];

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

function emptyDomainTrace(): SessionEventDomainTrace {
  return {
    hypertrophy: [],
    strength: [],
    power: [],
    localEndurance: [],
  };
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function addVector(
  total: EffectiveSetVector,
  value: EffectiveSetVector,
): void {
  for (const dimension of DIMENSIONS) {
    total[dimension] += nonNegative(value[dimension]);
  }
}

function addNativeDose(
  total: NativeAdaptationDose,
  value: NativeAdaptationDose,
): void {
  total.unsaturatedHighForceDose +=
    nonNegative(value.unsaturatedHighForceDose);
  total.saturatedHighForceDose +=
    nonNegative(value.saturatedHighForceDose);
  total.strengthProjectionDose +=
    nonNegative(value.strengthProjectionDose);
  total.qualityWeightedStrengthReps +=
    nonNegative(value.qualityWeightedStrengthReps);
  total.saturatedStrengthRepExposure +=
    nonNegative(value.saturatedStrengthRepExposure);
  total.strengthPracticeReps +=
    nonNegative(value.strengthPracticeReps);
  total.highVelocity += nonNegative(value.highVelocity);
  total.unsaturatedPowerDose +=
    nonNegative(value.unsaturatedPowerDose);
  total.saturatedPowerDose +=
    nonNegative(value.saturatedPowerDose);
  total.qualityWeightedPowerReps +=
    nonNegative(value.qualityWeightedPowerReps);
  total.saturatedPowerRepExposure +=
    nonNegative(value.saturatedPowerRepExposure);
  total.localEnduranceMinutes +=
    nonNegative(value.localEnduranceMinutes);
}

function cloneVector(value: EffectiveSetVector): EffectiveSetVector {
  return {
    hypertrophy: value.hypertrophy,
    strength: value.strength,
    power: value.power,
    localEndurance: value.localEndurance,
  };
}

function cloneCost(value: TrainingCostVector): TrainingCostVector {
  return {
    localMuscular: value.localMuscular,
    lastingCentral: value.lastingCentral,
  };
}

function hypertrophySessionValue(rawDose: number): number {
  const p = SESSION_ADAPTATION_CONFIG.hypertrophy;
  const dose = nonNegative(rawDose);
  if (dose <= p.fullValueDose) return dose;

  const tail = dose - p.fullValueDose;
  return p.fullValueDose
    + p.logarithmicScale
      * Math.log1p(tail / p.logarithmicScale);
}

function shiftedExponentialValue(
  rawDose: number,
  fullValueDose: number,
  tailScale: number,
): number {
  const dose = nonNegative(rawDose);
  if (dose <= fullValueDose) return dose;

  const tail = dose - fullValueDose;
  return fullValueDose
    + tailScale * (1 - Math.exp(-tail / tailScale));
}

function strengthSessionValue(rawDose: number): number {
  const p = SESSION_ADAPTATION_CONFIG.strength;
  return shiftedExponentialValue(
    rawDose,
    p.fullValueDose,
    p.exponentialTailScale,
  );
}

function powerSessionValue(rawDose: number): number {
  const p = SESSION_ADAPTATION_CONFIG.power;
  return shiftedExponentialValue(
    rawDose,
    p.fullValueDose,
    p.exponentialTailScale,
  );
}

function enduranceSessionValue(rawDose: number): number {
  const p = SESSION_ADAPTATION_CONFIG.localEndurance;
  const dose = nonNegative(rawDose);
  if (dose <= p.fullValueDose) return dose;

  const tail = dose - p.fullValueDose;
  return p.fullValueDose
    + p.hyperbolicTailScale
      * tail / (p.hyperbolicTailScale + tail);
}

/** Credited session value at an accumulated raw dose in one domain. */
export function sessionAdaptationValue(
  dimension: AdaptationDimension,
  rawDose: number,
): number {
  switch (dimension) {
    case 'hypertrophy':
      return hypertrophySessionValue(rawDose);
    case 'strength':
      return strengthSessionValue(rawDose);
    case 'power':
      return powerSessionValue(rawDose);
    case 'localEndurance':
      return enduranceSessionValue(rawDose);
    default:
      return assertNever(dimension);
  }
}

function combinedAllocations(
  dimension: AdaptationDimension,
  allocations: readonly SessionDomainAllocation[],
): SessionDomainAllocation[] {
  const byKey = new Map<string, number>();
  for (const allocation of allocations) {
    const key = allocation.key.trim();
    const weight = nonNegative(allocation.weight);
    if (key === '' || weight <= 0) continue;
    byKey.set(key, (byKey.get(key) ?? 0) + weight);
  }

  if (byKey.size === 0) {
    return [{ key: `${dimension}:global`, weight: 1 }];
  }

  return [...byKey]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, weight]) => ({ key, weight }));
}

function dimensionReason(
  dimension: AdaptationDimension,
): SessionAdaptationReasonCode {
  switch (dimension) {
    case 'hypertrophy':
      return 'session_hypertrophy_saturation';
    case 'strength':
      return 'session_strength_saturation';
    case 'power':
      return 'session_power_saturation';
    case 'localEndurance':
      return 'session_local_endurance_saturation';
    default:
      return assertNever(dimension);
  }
}

function confidenceBand(score: number): ModelConfidence['band'] {
  const p = EFFECTIVE_SET_MODEL_CONFIG.confidence;
  if (score >= p.highThreshold) return 'high';
  if (score >= p.mediumThreshold) return 'medium';
  return 'low';
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function orderReason(
  source: SessionOrderSource,
): SessionAdaptationReasonCode {
  if (source === 'observed_set_timestamps') {
    return 'observed_session_order';
  }
  if (source === 'prescribed_plan_order') {
    return 'prescribed_session_order';
  }
  if (source === 'stored_order_fallback') {
    return 'stored_session_order_fallback';
  }
  return 'caller_session_order';
}

export function composeSessionAdaptation(
  input: ComposeSessionAdaptationInput,
): SessionAdaptationResult {
  const orderSource = input.orderSource ?? 'caller_sequence';
  const preSaturationVector = emptyVector();
  const accumulatedAdaptationVector = emptyVector();
  const accumulatedCostVector = emptyCost();
  const nativeDose = emptyNativeDose();
  const rawByDimension: Record<
    AdaptationDimension,
    Map<string, number>
  > = {
    hypertrophy: new Map(),
    strength: new Map(),
    power: new Map(),
    localEndurance: new Map(),
  };
  const eventResults: SessionAdaptationEventResult[] = [];
  const resultReasons: SessionAdaptationReasonCode[] = [
    orderReason(orderSource),
  ];

  for (const event of input.events) {
    const eventVector: EffectiveSetVector = {
      hypertrophy: nonNegative(event.preSaturationVector.hypertrophy),
      strength: nonNegative(event.preSaturationVector.strength),
      power: nonNegative(event.preSaturationVector.power),
      localEndurance:
        nonNegative(event.preSaturationVector.localEndurance),
    };
    const marginalCreditedVector = emptyVector();
    const marginalRatios = emptyVector();
    const domainTrace = emptyDomainTrace();
    const eventReasons: Array<string | SessionAdaptationReasonCode> = [
      ...event.explanationCodes,
    ];

    for (const dimension of DIMENSIONS) {
      const rawDose = eventVector[dimension];
      if (rawDose <= 0) continue;

      const allocations = combinedAllocations(
        dimension,
        event.domainAllocations[dimension],
      );
      const totalAllocatedDose = rawDose * allocations.reduce(
        (sum, allocation) => sum + allocation.weight,
        0,
      );
      let totalDomainMarginal = 0;

      for (const allocation of allocations) {
        const rawDoseAdded = rawDose * allocation.weight;
        const rawDoseBefore =
          rawByDimension[dimension].get(allocation.key) ?? 0;
        const rawDoseAfter = rawDoseBefore + rawDoseAdded;
        const creditedDoseBefore = sessionAdaptationValue(
          dimension,
          rawDoseBefore,
        );
        const creditedDoseAfter = sessionAdaptationValue(
          dimension,
          rawDoseAfter,
        );
        const marginalCredit = Math.max(
          0,
          creditedDoseAfter - creditedDoseBefore,
        );
        const marginalRatio = rawDoseAdded > 0
          ? Math.min(1, marginalCredit / rawDoseAdded)
          : 0;

        rawByDimension[dimension].set(allocation.key, rawDoseAfter);
        totalDomainMarginal += marginalCredit;
        domainTrace[dimension].push({
          key: allocation.key,
          allocationWeight: allocation.weight,
          rawDoseBefore,
          rawDoseAdded,
          rawDoseAfter,
          creditedDoseBefore,
          marginalCredit,
          creditedDoseAfter,
          marginalRatio,
        });
      }

      const marginalRatio = totalAllocatedDose > 0
        ? Math.min(1, totalDomainMarginal / totalAllocatedDose)
        : 0;
      const marginalCredit = rawDose * marginalRatio;
      marginalRatios[dimension] = marginalRatio;
      marginalCreditedVector[dimension] = marginalCredit;

      if (
        marginalRatio
          < SESSION_ADAPTATION_CONFIG.explanations.saturationRatioMax
      ) {
        const reason = dimensionReason(dimension);
        eventReasons.push(reason);
        resultReasons.push(reason);
      }
      if (
        dimension === 'strength'
        && marginalRatio
          <= SESSION_ADAPTATION_CONFIG.explanations.lowMarginalRatioMax
      ) {
        eventReasons.push('low_marginal_strength_value');
        resultReasons.push('low_marginal_strength_value');
      }
      if (
        dimension === 'power'
        && marginalRatio
          <= SESSION_ADAPTATION_CONFIG.explanations.lowMarginalRatioMax
      ) {
        eventReasons.push('low_marginal_power_value');
        resultReasons.push('low_marginal_power_value');
      }
      if (
        dimension === 'localEndurance'
        && marginalRatio
          < SESSION_ADAPTATION_CONFIG.explanations.saturationRatioMax
        && allocations.some(allocation =>
          allocation.key.endsWith(':density')
        )
      ) {
        eventReasons.push('endurance_density_saturated');
        resultReasons.push('endurance_density_saturated');
      }
    }

    addVector(preSaturationVector, eventVector);
    addVector(accumulatedAdaptationVector, marginalCreditedVector);
    addNativeDose(nativeDose, event.nativeDose);
    accumulatedCostVector.localMuscular +=
      nonNegative(event.costVector.localMuscular);
    accumulatedCostVector.lastingCentral +=
      nonNegative(event.costVector.lastingCentral);

    eventResults.push({
      id: event.id,
      exerciseId: event.exerciseId,
      source: event.source,
      preSaturationVector: eventVector,
      marginalCreditedVector,
      marginalRatios,
      accumulatedPreSaturationVector: cloneVector(
        preSaturationVector,
      ),
      accumulatedCreditedVector: cloneVector(
        accumulatedAdaptationVector,
      ),
      accumulatedCostVector: cloneCost(accumulatedCostVector),
      domainTrace,
      explanationCodes: unique(eventReasons),
    });
  }

  const domainTotals: SessionDomainTotals = {
    hypertrophy: [],
    strength: [],
    power: [],
    localEndurance: [],
  };
  for (const dimension of DIMENSIONS) {
    domainTotals[dimension] = [...rawByDimension[dimension]]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rawDose]) => ({
        key,
        rawDose,
        creditedDose: sessionAdaptationValue(dimension, rawDose),
      }));
  }
  const confidenceScores = input.events.map(
    event => nonNegative(event.confidence.score),
  );
  const confidenceScore = confidenceScores.length > 0
    ? Math.min(...confidenceScores)
    : 0;
  const missingInputs = unique(
    input.events.flatMap(event => event.confidence.missingInputs),
  );
  if (orderSource === 'stored_order_fallback') {
    missingInputs.push('set_timestamps');
  }

  return {
    modelVersion: SESSION_ADAPTATION_MODEL_VERSION,
    dependencyVersions: {
      ...SESSION_ADAPTATION_CONFIG.dependencies,
      domainAllocation:
        input.domainModelVersion ?? 'caller-defined-domains',
    },
    orderSource,
    eventResults,
    nativeDose,
    preSaturationVector,
    accumulatedAdaptationVector,
    accumulatedCostVector,
    domainTotals,
    confidence: {
      score: confidenceScore,
      band: confidenceBand(confidenceScore),
      evidenceLevels: unique(
        input.events.flatMap(
          event => event.confidence.evidenceLevels,
        ),
      ),
      missingInputs: unique(missingInputs),
      estimatedInputs: unique(
        input.events.flatMap(
          event => event.confidence.estimatedInputs,
        ),
      ),
    },
    explanationCodes: unique(resultReasons),
  };
}
