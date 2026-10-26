import { INTENT_FLOOR, N_TO_LBF } from "./constants";

export interface RepReading {
  forceLbf: number;
  /** Net force: peak force minus bar load (lbf). */
  net: number;
  /** Peak force ÷ bar load. */
  multiple: number;
  /** (Peak force − bar load) ÷ bar load, as a fraction. Also reads as g. */
  surplus: number;
  /** Bar load as % of e1RM. */
  loadPct: number | null;
  /** Effective Intensity: peak force ÷ e1RM, as %. Equals load% × Multiple. */
  ei: number | null;
}

export function readRep(barLb: number, forceN: number, e1rmLb?: number | null): RepReading | null {
  if (!(barLb > 0) || !(forceN > 0)) return null;
  const forceLbf = forceN * N_TO_LBF;
  const multiple = forceLbf / barLb;
  const hasMax = e1rmLb != null && e1rmLb > 0;
  return {
    forceLbf,
    net: forceLbf - barLb,
    multiple,
    surplus: multiple - 1,
    loadPct: hasMax ? (barLb / e1rmLb!) * 100 : null,
    ei: hasMax ? (forceLbf / e1rmLb!) * 100 : null,
  };
}

/** v_stop = (1 − f) · v_fresh + f · MVT */
export function stopVelocity(vFresh: number | null, mvt: number, f: number): number | null {
  if (vFresh == null || !Number.isFinite(vFresh)) return null;
  return (1 - f) * vFresh + f * mvt;
}

/** The draft intent floor for a load %, linearly interpolated; null outside 55–95%. */
export function intentFloor(loadPct: number): number | null {
  if (loadPct < 55 || loadPct > 95) return null;
  const t = INTENT_FLOOR;
  if (loadPct <= t[0][0]) return t[0][1];
  if (loadPct >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [x0, y0] = t[i];
    const [x1, y1] = t[i + 1];
    if (loadPct >= x0 && loadPct <= x1) return y0 + ((y1 - y0) * (loadPct - x0)) / (x1 - x0);
  }
  return null;
}

/** Hanley neural load for one block: sets · reps · (100 / (100 − intensity))². */
export const neuralLoad = (reps: number, sets: number, intensity: number) =>
  reps * sets * (100 / (100 - intensity)) ** 2;

/** Integer set count that lands a block nearest the middle of a target band. */
export function tuneSets(reps: number, intensity: number, target: [number, number]): number {
  const mid = (target[0] + target[1]) / 2;
  if (neuralLoad(reps, 1, intensity) <= 0) return 1;
  let best = 1;
  let bestErr = Infinity;
  for (let s = 1; s <= 20; s++) {
    const err = Math.abs(neuralLoad(reps, s, intensity) - mid);
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}

/**
 * Reps to failure vs %1RM (population, bench-shaped; Nuzzo 2023 region).
 * Anchored so 60% ≈ 20, 70% ≈ 13, 80% ≈ 8, 90% ≈ 4.
 */
export function repsToFailure(intensity: number): number {
  const tbl: Array<[number, number]> = [
    [60, 20], [65, 16], [70, 13], [75, 10], [80, 8], [85, 6], [90, 4], [95, 2],
  ];
  if (intensity <= tbl[0][0]) return tbl[0][1];
  if (intensity >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [x0, y0] = tbl[i];
    const [x1, y1] = tbl[i + 1];
    if (intensity >= x0 && intensity <= x1) return y0 + ((y1 - y0) * (intensity - x0)) / (x1 - x0);
  }
  return tbl[0][1];
}
