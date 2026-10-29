// Effective sets: Strength Architect's R × T pricing of hypertrophy stimulus,
// ported from modeling/volume (recruitmentCurve.ts, effectiveVolume.ts,
// sessionAdaptation.ts; origin/main, Oct 29, 2026; model versions
// recruitment-curve-2026-07-01, effective-volume-rt-2026-07-02,
// session-adaptation-v1). The equations and seeds are SA's. One change: SA
// reads L* off a population curve per lift class; here it is the lifter's
// own, from the probe. Without an L*, only the fatigue route prices, as SA
// does for a lift with no curve.
//
// Per rep, stimulus = R × T. R asks whether the high-threshold units are in
// play; T asks how hard they are firing. Each takes the stronger of two
// routes: the load (above L*) or proximity to failure. A set's credit is its
// reps summed, over what the same load taken to RIR 2 would earn, capped at
// reps/5. A session's credit adds the sets through a curve that bends after
// the first full set.

import { maxRepsAt } from "./effort";

export const RT = {
  /** Tension at L*, the bottom of the rate-coding ramp. */
  T_AT_LSTAR: 0.6,
  /** Half-width of the blend around L*, load points. */
  LSTAR_BAND: 5,
  /** Decay per rep of the recruitment gate beyond RIR 2, on the fatigue route. */
  K_R: 0.6,
  /** Decay per rep of grind tension beyond RIR 1. */
  K_T: 0.35,
  /** Below this load even near-failure work may not reach the high-threshold pool. */
  LOW_LOAD: [30, 40] as const,
  /** Reps at and above which a hard set earns full credit; shorter sets earn reps/this. */
  STIM_FULL_REPS: 5,
  REP_CAP: 30,
  /** Session value: the first full set in full, then 1 + S·ln(1 + (dose − 1)/S). */
  SESSION_LOG_SCALE: 4,
  /** Share of the dose a secondary muscle receives. */
  SECONDARY: 0.5,
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The load route of the recruitment gate: 0 well below L*, 1 above, blended over L* ± 5. */
export const rLoad = (pct: number, lstar: number | null) =>
  lstar == null ? 0 : smooth((pct - (lstar - RT.LSTAR_BAND)) / (2 * RT.LSTAR_BAND));

/** The load route of tension: 0.6 at L* rising to 1 at 100%; below L*, falling toward 0. */
export function tLoad(pct: number, lstar: number | null): number {
  if (lstar == null) return 0;
  if (pct >= 100) return 1;
  if (pct >= lstar) return RT.T_AT_LSTAR + (1 - RT.T_AT_LSTAR) * ((pct - lstar) / (100 - lstar));
  return Math.max(0, RT.T_AT_LSTAR * (pct / lstar));
}

/** The fatigue route of recruitment: full at RIR 2 and under. */
export const rFatigue = (rir: number) => (rir <= 2 ? 1 : Math.exp(-RT.K_R * (rir - 2)));
/** The fatigue route of tension: full at RIR 1 and under. */
export const tFatigue = (rir: number) => (rir <= 1 ? 1 : Math.exp(-RT.K_T * (rir - 1)));
export const lowLoadGate = (pct: number) => smooth((pct - RT.LOW_LOAD[0]) / (RT.LOW_LOAD[1] - RT.LOW_LOAD[0]));

export interface RepStimulus {
  rir: number;
  r: number;
  t: number;
  /** Which route carried R: the stronger one. */
  rRoute: "load" | "fatigue";
  tRoute: "load" | "fatigue";
  stimulus: number;
}

export function repStimulus(pct: number, rir: number, lstar: number | null): RepStimulus {
  const lr = rLoad(pct, lstar);
  const fr = rFatigue(rir);
  const lt = tLoad(pct, lstar);
  const ft = tFatigue(rir);
  const r = Math.max(lr, fr) * lowLoadGate(pct);
  const t = Math.max(lt, ft);
  return { rir, r, t, rRoute: lr >= fr ? "load" : "fatigue", tRoute: lt >= ft ? "load" : "fatigue", stimulus: r * t };
}

/** Rep by rep, a set of `reps` at a load that ends at `terminalRir`. */
export function setStimuli(reps: number, pct: number, terminalRir: number, lstar: number | null): RepStimulus[] {
  return Array.from({ length: reps }, (_, i) => repStimulus(pct, terminalRir + (reps - 1 - i), lstar));
}

export interface SetCredit {
  reps: number;
  pct: number;
  rpe: number;
  terminalRir: number;
  stimuli: RepStimulus[];
  raw: number;
  /** The reference: the same load taken to RIR 2. */
  reference: RepStimulus[];
  referenceRaw: number;
  /** raw ÷ reference. */
  ratio: number;
  /** reps ÷ 5, at most 1. */
  cap: number;
  credit: number;
  capped: boolean;
  /** The route most of the set's R came through. */
  route: "load" | "fatigue" | "none";
}

/** SA's effectiveSetCredit, keeping every intermediate. */
export function setCredit(reps: number, pctIn: number, rpe: number, lstar: number | null): SetCredit {
  const pct = Math.min(100, pctIn);
  const terminalRir = Math.min(9, Math.max(0, 10 - rpe));
  const stimuli = reps > 0 && pct > 0 ? setStimuli(reps, pct, terminalRir, lstar) : [];
  const raw = stimuli.reduce((s, x) => s + x.stimulus, 0);
  const denomReps = Math.min(RT.REP_CAP, Math.max(1, Math.floor(maxRepsAt(pct) - 2)));
  const reference = pct > 0 ? setStimuli(denomReps, pct, 2, lstar) : [];
  const referenceRaw = reference.reduce((s, x) => s + x.stimulus, 0);
  const ratio = referenceRaw > 0 ? raw / referenceRaw : 0;
  const cap = Math.min(1, reps / RT.STIM_FULL_REPS);
  const credit = Math.min(cap, ratio);
  const byLoad = stimuli.filter((x) => x.rRoute === "load" && x.r > 0).length;
  const byFatigue = stimuli.filter((x) => x.rRoute === "fatigue" && x.r > 0).length;
  return {
    reps,
    pct,
    rpe,
    terminalRir,
    stimuli,
    raw,
    reference,
    referenceRaw,
    ratio,
    cap,
    credit,
    capped: ratio > cap,
    route: raw <= 1e-9 ? "none" : byLoad >= byFatigue ? "load" : "fatigue",
  };
}

/** SA's hypertrophy session value: a shifted log after the first full set. */
export function sessionValue(dose: number): number {
  if (dose <= 1) return Math.max(0, dose);
  return 1 + RT.SESSION_LOG_SCALE * Math.log1p((dose - 1) / RT.SESSION_LOG_SCALE);
}

export interface PricedSet extends SetCredit {
  /** Position in the session, 1-based, and the set it came from. */
  n: number;
  group: string;
  /** A mini-set within a cluster. */
  part?: number;
  rawBefore: number;
  rawAfter: number;
  creditedBefore: number;
  creditedAfter: number;
  /** What this set added to the session after diminishing returns. */
  marginal: number;
}

export interface SessionPricing {
  sets: PricedSet[];
  raw: number;
  credited: number;
  /** The secondary muscles' credit, at half the dose. */
  secondary: number;
  /** Some sets couldn't be priced (timed work). */
  partial: boolean;
}

/** One rep-counted set as the pricer needs it; parts for a cluster's mini-sets. */
export interface PriceInput {
  n: number;
  group: string;
  pct: number;
  rpe: number;
  parts: number[] | null;
}

export function priceSession(inputs: PriceInput[], lstar: number | null): SessionPricing {
  const sets: PricedSet[] = [];
  let raw = 0;
  let partial = false;
  for (const s of inputs) {
    if (!s.parts) {
      partial = true;
      continue;
    }
    s.parts.forEach((reps, i) => {
      const c = setCredit(reps, s.pct, s.rpe, lstar);
      const rawBefore = raw;
      raw += c.credit;
      sets.push({
        ...c,
        n: s.n,
        group: s.group,
        part: s.parts!.length > 1 ? i + 1 : undefined,
        rawBefore,
        rawAfter: raw,
        creditedBefore: sessionValue(rawBefore),
        creditedAfter: sessionValue(raw),
        marginal: sessionValue(raw) - sessionValue(rawBefore),
      });
    });
  }
  return { sets, raw, credited: sessionValue(raw), secondary: sessionValue(raw * RT.SECONDARY), partial };
}
