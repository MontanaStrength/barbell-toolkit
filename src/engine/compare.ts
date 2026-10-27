// Comparing two probes of the same lift, and sizing the noise so a change can
// be called real or not. Design (Oct 2026):
//
//   1. Both probes are read against the later probe's recruitment line and
//      MVT, so a changed setting can't pose as a changed lifter.
//   2. Each load's fresh value carries the larger of two measured spreads:
//      across days (rounds of the same probe) and within a session (the
//      singles that made each round's value). Loads with neither borrow the
//      probe's typical relative spread. Divided by √rounds, since the fresh
//      value is a mean over rounds.
//   3. That spread is pushed through the same profile math by simulation
//      (seeded, so the page shows the same numbers every time), giving each
//      reading its own noise. A change counts as real when it's bigger than
//      the 95% band on the difference: 1.96 × √(noise_a² + noise_b²).

import { analyze, multipleOf, pointKey, roundValue, type Analysis, type LoadPoint, type Probe, type Rep } from "./analyze";
import { computeProfile, type Band, type Profile } from "./profile";
import { mean, sd } from "./stats";

export type NoiseSource = "days" | "session" | "borrowed";

export interface PointNoise {
  key: string;
  load: number;
  lb: number;
  mult: number;
  v: number | null;
  /** Rounds averaged into the fresh value. */
  rounds: number;
  /** Spread of one round's value. */
  sdMult: number | null;
  sdV: number | null;
  /** Spread of the fresh value itself: sd ÷ √rounds. */
  seMult: number | null;
  seV: number | null;
  source: NoiseSource | null;
}

const maxOf = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));

/** Pooled standard deviation across groups, weighted by degrees of freedom. */
function pooledSd(groups: number[][]): number | null {
  let ss = 0;
  let dof = 0;
  for (const g of groups) {
    if (g.length < 2) continue;
    const s = sd(g)!;
    ss += (g.length - 1) * s * s;
    dof += g.length - 1;
  }
  return dof > 0 ? Math.sqrt(ss / dof) : null;
}

