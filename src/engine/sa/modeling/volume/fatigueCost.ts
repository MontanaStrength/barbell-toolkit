// Fatigue cost — the cost half of the R × T model. Two channels, one event.
//
// A working set is one physical event read three ways: benefit (effectiveVolume,
// built), and the two cost channels here. Both are weightings of the same
// primitives (recruitment R, load-tension tLoad, load L, proximity RIR).
//
//   neuralSetCost(set)     = Σ_reps  R · tLoad^κ          # central/CNS drive — acute, GLOBAL
//   peripheralSetCost(set) = Σ_reps  L^a · prox(RIR)      # metabolite/structural — slow, PER-MUSCLE
//
// Why two, not one: a heavy over-L* cluster is high-benefit, real neural cost
// (fully recruited, high rate coding), low peripheral cost (never near failure);
// a light set to failure is the reverse. Collapse the axes and the model goes
// blind to what makes a protocol a good buy. The channels differ in kind — neural
// is fast-recovering and systemic, peripheral is slow-recovering and local — which
// is why the accounting (athleteState/volume/fatigueCostLedger) keys them
// differently: global-acute vs per-muscle-slow.
//
// This module is pure per-set math over load% + reps + RPE — the same universal
// signals the benefit side uses, no device. The per-muscle fan-out and the
// history/decay walk live in athleteState/volume, mirroring effectiveVolumeLedger.
//
// Supersedes calculateSetFatigueScore (neural) and calculateSetMetabolicLoad
// (peripheral). Prescription consumes these calibrated channels; the
// look-ahead conflict read (sessionGeneration/workoutPlan/nextSessionConflict)
// shares PERIPHERAL_HALF_LIFE_HOURS as the one decay constant.

import {
  rLoad,
  tLoad,
  type RecruitmentLiftClass,
} from './recruitmentCurve';
import {
  rFatigue,
  lowLoadGate,
  type EffectiveSetInput,
} from './effectiveVolume';
import { maxRepsAtIntensity } from '../strength/loadCurve';
import { GROUP_RECOVERY_CONFIG } from './groupRecovery';

/** Bump whenever either calibrated per-set cost channel changes. */
export const FATIGUE_COST_MODEL_VERSION =
  'fatigue-cost-a3-2026-07-17';

/**
 * Tunable seeds for the cost channels (Hanley's numbers — coaching calls). The
 * physiology is textbook (size principle, rate coding above the recruitment
 * ceiling, Group III/IV afferent feedback [Enoka & Duchateau 2017]); the
 * *quantification* here is the inductive leap, validated per-user by whether
 * strength holds and sessions feel right — the way T_AT_LSTAR and STIM_FULL_REPS
 * were. The wavy ones are flagged for that felt-sense / strength-day validation.
 */
