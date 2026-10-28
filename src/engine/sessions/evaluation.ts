/** Immutable evaluation of the actual work shown on the session card. */
import type { CardSet } from "./card";
import type { LiftKey } from "../constants";
import {
  projectEffortSequence,
  EFFORT_PROJECTION_MODEL_VERSION,
  type EffortSequenceEvent,
} from "../sa/modeling/effort/effortProjection";
import {
  maxRepsAtIntensity,
  rpeAtIntensity,
} from "../sa/modeling/strength/loadCurve";
import {
  computeSetAdaptation,
  EFFECTIVE_SET_MODEL_CONFIG,
  type EffectiveSetVector,
  type SetAdaptationInput,
} from "../sa/modeling/volume/setAdaptation";
import {
  composeSetGroupAdaptation,
  SET_GROUP_ADAPTATION_MODEL_VERSION,
  type SetGroupStructure,
} from "../sa/modeling/volume/setGroupAdaptation";
import {
  composeSessionAdaptation,
  SESSION_ADAPTATION_MODEL_VERSION,
  type SessionAdaptationEvent,
} from "../sa/modeling/volume/sessionAdaptation";
import {
  sessionEventForSetAdaptation,
  sessionEventsForSetGroup,
  SESSION_ADAPTATION_DOMAIN_MODEL_VERSION,
} from "../sa/modeling/volume/sessionDomainMapping";
import { liftClassForRecruitment } from "../sa/modeling/volume/recruitmentCurve";
import { powerCategoryForExerciseId } from "../sa/exercises/powerSuitability";

export interface SessionEvaluation {
  status: "estimated" | "partial" | "unavailable";
  /** Session diminishing returns applied; these axes are different units. */
  benefits: EffectiveSetVector | null;
  /** Sum of set/group credits before session diminishing returns. */
  rawBenefits: EffectiveSetVector | null;
  costs: { central: number; peripheral: number } | null;
  perSet: Array<{ index: number; projectedRpe: number | null; status: string }>;
  warnings: string[];
  basis: string;
  source: { name: string; commit: string; url: string };
  modelVersions: {
    effort: string;
    set: string;
    group: string;
    session: string;
    domains: string;
  };
}

const SOURCE = {
  name: "Strength Architect",
  commit: "f6fc5ac220c54e553f3433052d6ab9a9ebfaafb1",
  url: "https://github.com/Barbell-Hacks/StrengthArchitect-/tree/f6fc5ac220c54e553f3433052d6ab9a9ebfaafb1/src/engine/modeling",
};
const EXERCISE: Record<LiftKey, string> = {
  bench: "bench_press",
  squat: "back_squat",
  deadlift: "conventional_deadlift",
};
const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
const finiteNonnegative = (value: number) =>
  Number.isFinite(value) && value >= 0;

interface Bout {
  id: string;
  row: number;
  reps: number;
  group: string | null;
  structure: SetGroupStructure | null;
  restBeforeSeconds: number | null;
}

/** Display phase names never imply compound-set pricing. Only explicit cluster
 * parts, or contiguous named blocks of the two authored mini-set recipes, do. */
function blockGroup(
  set: CardSet,
  designKey: string,
): { key: string; structure: SetGroupStructure } | null {
  if (designKey === "recoveryIslands" && /^Block \d+$/.test(set.group))
    return { key: set.group, structure: "repeated_mini_sets" };
  if (designKey === "restPauseHarvest") {
    const block = set.group.match(
      /^(Block \d+), (?:activation|mini-set)$/,
    )?.[1];
    if (block) return { key: block, structure: "rest_pause" };
  }
  return null;
}

/** Toolkit's existing duration convention, used only to subtract work from a
 * start-to-start interval. It is an explicit estimate, not measured recovery. */
function workSeconds(set: CardSet, parts: number[]): number {
  const eccentricExtra = set.tempo
    ? Math.max(0, Number(set.tempo.split("-")[0]) - 1.5)
    : 0;
  const intraRest =
    set.reps.kind === "cluster" ? (parts.length - 1) * set.reps.intraRest : 0;
  return (
    parts.reduce((sum, reps) => sum + reps * (4 + eccentricExtra), 0) +
    intraRest
  );
}

