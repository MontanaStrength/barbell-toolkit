import { must } from '../../utils/must';
import {
  MAX_EFFECTIVE_REPS,
  intensityForRPE,
  maxRepsAtIntensity,
  rpeAtIntensity,
} from '../strength/loadCurve';

export const EFFORT_PROJECTION_MODEL_VERSION =
  'chronological-effort-projection-one-state-inferred-v0' as const;

export type EffortRole =
  | 'fresh_estimate'
  | 'execution_target'
  | 'quality_ceiling'
  | 'observed';

export type EffortControlMode =
  | 'fixed_load_reps'
  | 'hold_rpe_adjust_load'
  | 'hold_rpe_adjust_reps'
  | 'quality_ceiling'
  | 'timed_autoregulated'
  | 'observed';

export type EffortIntent =
  | {
      role: 'fresh_estimate';
      controlMode: 'fixed_load_reps';
    }
  | {
      role: 'execution_target';
      controlMode: 'hold_rpe_adjust_load';
      targetRpe: number;
    }
  | {
      role: 'execution_target';
      controlMode: 'hold_rpe_adjust_reps';
      targetRpe: number;
    }
  | {
      role: 'quality_ceiling';
      controlMode: 'quality_ceiling';
      ceilingRpe: number;
    }
  | {
      role: 'quality_ceiling';
      controlMode: 'timed_autoregulated';
      ceilingRpe: number;
    }
  | {
      role: 'observed';
      controlMode: 'observed';
      observedRpe: number;
    };

export interface EffortWorkEvent {
  type: 'work';
  id: string;
  reps: number;
  /** Estimated RPE for this exact load and rep count in a fresh state. */
  freshEstimateRpe: number;
  /** Optional %1RM used when the control mode solves reps instead of load. */
  intensityPct: number | null;
  /** Confidence in the fresh estimate, independent of the fatigue model. */
  freshEstimateConfidence: number | null;
  intent: EffortIntent;
}

export type RecoveryProvenance =
  | {
      source: 'observed';
      durationSeconds: number;
    }
  | {
      source: 'prescribed';
      durationSeconds: number;
    }
  | {
      source: 'model_prior';
      durationSeconds: number;
    }
  | {
      source: 'population_fallback';
      durationSeconds: number;
    }
  | {
      source: 'interval_remainder';
      intervalSeconds: number;
      estimatedWorkSeconds: number;
    };

export interface EffortRecoveryEvent {
  type: 'recovery';
  id: string;
  recovery: RecoveryProvenance;
}

export type EffortSequenceEvent = EffortWorkEvent | EffortRecoveryEvent;

export interface EffortFatigueState {
  fatigueRpe: number;
}

export interface EffortProjectionConfig {
  /** Effective recovery half-life; an inference parameter, not physiology. */
  recoveryHalfLifeSeconds: number;
  /** Largest state deposit produced by a bout at estimated failure. */
  maxWorkDoseRpe: number;
  /** Curvature applied to the completed fraction of estimated rep capacity. */
  proximityExponent: number;
  /** Recovery assumption used only when a timeline declares no duration. */
  defaultRecoverySeconds: number;
  defaultFreshEstimateConfidence: number;
  targetToleranceRpe: number;
}

// These are conservative inference defaults, not fitted physiology. Work-dose
// amplitude is deliberately independent from recovery speed so that changing a
// half-life cannot silently inflate the fatigue deposited by a short-rest bout.
// The same event model applies to every schema.
export const DEFAULT_EFFORT_PROJECTION_CONFIG: Readonly<EffortProjectionConfig> = {
  recoveryHalfLifeSeconds: 120,
  maxWorkDoseRpe: 0.60,
  proximityExponent: 2,
  defaultRecoverySeconds: 120,
  defaultFreshEstimateConfidence: 0.70,
  targetToleranceRpe: 0.05,
};

export interface EffortProjectionOptions {
  initialState: EffortFatigueState | null;
  config: EffortProjectionConfig | null;
}