export const COST_PARAMS = {
  /** κ — neural rate-coding exponent. Peak-weights the tension term so the
   *  heaviest, highest-intent reps dominate central drive. Seed 1.5; WAVY —
   *  validate against strength-day feel. */
  KAPPA: 1.5,
  /** Per-set neural saturation — how much each rep AFTER the hardest one adds to a
   *  set's central-drive cost. A set's cost is `peakDrive + NEURAL_TAIL_WEIGHT ·
   *  (Σ drive − peakDrive)`: establishing the drive (the peak rep) is most of the
   *  cost, sustaining it for more reps adds a discounted amount. Without this,
   *  neural cost is a raw per-rep sum and a 30-rep set out-scores 3 near-max singles
   *  on CNS cost purely by rep count — the cost analog of the benefit failure-ratio
   *  cap, which likewise stops raw reps from running away. Seed 0.4; WAVY — tune
   *  against felt sense (Hanley: 3 heavy singles ≈ slightly more than one back-off
   *  set). κ is deliberately left alone; this is the rep-count knob. */
  NEURAL_TAIL_WEIGHT: 0.5,
  /** Residue ramp: the fraction of a rep's central
   *  DRIVE that persists as lasting CNS COST. Crisp work far from failure
   *  leaves only the floor (drive practiced and released); the grind leaves
   *  everything (sustained maximal drive under III/IV afferent feedback).
   *  Linear ramp between RIR_FREE and RIR_FULL. All three WAVY. */
  CENTRAL_RESIDUE_FLOOR: 0.25,
  CENTRAL_RESIDUE_RIR_FREE: 3,
  CENTRAL_RESIDUE_RIR_FULL: 0.5,
  /** a — peripheral load exponent on L = load%/100. Seed 1 (near-linear in load);
   *  WAVY — validate against how metabolite/structural cost scales with load. */
  PERIPHERAL_LOAD_EXP: 1,
  /** Buildup exponent — how sharply peripheral cost per rep rises with accumulated
   *  fatigue (fraction-of-the-way-to-failure). Flat-then-steep; fit to the shape of
   *  Hanley's velocity-loss trace across an 18-rep set to failure (2026-07-03),
   *  which stayed low for ~11 reps then accelerated — a power curve ~2–2.5. Seed 2;
   *  WAVY. Replaces the old proximity decay K_PERIPHERAL_PROX: metabolite/damage
   *  keys off cumulative WORK done, not proximity to failure, so a lone heavy rep
   *  (no buildup) is peripherally cheap however close to failure it sits. */
  BUILDUP_EXP: 2,
  /** Peripheral half-life (hours) for the slow per-muscle decay in the accounting
   *  ledger (stage 2). 36 = the existing METABOLIC_HALFLIFE_HOURS. */
  PERIPHERAL_HALF_LIFE_HOURS: 36,
  /** carriedDepletion inference for logged technique mini-sets (clusters, drops,
   *  rest-pause, myo). A grouped continuation set starts already fatigued; carry
   *  accrues per prior set in the group, discounted by the rest actually taken.
   *  Seeds land the myo mini-sets near their measured ~0.85 (deep, ~22 s rest)
   *  and cluster triples near ~0.35. All WAVY. */
  CARRY_PER_PRIOR_GROUP_SET:
    GROUP_RECOVERY_CONFIG.depletionPerCompletedSegment,
  /** Rest (s) at/above which intra-group carry is fully cleared. */
  CARRY_FULL_RECOVERY_SEC: GROUP_RECOVERY_CONFIG.fullRecoverySeconds,
  /** Cap on inferred carry. */
  CARRY_MAX: GROUP_RECOVERY_CONFIG.maximumCarriedDepletion,
  /** Rest-retention assumed when a grouped set has no logged rest — grouping
   *  implies a short-rest technique protocol, so assume most carry is retained. */
  CARRY_DEFAULT_RETENTION:
    GROUP_RECOVERY_CONFIG.missingRestRetainedFraction,
  /** Acute neural recovery half-life (hours) for the global neural tally. Faster
   *  than peripheral because central drive recovers in hours and trained lifters
   *  are protected — it does not accumulate as multi-day state. In-house seed 24,
   *  WAVY; NOT an Enoka constant (the earlier "Neural 24h" Enoka attribution was
   *  the misattribution this model corrects — Enoka gives the taxonomy, not the
   *  number). */
  NEURAL_ACUTE_HALF_LIFE_HOURS: 24,

  /** The FAST clock — decay of the strength-EXPRESSION drag (afferent brake).
   *  Hanley's probe's dip-then-recovery
   *  (P1 −15% @ 24 h, recovered @ 48 h, ~0 @ 84 h) puts this at ~12–16 h,
   *  decoupled from the 36 h structural half-life. Seeded at the midpoint;
   *  WAVY. The fleet shadow fit (afferent-shadow-fit.ts --fleet, 2026-07-17)
   *  could not yet beat a zero-drag control on in-app e1RM residuals (n too
   *  small), so this stays probe-seeded until a real fit supersedes it on
   *  Hanley's word. Consumed by the look-ahead's "will this compromise the
   *  next session's strength expression?" question (nextSessionConflict). */
  AFFERENT_HALF_LIFE_HOURS: 15,
  /** Bounded dose-response ceiling: max fractional strength-expression
   *  drag as residual dose → ∞. Probe depth anchor: P1 read −15% at 24 h.
   *  WAVY; fit-supersedable. */
  AFFERENT_DRAG_DMAX: 0.15,
  /** Bounded dose-response steepness per hse of residual dose. Initial slope
   *  dMax·β ≈ 0.0255 /hse matches the reviewed stand-in (~0.025 fractional
   *  loss per hse). WAVY. */
  AFFERENT_DRAG_BETA: 0.17,
  /** Soft-max temperature for the limiting-muscle roll-up — how much a
   *  single most-dragged mover gates the movement vs blending toward the
   *  mean. Secondary movers at 0.5 credit add low-drag entries; 0.02 keeps
   *  the most-dragged mover limiting while damping one noisy reading. WAVY. */
  AFFERENT_SOFTMAX_SOFTNESS: 0.02,
  /** Eccentric-accentuated damage multiplier. Extended eccentrics add structural damage
   *  the concentric-velocity-derived buildup term can't see, and damage IS
   *  peripheral, so the constant's home is the cost model. The sizing gate
   *  references this value; `peripheralSetDose` uses it as the
   *  muscleDisruption dose feature. WAVY. */
  ECCENTRIC_DAMAGE_MULTIPLIER: 1.4,
  // ── Deferred: seeded in one parameter home, not yet consumed. ──
  /** Afferent penalty: strength-day quality charged per unit of recent peripheral
   *  cost in the same movers (the mechanism by which too much hypertrophy volume
   *  costs strength). Seed 0.3 (the Enoka-alignment afferent coefficient); WAVY —
   *  the biggest leap, validate against real strength-day performance. */
  AFFERENT_COEFF: 0.3,
  /** Collateral channel weights — reconcile the channels' scales in the selection
   *  rule (the job dualChannelCalibration does today). Seed 1 each; the calibrated
   *  wrappers below already pin each channel to a shared reference, so these start
   *  neutral and tune from real data. */
  W_NEURAL: 1,
  W_PERIPHERAL: 1,
  W_AFFERENT: 1,
} as const;

