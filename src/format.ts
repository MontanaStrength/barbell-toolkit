import { useEffect } from "react";

export const fmt = (x: number | null | undefined, d = 0): string =>
  x == null || !Number.isFinite(x) ? "–" : x.toFixed(d);

export const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)}%`);

export const lb = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : `${Math.round(x)} lb`);

export const ms = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? "–" : `${x.toFixed(d)} m/s`);

/** Round to the nearest loadable bar weight. */
export const plateRound = (x: number, step = 5) => Math.round(x / step) * step;

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Barbell Toolkit` : "Barbell Toolkit";
  }, [title]);
}