export function evaluateSession(
  sets: CardSet[],
  lift: LiftKey,
  designKey: string,
): SessionEvaluation {
  const result: SessionEvaluation = {
    status: "unavailable",
    benefits: null,
    rawBenefits: null,
    costs: null,
    perSet: sets.map((_, i) => ({
      index: i + 1,
      projectedRpe: null,
      status: "unpriced",
    })),
    warnings: [],
    basis:
      "Estimated fixed requested work, using actual load percentages and prescribed recovery. Population models; no observed effort, individual recovery, or generator-admission claim.",
    source: { ...SOURCE },
    modelVersions: {
      effort: EFFORT_PROJECTION_MODEL_VERSION,
      set: EFFECTIVE_SET_MODEL_CONFIG.version,
      group: SET_GROUP_ADAPTATION_MODEL_VERSION,
      session: SESSION_ADAPTATION_MODEL_VERSION,
      domains: SESSION_ADAPTATION_DOMAIN_MODEL_VERSION,
    },
  };
  if (!sets.length) {
    result.warnings.push("Add work sets to see an estimate.");
    return result;
  }
  const timeline: EffortSequenceEvent[] = [];
  const bouts: Bout[] = [];
  let unknown = false;
  let impossible = false;
  let previousBlock: string | null = null;
  let groupRun = 0;
  let previousRecovery = 0;
  for (const [row, set] of sets.entries()) {
    const label = `Set ${row + 1}`;
    if (unknown) {
      result.perSet[row].status = "unknown_after_unpriced_work";
      continue;
    }
    if (
      set.reps.kind === "timed" ||
      set.reps.kind === "toStop" ||
      set.reps.kind === "upTo"
    ) {
      result.perSet[row].status =
        set.reps.kind === "timed" ? "timed_reps_unknown" : "open_reps_unknown";
      result.warnings.push(
        `${label}: ${set.reps.kind === "timed" ? "a timed window" : "a stop rule or rep ceiling"} does not specify completed reps. Full-session benefit and cost are withheld; later effort cannot be inferred through unknown work.`,
      );
      unknown = true;
      continue;
    }
    const parts = set.reps.kind === "cluster" ? set.reps.parts : [set.reps.n];
    if (
      !parts.length ||
      !parts.every(positiveInteger) ||
      !Number.isFinite(set.pct) ||
      set.pct <= 0 ||
      set.pct > 100 ||
      !finiteNonnegative(set.next) ||
      (set.reps.kind === "cluster" && !finiteNonnegative(set.reps.intraRest)) ||
      (set.ceiling &&
        (!Number.isFinite(set.rpe) || set.rpe < 0 || set.rpe > 10)) ||
      (set.tempo && !Number.isFinite(Number(set.tempo.split("-")[0])))
    ) {
      result.perSet[row].status = "invalid_inputs";
      result.warnings.push(
        `${label}: valid positive reps, 0–100% load, effort ceiling, and nonnegative recovery are required.`,
      );
      unknown = true;
      continue;
    }
    const block = blockGroup(set, designKey);
    if (!block || block.key !== previousBlock) groupRun++;
    previousBlock = block?.key ?? null;
    const group =
      set.reps.kind === "cluster"
        ? `cluster-${row}`
        : block
          ? `block-${groupRun}`
          : null;
    const structure =
      set.reps.kind === "cluster" ? "cluster" : (block?.structure ?? null);
    for (const [part, reps] of parts.entries()) {
      const id = `row-${row}-part-${part}`;
      const intra = set.reps.kind === "cluster" ? set.reps.intraRest : 0;
      if (part > 0)
        timeline.push({
          type: "recovery",
          id: `intra-${id}`,
          recovery: { source: "prescribed", durationSeconds: intra },
        });
      timeline.push({
        type: "work",
        id,
        reps,
        intensityPct: set.pct,
        freshEstimateRpe: rpeAtIntensity(reps, set.pct),
        freshEstimateConfidence: null,
        intent: set.ceiling
          ? {
              role: "quality_ceiling",
              controlMode: "quality_ceiling",
              ceilingRpe: set.rpe,
            }
          : { role: "fresh_estimate", controlMode: "fixed_load_reps" },
      });
      bouts.push({
        id,
        row,
        reps,
        group,
        structure,
        restBeforeSeconds: part > 0 ? intra : previousRecovery,
      });
      if (reps > maxRepsAtIntensity(set.pct)) {
        impossible = true;
        result.perSet[row].status = "predicted_infeasible";
        result.warnings.push(
          `${label}: requested reps exceed the model's fresh capacity at this load. Work is unchanged; attainable session totals are withheld.`,
        );
      }
    }
    if (row < sets.length - 1) {
      const estimatedWorkSeconds = workSeconds(set, parts);
      previousRecovery = set.clock
        ? Math.max(0, set.next - estimatedWorkSeconds)
        : set.next;
      timeline.push({
        type: "recovery",
        id: `after-${row}`,
        recovery: set.clock
          ? {
              source: "interval_remainder",
              intervalSeconds: set.next,
              estimatedWorkSeconds,
            }
          : { source: "prescribed", durationSeconds: set.next },
      });
      if (set.clock && estimatedWorkSeconds > set.next) {
        result.warnings.push(
          `${label}: estimated work exceeds its start interval. Recovery is zero; the clock needs review.`,
        );
      }
    }
  }
  if (sets.some((set) => set.clock))
    result.warnings.push(
      "Clock recovery uses the interval minus estimated work time (4 seconds per rep, plus explicit tempo and cluster rests); it is not the entire start interval.",
    );
  if (sets.some((set) => set.tempo))
    result.warnings.push(
      "Tempo is marked constrained; this model does not quantify an additional hypertrophy or recovery effect from slow eccentrics.",
    );
  if (!bouts.length) return result;

  const projection = projectEffortSequence(timeline, {
    initialState: null,
    config: null,
  });
  for (const [i, bout] of bouts.entries()) {
    const p = projection.workProjections[i];
    const row = result.perSet[bout.row];
    row.projectedRpe = Math.max(row.projectedRpe ?? -Infinity, p.projectedRpe);
    if (p.projectedRpe > 10) {
      impossible = true;
      row.status = "predicted_infeasible";
      result.warnings.push(
        `Set ${bout.row + 1}: projected effort exceeds RPE 10. Fixed work is unchanged; attainable session totals are withheld.`,
      );
    } else if (row.status !== "predicted_infeasible") {
      row.status = row.status === "ceiling_exceeded" ? row.status : p.status;
    }
    if (p.status === "ceiling_exceeded")
      result.warnings.push(
        `Set ${bout.row + 1}: projected effort exceeds its RPE ${sets[bout.row].rpe} ceiling; the stop rule may shorten this work.`,
      );
  }
  result.warnings = [...new Set(result.warnings)];
  // A whole-session total must not masquerade as a subtotal of the known prefix.
  if (unknown || impossible) {
    result.status = "partial";
    return result;
  }

  const exerciseId = EXERCISE[lift];
  const inputs: SetAdaptationInput[] = bouts.map((bout, i) => ({
    reps: bout.reps,
    intensityPct: sets[bout.row].pct,
    rpe: projection.workProjections[i].projectedRpe,
    liftClass: liftClassForRecruitment(exerciseId),
    forceRouteEligible: true,
    executionPrescription: sets[bout.row].tempo ? "tempo_constrained" : null,
    powerExerciseCategory: powerCategoryForExerciseId(exerciseId),
    movementSpecificity: 1,
    carriedDepletion: null,
    evidence: {
      level: "load_reps_rpe",
      intensitySource: "load_and_e1rm",
      estimatedFeiUncertainty: null,
      measuredForceEquivalentIntensity: null,
      forceRetention: null,
      velocityLoss: null,
      realizedVelocityRatio: null,
    },
  }));
  const events: SessionAdaptationEvent[] = [];
  for (let i = 0; i < bouts.length; ) {
    const bout = bouts[i];
    const options = {
      strengthTargetExerciseIds: [exerciseId],
      executionPrescription: inputs[i].executionPrescription,
      enduranceTaskZone: null,
      preSaturationVectorOverride: null,
      nativeDoseOverride: null,
      extraExplanationCodes: null,
    };
    if (bout.group && bout.structure) {
      let end = i + 1;
      while (end < bouts.length && bouts[end].group === bout.group) end++;
      const group = composeSetGroupAdaptation({
        structure: bout.structure,
        segments: bouts.slice(i, end).map((part, offset) => ({
          id: part.id,
          set: inputs[i + offset],
          restBeforeSeconds: offset === 0 ? null : part.restBeforeSeconds,
          // Already chronologically projected: do not apply group RPE drift twice.
          effortSource: "segment_specific",
        })),
        initialCarriedDepletion: null,
        readinessScore: null,
      });
      events.push(...sessionEventsForSetGroup(exerciseId, group, options));
      i = end;
    } else {
      events.push(
        sessionEventForSetAdaptation(
          exerciseId,
          bout.id,
          computeSetAdaptation(inputs[i]),
          { ...options, source: "set", costVectorOverride: null },
        ),
      );
      i++;
    }
  }
  const session = composeSessionAdaptation({
    events,
    orderSource: "prescribed_plan_order",
    domainModelVersion: SESSION_ADAPTATION_DOMAIN_MODEL_VERSION,
  });
  result.status = "estimated";
  result.benefits = session.accumulatedAdaptationVector;
  result.rawBenefits = session.preSaturationVector;
  result.costs = {
    central: session.accumulatedCostVector.lastingCentral,
    peripheral: session.accumulatedCostVector.localMuscular,
  };
  return result;
}