/**
 * Recruitment gate for one rep — how much of the prime mover's high-threshold
 * pool is firing. Identical to the benefit side's gate (effectiveVolume's
 * repStimulus): either route — load (rLoad, above L*) or fatigue (rFatigue, near
 * failure) — opens it, times the very-light-load gate. Composed from the exported
 * primitives so there is one definition of "recruitment"; null lift class has no
 * load route. Kept local (not imported from effectiveVolume) to leave that
 * prescription-load-bearing file untouched.
 */
export function recruitmentGate(
  intensityPct: number,
  rir: number,
  liftClass: RecruitmentLiftClass | null,
): number {
  const loadR = liftClass != null ? rLoad(intensityPct, liftClass) : 0;
  return Math.max(loadR, rFatigue(rir)) * lowLoadGate(intensityPct);
}

/** Per-rep terminal-relative RIR ladder + intensity clamp, shared by both
 *  channels so a set's reps carry the same proximity in cost as in benefit. */
export function terminalRir(rpe: number): number {
  return Math.min(9, Math.max(0, 10 - rpe));
}

/**
 * Neural cost of one set — central/CNS drive. GLOBAL (a scalar, not per-muscle):
 * CNS fatigue is systemic. Per rep the drive is R · tLoad^κ, where the tension term
 * is tLoad *only* (the load-route rate-coding ramp — invariant #5, T symmetric
 * across ledgers), NOT max(tLoad, tFatigue): the grind's near-failure tension is a
 * peripheral phenomenon, and its central cost is acute anyway. tLoad climbs with
 * load above L* toward 1RM, so heavy submax work (a cluster) pays its central bill
 * even with no near-failure reps — exactly the case the old M-weighted formula
 * under-charged.
 *
 * The set's cost is NOT the raw Σ of those drives — it SATURATES: `peakDrive +
 * NEURAL_TAIL_WEIGHT · (Σ drive − peakDrive)`. Establishing the drive (the hardest
 * rep) is most of the central-drive cost; sustaining it for more reps adds a
 * discounted amount. A raw sum lets rep count run away — a 30-rep set out-scores 3
 * near-max singles on CNS cost — so this is the cost analog of the benefit
 * failure-ratio cap. It damps reps WITHIN a set only; across sets each set's peak
 * counts in full (four sets are four efforts).
 *
 * Null lift class → 0: single-joint / non-classed lifts have no population
 * force curve, so their central-drive cost is uncharacterised and priced on the
 * peripheral channel alone.
 */
