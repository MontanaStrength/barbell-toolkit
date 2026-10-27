// Constants the analysis depends on. Anything marked "provisional" is a
// coaching decision that is expected to change; keep it in this file so a
// change is one edit, not a hunt.

export const N_TO_LBF = 0.22481;

export type LiftKey = "bench" | "squat" | "deadlift";

export interface LiftSpec {
  key: LiftKey;
  name: string;
  /** Recruitment reference line, as Effective Intensity (% of e1RM). */
  recruitLine: number;
  /** Default minimum velocity threshold (m/s). Lifters should set their own. */
  mvt: number;
}

// Per-lift recruitment lines: presses 85, squat and deadlift 90 (decided Oct 2026).
export const LIFTS: Record<LiftKey, LiftSpec> = {
  bench: { key: "bench", name: "Bench press", recruitLine: 85, mvt: 0.15 },
  squat: { key: "squat", name: "Back squat", recruitLine: 90, mvt: 0.3 },
  deadlift: { key: "deadlift", name: "Deadlift", recruitLine: 90, mvt: 0.15 },
};

export const LIFT_KEYS = Object.keys(LIFTS) as LiftKey[];

/** Population Force–Load line, Multiple = m·load% + b (probe-log spreadsheet, Models tab). */
export const POPULATION_FL = { m: -0.0114, b: 2.09 };

export type Goal = "power" | "strength" | "hypertrophy";

/**
 * Velocity stop:  v_stop = (1 − f) · v_fresh + f · MVT
 * f is how far toward MVT a set may slow before it ends.
 *
 * Power work sits below L* and strength work above it, so each takes one
 * fraction. Hypertrophy straddles L*: below it, light sets only recruit
 * high-threshold fibers if taken deep, so they get the deeper stop
 * (decided Oct 2026; starting values, adjust with coaching data).
 */
export interface StopFractions {
  power: number;
  strength: number;
  hypertrophyBelowLstar: number;
  hypertrophyAboveLstar: number;
}

export const STOP_FRACTION: StopFractions = {
  power: 0.2,
  strength: 0.3,
  hypertrophyBelowLstar: 0.6,
  hypertrophyAboveLstar: 0.4,
};

/** The fraction for a goal at a load, given L*. Without an L*, hypertrophy uses the above-L* value. */
export function stopFractionFor(goal: Goal, load: number, lstar: number | null, f: StopFractions = STOP_FRACTION): number {
  if (goal === "power") return f.power;
  if (goal === "strength") return f.strength;
  return lstar != null && load < lstar ? f.hypertrophyBelowLstar : f.hypertrophyAboveLstar;
}

/** Hanley neural-dose targets for a session block. */
export const NEURAL_TARGET: [number, number] = [350, 600];
export const STRENGTH_SWEET: [number, number] = [450, 600];

/** Hypertrophy proximity to failure, reps in reserve. */
export const HYP_RIR: [number, number] = [1, 3];

/**
 * Draft intent check (calibration model): the lowest Multiple a max-intent
 * single should reach at each load. Not approved for prescription; used
 * only to flag reps worth repeating.
 */
export const INTENT_FLOOR: Array<[number, number]> = [
  [60, 1.2],
  [70, 1.12],
  [80, 1.06],
  [88, 1.02],
];

/** Mean velocity-loss zones used for live feedback (% loss from the set's best rep). */
export const VL_ZONES = { ok: 15, caution: 20 };
