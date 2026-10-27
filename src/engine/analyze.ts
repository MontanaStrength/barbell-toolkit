import { LIFTS, N_TO_LBF, POPULATION_FL, STOP_FRACTION, stopFractionFor, type Goal, type LiftKey, type StopFractions } from "./constants";
import { intentFloor, stopVelocity } from "./metrics";
import { computeProfile, type Profile } from "./profile";
import { mean, pearson, sd, solveLstar } from "./stats";

export type Phase = "ladder" | "amrap";

/** One logged rep, in the probe-log format. */
export interface Rep {
  round: number;
  date?: string;
  phase: Phase;
  /** Planned load as % of e1RM (the protocol step), if logged. */
  target: number | null;
  /** Bar weight actually lifted (lb). */
  lb: number;
  set: number;
  rep: number;
  forceN: number;
  meanV: number | null;
  peakV: number | null;
}

export interface Probe {
  lift: LiftKey;
  e1rm: number;
  mvt: number;
  recruitLine: number;
  reps: Rep[];
}

/** Which load each rep is plotted at. */
export type LoadAxis = "actual" | "target";

export interface RoundValue {
  round: number;
  mult: number;
  v: number | null;
  /** True when the value comes from ladder (fresh, max-intent) reps. */
  clean: boolean;
}

export interface LoadPoint {
  key: string;
  target: number | null;
  lb: number;
  load: number;
  mult: number;
  v: number | null;
  rounds: RoundValue[];
  sd: number | null;
  cv: number | null;
}

export interface DecayRep {
  rep: number;
  surplus: number;
  meanV: number | null;
  peakV: number | null;
  meanVL: number | null;
  peakVL: number | null;
}

export interface DecaySet {
  id: string;
  round: number;
  date?: string;
  lb: number;
  load: number;
  set: number;
  reps: DecayRep[];
  freshCeiling: number;
  corrMean: number | null;
  corrPeak: number | null;
}

export interface Flag {
  level: "warn" | "info";
  text: string;
}

export interface Analysis extends Profile {
  probe: Probe;
  axis: LoadAxis;
  loadPoints: LoadPoint[];
  lstarPop: number | null;
  decaySets: DecaySet[];
  decayDefault: string | null;
  decoupling: { n: number; corrMean: number | null; corrPeak: number | null };
  stopsAtTested: Array<{ load: number; lb: number; v: number | null } & Record<Goal, number | null>>;
  flags: Flag[];
}

export const multipleOf = (r: Rep) => (r.forceN * N_TO_LBF) / r.lb;
export const pointKey = (r: Rep) => (r.target != null ? `t${r.target}` : `lb${r.lb}`);

/** Fresh reading for one load in one round: best ladder rep, else the AMRAP's opening reps. */
export function roundValue(reps: Rep[]): { mult: number; v: number | null; clean: boolean; used: Rep[] } | null {
  const ladder = reps.filter((r) => r.phase === "ladder");
  const used = ladder.length
    ? ladder
    : reps
        .filter((r) => r.phase === "amrap")
        .sort((a, b) => a.set - b.set || a.rep - b.rep)
        .slice(0, 3);
  if (!used.length) return null;
  const vs = used.map((r) => r.meanV).filter((v): v is number => v != null);
  return {
    mult: Math.max(...used.map(multipleOf)),
    v: vs.length ? Math.max(...vs) : null,
    clean: ladder.length > 0,
    used,
  };
}