export function neuralSetCost(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  const reps = Math.floor(set.reps);
  if (reps <= 0 || set.intensityPct <= 0 || !Number.isFinite(set.intensityPct)) return 0;
  if (liftClass == null) return 0;

  const intensityPct = Math.min(100, set.intensityPct);
  const tRir = terminalRir(set.rpe);
  const tension = Math.pow(tLoad(intensityPct, liftClass), COST_PARAMS.KAPPA);

  let sum = 0;
  let peak = 0;
  for (let i = 1; i <= reps; i++) {
    const rir = tRir + (reps - i);
    const drive = recruitmentGate(intensityPct, rir, liftClass) * tension;
    sum += drive;
    if (drive > peak) peak = drive;
  }
  return peak + COST_PARAMS.NEURAL_TAIL_WEIGHT * (sum - peak);
}

/**
 * Residue fraction: how much of a rep's central drive persists as lasting
 * CNS cost, by that rep's RIR. Floor at/beyond CENTRAL_RESIDUE_RIR_FREE,
 * full residue at/below CENTRAL_RESIDUE_RIR_FULL, linear between.
 */
export function centralResidueFraction(rir: number): number {
  const floor = COST_PARAMS.CENTRAL_RESIDUE_FLOOR;
  const free = COST_PARAMS.CENTRAL_RESIDUE_RIR_FREE;
  const full = COST_PARAMS.CENTRAL_RESIDUE_RIR_FULL;
  if (rir >= free) return floor;
  if (rir <= full) return 1;
  return floor + (1 - floor) * ((free - rir) / (free - full));
}

/**
 * Lasting central-fatigue COST of one set. The demand
 * measure above (`neuralSetCost`) prices how much central drive the set
 * REQUIRED — which is mostly a good: it is the strength-practice exposure a
 * strength day exists to deliver, and the strength-practice unit sizes
 * against it. This function prices what the set leaves BEHIND: each rep's drive
 * scaled by the proximity-keyed residue ramp, saturated per set the same way
 * (establishing residue costs most; sustaining it adds the tail). A crisp
 * heavy triple @ RPE 7 is high demand / near-floor cost; a grinding RPE 9.5
 * single is both. The weekly per-pattern ceiling reads THIS, not demand, so
 * the moderation throttles what actually accumulates instead of penalizing
 * quality practice.
 */
export function centralFatigueSetCost(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  const reps = Math.floor(set.reps);
  if (reps <= 0 || set.intensityPct <= 0 || !Number.isFinite(set.intensityPct)) return 0;
  if (liftClass == null) return 0;

  const intensityPct = Math.min(100, set.intensityPct);
  const tRir = terminalRir(set.rpe);
  const tension = Math.pow(tLoad(intensityPct, liftClass), COST_PARAMS.KAPPA);

  let sum = 0;
  let peak = 0;
  for (let i = 1; i <= reps; i++) {
    const rir = tRir + (reps - i);
    const residue = recruitmentGate(intensityPct, rir, liftClass) * tension * centralResidueFraction(rir);
    sum += residue;
    if (residue > peak) peak = residue;
  }
  return peak + COST_PARAMS.NEURAL_TAIL_WEIGHT * (sum - peak);
}

/** Options for peripheral pricing. */
export interface PeripheralOpts {
  /** Fatigue carried into this set from short-rested prior work — myo mini-sets,
   *  clusters, drop sets — as a starting fraction-of-the-way-to-failure in [0,1).
   *  0 (default) = a fresh set after full rest, i.e. a straight set. Higher means
   *  the set BEGINS deep on the buildup curve, so even a few reps sit in the
   *  metabolite-rich zone. This is what makes a 3-rep myo mini-set peripherally
   *  expensive (short but not fresh) while a fresh heavy triple is not. The caller
   *  (ledger / optimizer) supplies it from the protocol's rest structure. */
  carriedDepletion: number | null;
}