export interface EffortProjectionConfidence {
  score: number;
  band: 'high' | 'moderate' | 'low';
  estimatedInputs: string[];
  missingInputs: string[];
}

export type EffortControlRecommendation =
  | {
      kind: 'none';
    }
  | {
      kind: 'adjust_load';
      targetRpe: number;
      requiredFreshRpe: number;
      suggestedIntensityPct: number | null;
      adjustmentRequired: boolean;
      feasible: boolean;
    }
  | {
      kind: 'adjust_reps';
      targetRpe: number;
      requiredFreshRpe: number;
      suggestedRepsExact: number | null;
      suggestedReps: number | null;
      adjustmentRequired: boolean;
      feasible: boolean;
    }
  | {
      kind: 'ceiling_check';
      ceilingRpe: number;
      marginRpe: number;
      action: 'keep_work' | 'adjust_or_stop';
    }
  | {
      kind: 'timed_ceiling_check';
      ceilingRpe: number;
      marginRpe: number;
      action: 'continue' | 'reduce_or_stop';
    }
  | {
      kind: 'record_observation';
      observedRpe: number;
      projectionErrorRpe: number;
    };

export type WorkProjectionStatus =
  | 'predicted'
  | 'target_on_plan'
  | 'target_requires_adjustment'
  | 'target_infeasible'
  | 'within_ceiling'
  | 'ceiling_exceeded'
  | 'observed';

export interface EffortDoseTrace {
  reps: number;
  effortRpe: number;
  estimatedRir: number;
  estimatedCapacityReps: number;
  workFraction: number;
  proximityExponent: number;
  maxWorkDoseRpe: number;
  depositedFatigueRpe: number;
}

export interface EffortWorkProjection {
  type: 'work';
  eventIndex: number;
  eventId: string;
  reps: number;
  role: EffortRole;
  controlMode: EffortControlMode;
  freshEstimateRpe: number;
  enteringFatigueRpe: number;
  /** Unclamped prediction. Values above ten expose infeasible work. */
  projectedRpe: number;
  targetRpe: number | null;
  ceilingRpe: number | null;
  observedRpe: number | null;
  status: WorkProjectionStatus;
  recommendation: EffortControlRecommendation;
  stateBefore: EffortFatigueState;
  dose: EffortDoseTrace;
  stateAfter: EffortFatigueState;
  confidence: EffortProjectionConfidence;
}

export interface EffortRecoveryProjection {
  type: 'recovery';
  eventIndex: number;
  eventId: string;
  provenance: RecoveryProvenance['source'];
  durationSeconds: number;
  intervalOverrunSeconds: number;
  retainedFraction: number;
  stateBefore: EffortFatigueState;
  stateAfter: EffortFatigueState;
  confidence: EffortProjectionConfidence;
}

export type EffortProjectionTraceEvent =
  | EffortWorkProjection
  | EffortRecoveryProjection;

export interface EffortProjectionResult {
  modelVersion: typeof EFFORT_PROJECTION_MODEL_VERSION;
  config: EffortProjectionConfig;
  trace: EffortProjectionTraceEvent[];
  workProjections: EffortWorkProjection[];
  finalState: EffortFatigueState;
  confidence: EffortProjectionConfidence;
}

// These scores are heuristic provenance ranks, not calibrated probabilities or
// coverage guarantees. Confidence is trace metadata only; it never scales
// fatigue or projected RPE.
const RECOVERY_CONFIDENCE: Readonly<
  Record<RecoveryProvenance['source'], number>
> = {
  observed: 0.95,
  prescribed: 0.85,
  interval_remainder: 0.75,
  model_prior: 0.60,
  population_fallback: 0.45,
};

const LOAD_INVERSE_ROUND_TRIP_TOLERANCE_RPE = 0.5;

function assertFinite(
  value: number,
  label: string,
): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}

function assertInRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  assertFinite(value, label);
  if (value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
}