export function pointNoise(probe: Probe, points: LoadPoint[]): PointNoise[] {
  const groups = new Map<string, Rep[]>();
  for (const r of probe.reps) {
    if (!(r.lb > 0) || !(r.forceN > 0)) continue;
    const k = pointKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const own = points.map((p) => {
    const reps = groups.get(p.key) ?? [];
    const clean = p.rounds.filter((r) => r.clean);
    const basis = clean.length ? clean : p.rounds;
    const betweenM = basis.length >= 2 ? sd(basis.map((b) => b.mult)) : null;
    const vs = basis.map((b) => b.v).filter((v): v is number => v != null);
    const betweenV = vs.length >= 2 ? sd(vs) : null;
    const used = basis.map((b) => roundValue(reps.filter((r) => r.round === b.round))?.used ?? []);
    const withinM = pooledSd(used.map((u) => u.map(multipleOf)));
    const withinV = pooledSd(used.map((u) => u.map((r) => r.meanV).filter((v): v is number => v != null)));
    const sdMult = maxOf(betweenM, withinM);
    const source: NoiseSource | null =
      sdMult == null ? null : betweenM != null && betweenM >= (withinM ?? 0) ? "days" : "session";
    return { p, rounds: basis.length, sdMult, sdV: maxOf(betweenV, withinV), source };
  });
  // Loads with no spread of their own borrow the probe's typical relative spread.
  const cvM = mean(own.filter((o) => o.sdMult != null).map((o) => o.sdMult! / o.p.mult));
  const cvV = mean(own.filter((o) => o.sdV != null && o.p.v).map((o) => o.sdV! / o.p.v!));
  return own.map(({ p, rounds, sdMult, sdV, source }) => {
    const m = sdMult ?? (cvM != null ? cvM * p.mult : null);
    const v = sdV ?? (cvV != null && p.v != null ? cvV * p.v : null);
    const k = Math.sqrt(Math.max(1, rounds));
    return {
      key: p.key,
      load: p.load,
      lb: p.lb,
      mult: p.mult,
      v: p.v,
      rounds,
      sdMult: m,
      sdV: v,
      seMult: m != null ? m / k : null,
      seV: v != null ? v / k : null,
      source: source ?? (m != null ? "borrowed" : null),
    };
  });
}

/** The readings compared across probes. Force and speed are read at one shared bar weight. */
export interface Readout {
  lstar: number | null;
  lstarLb: number | null;
  slope: number | null;
  multAt: number | null;
  /** Peak force at the shared bar, lbf. */
  forceAt: number | null;
  /** Fresh mean velocity at the shared bar, m/s. */
  vAt: number | null;
  velE1rm: number | null;
  alpha: number | null;
  beta: number | null;
}

export type ReadoutKey = keyof Readout;
export const READOUT_KEYS: ReadoutKey[] = ["lstar", "lstarLb", "slope", "multAt", "forceAt", "vAt", "velE1rm", "alpha", "beta"];

export function readout(pr: Profile, e1rm: number, barLb: number | null): Readout {
  const L = barLb != null && e1rm > 0 ? (barLb / e1rm) * 100 : null;
  const multAt = L != null && pr.fl.m != null && pr.fl.b != null ? pr.fl.m * L + pr.fl.b : null;
  return {
    lstar: pr.lstar,
    lstarLb: pr.lstarLb,
    slope: pr.fl.m,
    multAt,
    forceAt: multAt != null && barLb != null ? multAt * barLb : null,
    vAt: L != null ? pr.vAt(L) : null,
    velE1rm: pr.velE1rm,
    alpha: pr.alpha,
    beta: pr.beta,
  };
}

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export const DRAWS = 400;

export interface Spread {
  sd: Record<ReadoutKey, number | null>;
  /** Share of simulated probes in which the reading couldn't be computed (e.g. no L* crossing). */
  missing: Record<ReadoutKey, number>;
}

function emptyRecord<T>(v: T): Record<ReadoutKey, T> {
  return Object.fromEntries(READOUT_KEYS.map((k) => [k, v])) as Record<ReadoutKey, T>;
}

/** Spread of every reading, from simulated repeats of the probe within its measured noise. */
export function spread(
  noise: PointNoise[],
  ctx: { e1rm: number; mvt: number; line: number },
  barLb: number | null,
  draws = DRAWS,
  seed = 7,
): Spread {
  if (!noise.length || noise.some((p) => p.seMult == null)) {
    return { sd: emptyRecord<number | null>(null), missing: emptyRecord(1) };
  }
  const rand = rng(seed);
  const samples = Object.fromEntries(READOUT_KEYS.map((k) => [k, [] as number[]])) as Record<ReadoutKey, number[]>;
  for (let i = 0; i < draws; i++) {
    const points = noise.map((p) => {
      const zm = gauss(rand);
      const zv = gauss(rand);
      return { load: p.load, mult: p.mult + zm * p.seMult!, v: p.v != null ? p.v + zv * (p.seV ?? 0) : null };
    });
    const r = readout(computeProfile({ e1rm: ctx.e1rm, mvt: ctx.mvt, recruitLine: ctx.line, points }), ctx.e1rm, barLb);
    for (const k of READOUT_KEYS) {
      const x = r[k];
      if (x != null && Number.isFinite(x)) samples[k].push(x);
    }
  }
  const out: Spread = { sd: emptyRecord<number | null>(null), missing: emptyRecord(0) };
  for (const k of READOUT_KEYS) {
    out.missing[k] = 1 - samples[k].length / draws;
    out.sd[k] = samples[k].length >= draws / 2 ? sd(samples[k]) : null;
  }
  return out;
}

export type Verdict = "real" | "noise" | "unknown";

export interface Change {
  before: number | null;
  after: number | null;
  delta: number | null;
  /** 95% noise band on the change; null when the noise can't be sized. */
  band: number | null;
  verdict: Verdict;
}

/** A simulated probe that loses its L* more often than this is too unstable to call. */
const MAX_MISSING = 0.1;

export interface Comparison {
  /** Both analyses use the later probe's line and MVT. */
  earlier: Analysis;
  later: Analysis;
  line: number;
  mvt: number;
  lineChanged: boolean;
  mvtChanged: boolean;
  barLb: number | null;
  noise: { earlier: PointNoise[]; later: PointNoise[] };
  changes: Record<ReadoutKey, Change>;
  e1rm: { before: number; after: number; delta: number };
  bands: Array<{ label: string; before: Band | null; after: Band | null }>;
}

/** The bar weights both probes tested, as a [lightest, heaviest] range in lb; null if they don't overlap. */
export function sharedRange(a: Probe, b: Probe): [number, number] | null {
  const la = analyze(a).loadPoints.map((p) => p.lb);
  const lb = analyze(b).loadPoints.map((p) => p.lb);
  if (!la.length || !lb.length) return null;
  const lo = Math.max(Math.min(...la), Math.min(...lb));
  const hi = Math.min(Math.max(...la), Math.max(...lb));
  return lo <= hi ? [lo, hi] : null;
}

export function compareProbes(
  earlierProbe: Probe,
  laterProbe: Probe,
  opts: { barLb?: number | null; draws?: number } = {},
): Comparison {
  const line = laterProbe.recruitLine;
  const mvt = laterProbe.mvt;
  const A: Probe = { ...earlierProbe, recruitLine: line, mvt };
  const B: Probe = laterProbe;
  const earlier = analyze(A);
  const later = analyze(B);

  let barLb = opts.barLb;
  if (barLb === undefined) {
    const r = sharedRange(A, B);
    barLb = r ? Math.min(r[1], Math.max(r[0], (B.e1rm * 75) / 100)) : null;
  }

  const nA = pointNoise(A, earlier.loadPoints);
  const nB = pointNoise(B, later.loadPoints);
  const rA = readout(earlier, A.e1rm, barLb);
  const rB = readout(later, B.e1rm, barLb);
  const sA = spread(nA, { e1rm: A.e1rm, mvt, line }, barLb, opts.draws);
  const sB = spread(nB, { e1rm: B.e1rm, mvt, line }, barLb, opts.draws);

  const changes = emptyRecord<Change>({ before: null, after: null, delta: null, band: null, verdict: "unknown" });
  for (const k of READOUT_KEYS) {
    const before = rA[k];
    const after = rB[k];
    const delta = before != null && after != null ? after - before : null;
    const stable = sA.missing[k] <= MAX_MISSING && sB.missing[k] <= MAX_MISSING;
    const band =
      stable && sA.sd[k] != null && sB.sd[k] != null ? 1.96 * Math.sqrt(sA.sd[k]! ** 2 + sB.sd[k]! ** 2) : null;
    changes[k] = {
      before,
      after,
      delta,
      band,
      verdict: delta == null || band == null ? "unknown" : Math.abs(delta) > band ? "real" : "noise",
    };
  }

  const labels = [...new Set([...earlier.bands, ...later.bands].map((b) => b.label))];
  return {
    earlier,
    later,
    line,
    mvt,
    lineChanged: earlierProbe.recruitLine !== line,
    mvtChanged: earlierProbe.mvt !== mvt,
    barLb,
    noise: { earlier: nA, later: nB },
    changes,
    e1rm: { before: A.e1rm, after: B.e1rm, delta: B.e1rm - A.e1rm },
    bands: labels.map((label) => ({
      label,
      before: earlier.bands.find((b) => b.label === label) ?? null,
      after: later.bands.find((b) => b.label === label) ?? null,
    })),
  };
}

/** How each probe's noise was sized, for the one-line note on the page. */
export function noiseBasis(n: PointNoise[]): Record<NoiseSource | "none", number> {
  const out = { days: 0, session: 0, borrowed: 0, none: 0 };
  for (const p of n) out[p.source ?? "none"]++;
  return out;
}