/** Buildup weight for one rep — how metabolite-rich / damaging this rep is, from
 *  the fatigue accumulated *entering* it. `depletion` is fraction-of-the-way-to-
 *  failure in [0,1]; a fresh first rep (depletion 0) contributes ~nothing, the
 *  curve rising flat-then-steep toward failure (BUILDUP_EXP). This is the cost
 *  analog of the size-principle insight on the benefit side: proximity is the
 *  wrong axis for a lone heavy rep; cumulative work is the right one. */
function buildup(depletion: number): number {
  return Math.pow(Math.min(1, Math.max(0, depletion)), COST_PARAMS.BUILDUP_EXP);
}

/**
 * Peripheral cost of one set — metabolite pooling and structural/eccentric damage.
 * PER-MUSCLE (fanned out by the muscle map in the accounting ledger; this is the
 * base scalar before fan-out). Σ over reps of L^a · buildup_i, where L = load%/100
 * and buildup_i keys off cumulative fatigue entering rep i:
 *
 *   depletion_i = carriedDepletion + (i − 1) / maxRepsAtIntensity(load)
 *
 * i.e. how far this set has traveled toward failure by rep i — reps already done
 * over reps-to-failure at the load, offset by any fatigue carried in. RECRUITMENT-
 * INDEPENDENT (no R gate, no lift class) and RPE-INDEPENDENT (proximity to failure
 * is emergent from reps÷capacity + carry, not a separate input): a set under load
 * accrues local cost from the WORK done, not from how close a single rep sits to
 * failure. So a light set to failure is peripherally expensive and neurally cheap;
 * a fresh heavy single is neurally real and peripherally ~free.
 */
export function peripheralSetCost(set: EffectiveSetInput, opts: PeripheralOpts): number {
  const reps = Math.floor(set.reps);
  if (reps <= 0 || set.intensityPct <= 0 || !Number.isFinite(set.intensityPct)) return 0;

  const intensityPct = Math.min(100, set.intensityPct);
  const load = Math.pow(intensityPct / 100, COST_PARAMS.PERIPHERAL_LOAD_EXP);
  const maxReps = Math.max(1, maxRepsAtIntensity(intensityPct));
  const carry = Math.min(0.999, Math.max(0, opts.carriedDepletion ?? 0));

  let sum = 0;
  for (let i = 1; i <= reps; i++) {
    sum += load * buildup(carry + (i - 1) / maxReps);
  }
  return sum;
}

// ── Scale calibration ──────────────────────────────────────────────────────
// Mirrors dualChannelCalibration: the two channels come from different weightings
// and their raw magnitudes aren't comparable, so pin each to a reference set of
// its own kind — "one hard set" on that channel. After calibration, a cross-channel
// read ("this session is neural-dominant") has meaning; the collateral weights
// (COST_PARAMS.W_*) tune from there. The optimizer's raw contract keeps the raw
// functions.
//
// The channels no longer share ONE reference set: the neural anchor is a hard
// strength-ish set (5×80×RPE8, dualChannelCalibration's set), but that set is
// fresh and two shy of failure, so its BUILDUP is almost nil — it can't anchor
// peripheral without making the denominator tiny and every other set explode. The
// peripheral anchor is instead a hard set taken to failure (11×70), the canonical
// "one hard hypertrophy set". So a fresh strength set legitimately reads
// neural-leaning and a set to failure reads peripheral-leaning — as they should.

/** Neural anchor — the textbook hard strength set (dualChannelCalibration's set). */
export const COST_REFERENCE_SET: EffectiveSetInput = {
  reps: 5,
  intensityPct: 80,
  rpe: 8,
} as const;

/** Peripheral anchor — one hard hypertrophy set to failure (≈ maxRepsAtIntensity
 *  at 70%), which actually accrues buildup. */
export const COST_PERIPHERAL_REFERENCE_SET: EffectiveSetInput = {
  reps: 11,
  intensityPct: 70,
  rpe: 10,
} as const;