function validateConfig(config: EffortProjectionConfig): void {
  assertFinite(config.recoveryHalfLifeSeconds, 'recoveryHalfLifeSeconds');
  assertFinite(config.proximityExponent, 'proximityExponent');
  assertFinite(config.defaultRecoverySeconds, 'defaultRecoverySeconds');
  assertFinite(config.targetToleranceRpe, 'targetToleranceRpe');

  if (config.recoveryHalfLifeSeconds <= 0) {
    throw new Error('recoveryHalfLifeSeconds must be greater than zero');
  }
  if (config.proximityExponent <= 0) {
    throw new Error('proximityExponent must be greater than zero');
  }
  if (config.defaultRecoverySeconds < 0) {
    throw new Error('defaultRecoverySeconds cannot be negative');
  }
  if (config.targetToleranceRpe < 0) {
    throw new Error('targetToleranceRpe cannot be negative');
  }

  assertInRange(config.maxWorkDoseRpe, 0, 10, 'maxWorkDoseRpe');
  assertInRange(
    config.defaultFreshEstimateConfidence,
    0,
    1,
    'defaultFreshEstimateConfidence',
  );
}

function validateState(state: EffortFatigueState): void {
  assertFinite(state.fatigueRpe, 'initialState.fatigueRpe');
  if (state.fatigueRpe < 0) {
    throw new Error('Initial fatigue state cannot be negative');
  }
}

function validateWorkEvent(event: EffortWorkEvent): void {
  assertFinite(event.reps, `${event.id}.reps`);
  if (event.reps <= 0) {
    throw new Error(`${event.id}.reps must be greater than zero`);
  }

  assertInRange(event.freshEstimateRpe, 0, 10, `${event.id}.freshEstimateRpe`);
  if (event.freshEstimateConfidence != null) {
    assertInRange(
      event.freshEstimateConfidence,
      0,
      1,
      `${event.id}.freshEstimateConfidence`,
    );
  }
  if (event.intensityPct != null) {
    assertInRange(event.intensityPct, 0, 100, `${event.id}.intensityPct`);
  }

  if (event.intent.role === 'execution_target') {
    assertInRange(event.intent.targetRpe, 0, 10, `${event.id}.targetRpe`);
    if (
      event.intent.controlMode === 'hold_rpe_adjust_reps'
      && event.intensityPct == null
    ) {
      throw new Error(
        `${event.id}.intensityPct is required to hold RPE by adjusting reps`,
      );
    }
  }

  if (event.intent.role === 'quality_ceiling') {
    assertInRange(event.intent.ceilingRpe, 0, 10, `${event.id}.ceilingRpe`);
  }

  if (event.intent.role === 'observed') {
    assertInRange(event.intent.observedRpe, 0, 10, `${event.id}.observedRpe`);
  }
}

function validateRecoveryEvent(event: EffortRecoveryEvent): void {
  const recovery = event.recovery;
  if (recovery.source === 'interval_remainder') {
    assertFinite(recovery.intervalSeconds, `${event.id}.intervalSeconds`);
    assertFinite(
      recovery.estimatedWorkSeconds,
      `${event.id}.estimatedWorkSeconds`,
    );
    if (recovery.intervalSeconds < 0 || recovery.estimatedWorkSeconds < 0) {
      throw new Error(`${event.id} interval durations cannot be negative`);
    }
    return;
  }

  assertFinite(recovery.durationSeconds, `${event.id}.durationSeconds`);
  if (recovery.durationSeconds < 0) {
    throw new Error(`${event.id}.durationSeconds cannot be negative`);
  }
}

function validateEvents(events: readonly EffortSequenceEvent[]): void {
  const ids = new Set<string>();

  for (const event of events) {
    if (event.id.length === 0) {
      throw new Error('Effort sequence event ids cannot be empty');
    }
    if (ids.has(event.id)) {
      throw new Error(`Duplicate effort sequence event id: ${event.id}`);
    }
    ids.add(event.id);

    if (event.type === 'work') {
      validateWorkEvent(event);
    } else {
      validateRecoveryEvent(event);
    }
  }
}

