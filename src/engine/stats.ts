export interface Fit {
  m: number | null;
  b: number | null;
  r2: number | null;
}

export interface XY {
  x: number;
  y: number;
}

/** Ordinary least squares, y = m·x + b, with R². */
export function ols(pts: XY[]): Fit {
  const n = pts.length;
  if (n < 2) return { m: null, b: pts[0]?.y ?? null, r2: null };
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    sst += (p.y - my) ** 2;
  }
  if (sxx === 0) return { m: null, b: my, r2: null };
  const m = sxy / sxx;
  const b = my - m * mx;
  let ssr = 0;
  for (const p of pts) {
    const e = p.y - (m * p.x + b);
    ssr += e * e;
  }
  return { m, b, r2: sst === 0 ? null : 1 - ssr / sst };
}

export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const x = a.slice(0, n);
  const y = b.slice(0, n);
  const mx = mean(x)!;
  const my = mean(y)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

/** Sample standard deviation (n − 1), matching a spreadsheet's STDEV. */
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

/**
 * L*: the load % where Effective Intensity crosses the recruitment line.
 * With Multiple = m·L + b and EI% = Multiple · L, solve m·L² + b·L − line = 0
 * and keep the physically meaningful root inside (30, 100).
 */
export function solveLstar(m: number | null, b: number | null, line: number): number | null {
  if (m == null || b == null || m === 0) return null;
  const disc = b * b + 4 * m * line;
  if (disc < 0) return null;
  const r1 = (-b + Math.sqrt(disc)) / (2 * m);
  const r2 = (-b - Math.sqrt(disc)) / (2 * m);
  const roots = [r1, r2].filter((x) => x > 30 && x < 100);
  return roots.length ? Math.min(...roots) : null;
}

export const round = (x: number | null | undefined, d = 0): number | null => {
  if (x == null || !Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
};