/** Lift class the neural reference is priced on (peripheral is class-free). */
export const COST_REFERENCE_LIFT_CLASS: RecruitmentLiftClass = 'upper-press';

/** The calibrated cost each channel produces for its reference set. */
export const COST_REFERENCE_LOAD = 100;

const neuralRefRaw = neuralSetCost(COST_REFERENCE_SET, COST_REFERENCE_LIFT_CLASS);
const peripheralRefRaw = peripheralSetCost(COST_PERIPHERAL_REFERENCE_SET, { carriedDepletion: null });

/** Multiplier bringing raw neural cost onto the calibrated scale. */
export const NEURAL_COST_CALIBRATION = COST_REFERENCE_LOAD / neuralRefRaw;

/** Multiplier bringing raw peripheral cost onto the calibrated scale. */
export const PERIPHERAL_COST_CALIBRATION = COST_REFERENCE_LOAD / peripheralRefRaw;

/** Calibrated neural DEMAND (shared currency) for one set — how much central
 *  drive the set required. This is the practice/specificity measure; the
 *  lasting cost the ceilings gate is
 *  `calibratedCentralFatigueCost`. */
export function calibratedNeuralCost(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  return neuralSetCost(set, liftClass) * NEURAL_COST_CALIBRATION;
}

const centralFatigueRefRaw = centralFatigueSetCost(COST_REFERENCE_SET, COST_REFERENCE_LIFT_CLASS);

/** Multiplier bringing raw central-fatigue cost onto the calibrated scale.
 *  Same convention as the other channels: the shared reference set (5 @ 80%
 *  @ RPE 8 — terminal RIR 2, mid-ramp residue) prices at 100 on the COST
 *  scale too, so the existing weekly pattern ceilings keep their meaning for
 *  reference-like work; crisp weeks price under it and grind weeks over it.
 *  `scripts/analysis/neural-cost-translation.ts` verifies continuity within
 *  10%. */
export const CENTRAL_FATIGUE_COST_CALIBRATION = COST_REFERENCE_LOAD / centralFatigueRefRaw;

/** Calibrated lasting central-fatigue cost (shared currency) for one set. */
export function calibratedCentralFatigueCost(
  set: EffectiveSetInput,
  liftClass: RecruitmentLiftClass | null,
): number {
  return centralFatigueSetCost(set, liftClass) * CENTRAL_FATIGUE_COST_CALIBRATION;
}

/** Calibrated peripheral cost (shared currency) for one set. */
export function calibratedPeripheralCost(set: EffectiveSetInput, opts: PeripheralOpts): number {
  return peripheralSetCost(set, opts) * PERIPHERAL_COST_CALIBRATION;
}

/** A set's peripheral dose decomposed into the features the two slow-side
 *  consumers read: `buildupHse` — the
 *  metabolite/proximity buildup cost, the afferentDrag dose — and
 *  `eccentricDamageHse` — the structural-damage surcharge, the
 *  muscleDisruption dose feature (eccentric emphasis only in v1). Both in
 *  hard-set-equivalents (one 11×70-to-failure set = 1.0). */
export interface PeripheralDose {
  buildupHse: number;
  eccentricDamageHse: number;
}

/**
 * Decomposed peripheral dose for one set. OBSERVABILITY GAP, recorded
 * honestly: logged sets carry no tempo metadata, so a ledger walking SetLogs
 * cannot detect eccentric emphasis and must pass `eccentricAccentuated:
 * false` — the muscleDisruption dose is currently only computable at PLAN
 * time (where the scheme is known). Until tempo persists to logs, the slow
 * disruption ledger stays plan-side scaffold; the buildup half is fully live.
 */
export function peripheralSetDose(
  set: EffectiveSetInput,
  opts: PeripheralOpts & { eccentricAccentuated: boolean | null },
): PeripheralDose {
  const buildupHse = (peripheralSetCost(set, opts) * PERIPHERAL_COST_CALIBRATION) / 100;
  return {
    buildupHse,
    eccentricDamageHse: opts.eccentricAccentuated === true
      ? buildupHse * (COST_PARAMS.ECCENTRIC_DAMAGE_MULTIPLIER - 1)
      : 0,
  };
}