export function buildLoadPoints(probe: Probe, axis: LoadAxis = "actual"): LoadPoint[] {
  const groups = new Map<string, Rep[]>();
  for (const r of probe.reps) {
    if (!(r.lb > 0) || !(r.forceN > 0)) continue;
    const k = pointKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: LoadPoint[] = [];
  for (const [key, reps] of groups) {
    const rounds = [...new Set(reps.map((r) => r.round))].sort((a, b) => a - b);
    const values: RoundValue[] = [];
    const usedReps: Rep[] = [];
    for (const rnd of rounds) {
      const rv = roundValue(reps.filter((r) => r.round === rnd));
      if (rv) {
        values.push({ round: rnd, mult: rv.mult, v: rv.v, clean: rv.clean });
        usedReps.push(...rv.used);
      }
    }
    if (!values.length) continue;
    // Fresh value: mean of clean (ladder) rounds; fall back to AMRAP openers.
    const clean = values.filter((v) => v.clean);
    const basis = clean.length ? clean : values;
    const mults = basis.map((v) => v.mult);
    const vels = basis.map((v) => v.v).filter((v): v is number => v != null);
    const basisRounds = new Set(basis.map((b) => b.round));
    const basisLb = mean(usedReps.filter((r) => basisRounds.has(r.round)).map((r) => r.lb))!;
    const target = reps[0].target;
    const m = mean(mults)!;
    const s = sd(mults);
    out.push({
      key,
      target,
      lb: basisLb,
      load: axis === "target" && target != null ? target : (basisLb / probe.e1rm) * 100,
      mult: m,
      v: mean(vels),
      rounds: values,
      sd: s,
      cv: s != null ? s / m : null,
    });
  }
  return out.sort((a, b) => a.load - b.load);
}

export function buildDecaySets(probe: Probe): DecaySet[] {
  const groups = new Map<string, Rep[]>();
  for (const r of probe.reps) {
    if (r.phase !== "amrap" || !(r.lb > 0) || !(r.forceN > 0)) continue;
    const k = `${r.round}|${r.lb}|${r.set}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const sets: DecaySet[] = [];
  for (const [id, reps] of groups) {
    reps.sort((a, b) => a.rep - b.rep);
    const surplus = reps.map((r) => (multipleOf(r) - 1) * 100);
    const maxMean = Math.max(...reps.map((r) => r.meanV ?? -Infinity));
    const maxPeak = Math.max(...reps.map((r) => r.peakV ?? -Infinity));
    const rows: DecayRep[] = reps.map((r, i) => ({
      rep: r.rep,
      surplus: surplus[i],
      meanV: r.meanV,
      peakV: r.peakV,
      meanVL: r.meanV != null && maxMean > 0 ? (1 - r.meanV / maxMean) * 100 : null,
      peakVL: r.peakV != null && maxPeak > 0 ? (1 - r.peakV / maxPeak) * 100 : null,
    }));
    const means = rows.map((r) => r.meanV);
    const peaks = rows.map((r) => r.peakV);
    sets.push({
      id,
      round: reps[0].round,
      date: reps[0].date,
      lb: reps[0].lb,
      load: (reps[0].lb / probe.e1rm) * 100,
      set: reps[0].set,
      reps: rows,
      freshCeiling: Math.max(...surplus),
      corrMean: means.every((v) => v != null) ? pearson(surplus, means as number[]) : null,
      corrPeak: peaks.every((v) => v != null) ? pearson(surplus, peaks as number[]) : null,
    });
  }
  return sets.sort((a, b) => a.round - b.round || a.lb - b.lb || a.set - b.set);
}

/** Default set to show: the longest AMRAP in the latest round that has one. */
export function defaultDecaySet(sets: DecaySet[]): string | null {
  if (!sets.length) return null;
  const latest = Math.max(...sets.map((s) => s.round));
  const pool = sets.filter((s) => s.round === latest);
  return pool.reduce((best, s) => (s.reps.length > best.reps.length ? s : best)).id;
}

/**
 * Decoupling across every AMRAP set (the v4 sheet's method): for reps after
 * the first, correlate surplus loss with mean- and peak-velocity loss, each
 * measured from the set's own best rep.
 */
export function decoupling(sets: DecaySet[]) {
  const sl: number[] = [];
  const ml: number[] = [];
  const pl: number[] = [];
  for (const s of sets) {
    const maxS = Math.max(...s.reps.map((r) => r.surplus));
    for (const r of s.reps) {
      if (r.rep <= 1 || r.meanVL == null || r.peakVL == null || maxS <= 0) continue;
      sl.push(1 - r.surplus / maxS);
      ml.push(r.meanVL / 100);
      pl.push(r.peakVL / 100);
    }
  }
  return { n: sl.length, corrMean: pearson(sl, ml), corrPeak: pearson(sl, pl) };
}

export function analyze(probe: Probe, opts: { axis?: LoadAxis; stops?: StopFractions } = {}): Analysis {
  const axis = opts.axis ?? "actual";
  const stops = opts.stops ?? STOP_FRACTION;
  const loadPoints = buildLoadPoints(probe, axis);
  const profile = computeProfile({
    e1rm: probe.e1rm,
    mvt: probe.mvt,
    recruitLine: probe.recruitLine,
    points: loadPoints.map((p) => ({ load: p.load, mult: p.mult, v: p.v })),
    stops,
  });
  const decaySets = buildDecaySets(probe);

  const stopsAtTested = loadPoints.map((p) => ({
    load: p.load,
    lb: p.lb,
    v: p.v,
    power: stopVelocity(p.v, probe.mvt, stops.power),
    strength: stopVelocity(p.v, probe.mvt, stops.strength),
    hypertrophy: stopVelocity(p.v, probe.mvt, stopFractionFor("hypertrophy", p.load, profile.lstar, stops)),
  }));

  return {
    ...profile,
    probe,
    axis,
    loadPoints,
    lstarPop: solveLstar(POPULATION_FL.m, POPULATION_FL.b, probe.recruitLine),
    decaySets,
    decayDefault: defaultDecaySet(decaySets),
    decoupling: decoupling(decaySets),
    stopsAtTested,
    flags: qualityFlags(loadPoints, profile),
  };
}

function qualityFlags(points: LoadPoint[], p: Profile): Flag[] {
  const flags: Flag[] = [];
  if (points.length < 3) {
    flags.push({ level: "warn", text: `Only ${points.length} load${points.length === 1 ? "" : "s"} tested. The fit needs at least three; four is the protocol.` });
  }
  if (p.fl.r2 != null && p.fl.r2 < 0.9) {
    flags.push({ level: "warn", text: `The Force–Load line explains ${(p.fl.r2 * 100).toFixed(0)}% of the spread (R² ${p.fl.r2.toFixed(2)}). Treat L* as rough.` });
  }
  for (const pt of points) {
    const floor = intentFloor(pt.load);
    if (floor != null && pt.rounds.some((r) => r.clean) && pt.mult < floor) {
      flags.push({ level: "warn", text: `At ${pt.load.toFixed(0)}% the best Multiple is ${pt.mult.toFixed(2)}, under the ${floor.toFixed(2)} a max-intent single usually reaches. Repeat those singles.` });
    }
  }
  if (!points.some((pt) => pt.rounds.filter((r) => r.clean).length >= 2)) {
    flags.push({ level: "info", text: "No load has two clean rounds yet, so there are no error bars. Repeat the probe on another day to add them." });
  }
  return flags;
}

export function defaultProbe(lift: LiftKey = "bench"): Probe {
  const spec = LIFTS[lift];
  return { lift, e1rm: 0, mvt: spec.mvt, recruitLine: spec.recruitLine, reps: [] };
}