function retainedFraction(seconds: number, halfLifeSeconds: number): number {
  return Math.pow(2, -seconds / halfLifeSeconds);
}

function confidenceBand(
  score: number,
): EffortProjectionConfidence['band'] {
  if (score >= 0.80) return 'high';
  if (score >= 0.60) return 'moderate';
  return 'low';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function buildConfidence(
  scores: readonly number[],
  estimatedInputs: readonly string[],
  missingInputs: readonly string[],
): EffortProjectionConfidence {
  const score = scores.length > 0 ? Math.min(...scores) : 1;

  return {
    score,
    band: confidenceBand(score),
    estimatedInputs: unique(estimatedInputs),
    missingInputs: unique(missingInputs),
  };
}

function cloneState(state: EffortFatigueState): EffortFatigueState {
  return {
    fatigueRpe: state.fatigueRpe,
  };
}

function resolveRecovery(
  recovery: RecoveryProvenance,
): { durationSeconds: number; intervalOverrunSeconds: number } {
  if (recovery.source !== 'interval_remainder') {
    return {
      durationSeconds: recovery.durationSeconds,
      intervalOverrunSeconds: 0,
    };
  }

  return {
    durationSeconds: Math.max(
      0,
      recovery.intervalSeconds - recovery.estimatedWorkSeconds,
    ),
    intervalOverrunSeconds: Math.max(
      0,
      recovery.estimatedWorkSeconds - recovery.intervalSeconds,
    ),
  };
}

function effortForDose(
  event: EffortWorkEvent,
  projectedRpe: number,
): number {
  if (event.intent.role === 'execution_target') {
    return event.intent.targetRpe;
  }

  return projectedRpe;
}

function inferredDoseForWork(
  reps: number,
  effortRpe: number,
  config: EffortProjectionConfig,
): EffortDoseTrace {
  const boundedEffortRpe = Math.max(0, Math.min(10, effortRpe));
  const estimatedRir = 10 - boundedEffortRpe;
  const estimatedCapacityReps = reps + estimatedRir;
  const workFraction = reps / estimatedCapacityReps;
  const depositedFatigueRpe = config.maxWorkDoseRpe
    * Math.pow(workFraction, config.proximityExponent);

  return {
    reps,
    effortRpe: boundedEffortRpe,
    estimatedRir,
    estimatedCapacityReps,
    workFraction,
    proximityExponent: config.proximityExponent,
    maxWorkDoseRpe: config.maxWorkDoseRpe,
    depositedFatigueRpe,
  };
}

function targetStatus(
  feasible: boolean,
  adjustmentRequired: boolean,
): WorkProjectionStatus {
  if (!feasible) return 'target_infeasible';
  if (adjustmentRequired) return 'target_requires_adjustment';
  return 'target_on_plan';
}

function feasibleIntensityForFreshRpe(
  reps: number,
  requiredFreshRpe: number,
): number | null {
  if (requiredFreshRpe < 0 || requiredFreshRpe > 10) return null;

  const effectiveReps = reps + (10 - requiredFreshRpe);
  if (effectiveReps < 1 || effectiveReps > MAX_EFFECTIVE_REPS) return null;

  const intensityPct = intensityForRPE(reps, requiredFreshRpe);
  const roundTripRpe = rpeAtIntensity(reps, intensityPct);
  if (
    Math.abs(roundTripRpe - requiredFreshRpe)
      > LOAD_INVERSE_ROUND_TRIP_TOLERANCE_RPE
  ) {
    return null;
  }

  return intensityPct;
}

function buildRecommendation(
  event: EffortWorkEvent,
  projectedRpe: number,
  enteringFatigueRpe: number,
  config: EffortProjectionConfig,
): {
  status: WorkProjectionStatus;
  targetRpe: number | null;
  ceilingRpe: number | null;
  observedRpe: number | null;
  recommendation: EffortControlRecommendation;
} {
  const intent = event.intent;

  if (intent.role === 'fresh_estimate') {
    return {
      targetRpe: null,
      ceilingRpe: null,
      observedRpe: null,
      status: 'predicted',
      recommendation: { kind: 'none' },
    };
  }

  if (intent.role === 'execution_target') {
    const requiredFreshRpe = intent.targetRpe - enteringFatigueRpe;
    const adjustmentRequired =
      Math.abs(projectedRpe - intent.targetRpe) > config.targetToleranceRpe;

    if (intent.controlMode === 'hold_rpe_adjust_load') {
      const suggestedIntensityPct = feasibleIntensityForFreshRpe(
        event.reps,
        requiredFreshRpe,
      );
      const feasible = suggestedIntensityPct != null;

      return {
        ceilingRpe: null,
        observedRpe: null,
        status: targetStatus(feasible, adjustmentRequired),
        targetRpe: intent.targetRpe,
        recommendation: {
          kind: 'adjust_load',
          targetRpe: intent.targetRpe,
          requiredFreshRpe,
          suggestedIntensityPct,
          adjustmentRequired,
          feasible,
        },
      };
    }

    const maximumReps = maxRepsAtIntensity(must(event.intensityPct, 'event.intensityPct'));
    const suggestedRepsExact =
      maximumReps - (10 - requiredFreshRpe);
    const feasible = requiredFreshRpe >= 0
      && requiredFreshRpe <= 10
      && suggestedRepsExact >= 1;

    return {
      ceilingRpe: null,
      observedRpe: null,
      status: targetStatus(feasible, adjustmentRequired),
      targetRpe: intent.targetRpe,
      recommendation: {
        kind: 'adjust_reps',
        targetRpe: intent.targetRpe,
        requiredFreshRpe,
        suggestedRepsExact: feasible ? suggestedRepsExact : null,
        suggestedReps: feasible ? Math.floor(suggestedRepsExact) : null,
        adjustmentRequired,
        feasible,
      },
    };
  }

  if (intent.role === 'quality_ceiling') {
    const marginRpe = intent.ceilingRpe - projectedRpe;
    const exceeded = marginRpe < 0;

    if (intent.controlMode === 'timed_autoregulated') {
      return {
        targetRpe: null,
        observedRpe: null,
        status: exceeded ? 'ceiling_exceeded' : 'within_ceiling',
        ceilingRpe: intent.ceilingRpe,
        recommendation: {
          kind: 'timed_ceiling_check',
          ceilingRpe: intent.ceilingRpe,
          marginRpe,
          action: exceeded ? 'reduce_or_stop' : 'continue',
        },
      };
    }

    return {
      targetRpe: null,
      observedRpe: null,
      status: exceeded ? 'ceiling_exceeded' : 'within_ceiling',
      ceilingRpe: intent.ceilingRpe,
      recommendation: {
        kind: 'ceiling_check',
        ceilingRpe: intent.ceilingRpe,
        marginRpe,
        action: exceeded ? 'adjust_or_stop' : 'keep_work',
      },
    };
  }

  return {
    targetRpe: null,
    ceilingRpe: null,
    status: 'observed',
    observedRpe: intent.observedRpe,
    recommendation: {
      kind: 'record_observation',
      observedRpe: intent.observedRpe,
      projectionErrorRpe: intent.observedRpe - projectedRpe,
    },
  };
}

/**
 * Projects perceived effort over an exact chronological event sequence.
 *
 * Work deposits proximity-weighted fatigue after its own projection. Recovery
 * events decay one effective state. Effort targets and ceilings are retained as
 * control constraints; they never replace the model prediction.
 * Recommendations are non-mutating: a caller that accepts one applies the
 * changed load or reps to its event stream and projects that stream again.
 * Observed residuals are also trace-only. This kernel deliberately does not
 * assimilate them because a single residual cannot identify fresh load-curve
 * bias separately from fatigue-state error; calibration must resolve that with
 * longitudinal evidence outside this projection pass.
 */
export function projectEffortSequence(
  events: readonly EffortSequenceEvent[],
  options: EffortProjectionOptions,
): EffortProjectionResult {
  const config: EffortProjectionConfig = {
    ...DEFAULT_EFFORT_PROJECTION_CONFIG,
    ...options.config,
  };
  const initialState = options.initialState ?? { fatigueRpe: 0 };

  validateConfig(config);
  validateState(initialState);
  validateEvents(events);

  let state = cloneState(initialState);
  const trace: EffortProjectionTraceEvent[] = [];
  const workProjections: EffortWorkProjection[] = [];
  const confidenceScores: number[] = [];
  const estimatedInputs = [
    'inferred_proximity_weighted_work_dose',
    'inferred_effective_recovery_half_life',
  ];
  const missingInputs: string[] = [];

  for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
    const event = must(events[eventIndex], 'events[eventIndex]');
    const stateBefore = cloneState(state);

    if (event.type === 'recovery') {
      const resolved = resolveRecovery(event.recovery);
      const recoveryRetainedFraction = retainedFraction(
        resolved.durationSeconds,
        config.recoveryHalfLifeSeconds,
      );

      state = {
        fatigueRpe: state.fatigueRpe * recoveryRetainedFraction,
      };

      const recoveryConfidence = RECOVERY_CONFIDENCE[event.recovery.source];
      confidenceScores.push(recoveryConfidence);
      if (event.recovery.source === 'interval_remainder') {
        estimatedInputs.push('interval_work_duration');
      }
      if (event.recovery.source === 'model_prior') {
        estimatedInputs.push('modeled_rest_duration');
      }
      if (event.recovery.source === 'population_fallback') {
        estimatedInputs.push('population_rest_fallback');
        missingInputs.push('rest_duration');
      }

      const confidence = buildConfidence(
        confidenceScores,
        estimatedInputs,
        missingInputs,
      );
      trace.push({
        type: 'recovery',
        eventIndex,
        eventId: event.id,
        provenance: event.recovery.source,
        durationSeconds: resolved.durationSeconds,
        intervalOverrunSeconds: resolved.intervalOverrunSeconds,
        retainedFraction: recoveryRetainedFraction,
        stateBefore,
        stateAfter: cloneState(state),
        confidence,
      });
      continue;
    }

    const freshConfidence = event.freshEstimateConfidence
      ?? config.defaultFreshEstimateConfidence;
    confidenceScores.push(freshConfidence);
    if (event.freshEstimateConfidence == null) {
      estimatedInputs.push('fresh_estimate_confidence_default');
    }

    const enteringFatigueRpe = state.fatigueRpe;
    const projectedRpe = event.freshEstimateRpe + enteringFatigueRpe;
    const control = buildRecommendation(
      event,
      projectedRpe,
      enteringFatigueRpe,
      config,
    );
    const dose = inferredDoseForWork(
      event.reps,
      effortForDose(event, projectedRpe),
      config,
    );

    state = {
      fatigueRpe: state.fatigueRpe + dose.depositedFatigueRpe,
    };

    const confidence = buildConfidence(
      confidenceScores,
      estimatedInputs,
      missingInputs,
    );
    const projection: EffortWorkProjection = {
      type: 'work',
      eventIndex,
      eventId: event.id,
      reps: event.reps,
      role: event.intent.role,
      controlMode: event.intent.controlMode,
      freshEstimateRpe: event.freshEstimateRpe,
      enteringFatigueRpe,
      projectedRpe,
      targetRpe: control.targetRpe,
      ceilingRpe: control.ceilingRpe,
      observedRpe: control.observedRpe,
      status: control.status,
      recommendation: control.recommendation,
      stateBefore,
      dose,
      stateAfter: cloneState(state),
      confidence,
    };

    trace.push(projection);
    workProjections.push(projection);
  }

  return {
    modelVersion: EFFORT_PROJECTION_MODEL_VERSION,
    config,
    trace,
    workProjections,
    finalState: cloneState(state),
    confidence: buildConfidence(
      confidenceScores,
      estimatedInputs,
      missingInputs,
    ),
  };
}
