import { useEffect } from "react";
import { N_TO_LBF } from "./engine/constants";

export const fmt = (x: number | null | undefined, d = 0): string =>
  x == null || !Number.isFinite(x) ? "–" : x.toFixed(d);

export const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)}%`);

// Weights are stored in pounds everywhere; these convert for display and input.
export type Unit = "lb" | "kg";
export const LB_PER_KG = 2.20462;
export const toUnit = (lb: number, unit: Unit) => (unit === "kg" ? lb / LB_PER_KG : lb);
export const fromUnit = (v: number, unit: Unit) => (unit === "kg" ? v * LB_PER_KG : v);

/** A weight as a number in the display unit: whole pounds, or kilograms to 0.1. */
export const wtValue = (lb: number, unit: Unit) =>
  unit === "kg" ? Math.round(toUnit(lb, unit) * 10) / 10 : Math.round(lb);

export const wt = (lb: number | null | undefined, unit: Unit) =>
  lb == null || !Number.isFinite(lb) ? "–" : `${wtValue(lb, unit)} ${unit}`;

/** A lb–lb range in the display unit, e.g. "232–261 lb". */
export const wtRange = (loLb: number | null, hiLb: number | null, unit: Unit) =>
  loLb == null || hiLb == null ? "–" : `${wtValue(loLb, unit)}–${wtValue(hiLb, unit)} ${unit}`;

/** Force alongside the weight unit: pounds-force with pounds, newtons with kilograms. */
export const force = (lbf: number | null | undefined, unit: Unit) =>
  lbf == null || !Number.isFinite(lbf) ? "–" : unit === "kg" ? `${Math.round(lbf / N_TO_LBF)} N` : `${Math.round(lbf)} lbf`;

export const plateStep = (unit: Unit) => (unit === "kg" ? 2.5 : 5);

/** The nearest loadable bar for a % of e1RM, rounded to plates in the display unit, returned in pounds. */
export const suggestBarLb = (e1rmLb: number, pct: number, unit: Unit) =>
  fromUnit(plateRound(toUnit((e1rmLb * pct) / 100, unit), plateStep(unit)), unit);

/** Pounds in the US, kilograms elsewhere, until the visitor picks. */
export const defaultUnit = (): Unit => {
  try {
    return /^en-US$/i.test(navigator.language) ? "lb" : "kg";
  } catch {
    return "lb";
  }
};

export const ms = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)} m/s`);

/** Round to the nearest loadable bar weight. */
export const plateRound = (x: number, step = 5) => Math.round(x / step) * step;

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Barbell Toolkit` : "Barbell Toolkit";
  }, [title]);
}
