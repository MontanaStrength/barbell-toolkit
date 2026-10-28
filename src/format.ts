import { useEffect } from "react";
import { N_TO_LBF } from "./engine/constants";
import { toUnit, type Unit } from "./weights";
export { LB_PER_KG, toUnit, fromUnit, plateStep, plateRound, suggestBarLb, type Unit } from "./weights";

export const fmt = (x: number | null | undefined, d = 0): string =>
  x == null || !Number.isFinite(x) ? "–" : x.toFixed(d);

export const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)}%`);

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

/** Pounds in the US, kilograms elsewhere, until the visitor picks. */
export const defaultUnit = (): Unit => {
  try {
    return /^en-US$/i.test(navigator.language) ? "lb" : "kg";
  } catch {
    return "lb";
  }
};

export const ms = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)} m/s`);

/** Today as YYYY-MM-DD in the visitor's own time zone (not UTC, which runs a day ahead in US evenings). */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIso(s: string | null | undefined) {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
}

/** "Jun 6, 2026". Parsed by hand so a date never slips a day across time zones. */
export function fmtDay(s: string | null | undefined): string {
  const p = parseIso(s);
  return p ? `${MONTHS[p.mo]} ${p.d}, ${p.y}` : "–";
}

/** A date range, as short as it can be: "Jun 6, 2026", "Jun 6–22, 2026", "May 29 – Jun 25, 2026". */
export function fmtSpan(a: string | null | undefined, b: string | null | undefined): string {
  const p = parseIso(a);
  const q = parseIso(b);
  if (!p || !q) return fmtDay(a ?? b);
  if (p.y === q.y && p.mo === q.mo && p.d === q.d) return fmtDay(a);
  if (p.y === q.y && p.mo === q.mo) return `${MONTHS[p.mo]} ${p.d}–${q.d}, ${p.y}`;
  if (p.y === q.y) return `${MONTHS[p.mo]} ${p.d} – ${MONTHS[q.mo]} ${q.d}, ${p.y}`;
  return `${fmtDay(a)} – ${fmtDay(b)}`;
}

/** A signed change, e.g. "+2.4" or "−0.012"; a true minus sign reads better than a hyphen. */
export const signed = (x: number | null | undefined, d = 1) => {
  if (x == null || !Number.isFinite(x)) return "–";
  const r = Number(x.toFixed(d));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(d)}`;
};

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Barbell Toolkit` : "Barbell Toolkit";
  }, [title]);
}
