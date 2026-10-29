// How a session counts as effective sets: the per-rep field, each set against
// its reference, and the running tally through diminishing returns.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { CardSet } from "../engine/sessions/card";
import { priceSession, repStimulus, RT, type PricedSet, type PriceInput, type SessionPricing } from "../engine/sessions/rt";
import { halfPoint } from "../engine/sessions/effort";
import { fmt } from "../format";

export type Basis = "label" | "felt";

/** The card's sets as the pricer reads them: rep-counted sets at the chosen RPE; timed work unpriced. */
export function priceInputs(sets: CardSet[], basis: Basis): PriceInput[] {
  return sets.map((s) => {
    const r = s.reps;
    const parts = r.kind === "fixed" || r.kind === "upTo" ? [r.n] : r.kind === "toStop" ? [r.about] : r.kind === "cluster" ? r.parts : null;
    const rpe = basis === "felt" && s.felt != null && !s.ceiling ? s.felt : s.rpe;
    return { n: s.n, group: s.group, pct: s.pct, rpe, parts };
  });
}

export function usePricing(sets: CardSet[], basis: Basis, lstar: number | null): SessionPricing {
  return useMemo(() => priceSession(priceInputs(sets, basis), lstar), [sets, basis, lstar]);
}

const f2 = (x: number) => fmt(x, 2);

/** The width a chart has to draw in, so text keeps its size on a phone instead of scaling down with a fixed viewBox. */
function useWidth(fallback = 640): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
const loadText = (pct: number) => `${fmt(pct, Number.isInteger(pct) ? 0 : 1)}%`;

// ---------- the field ----------

/**
 * Stimulus per rep over load and reps in reserve, with the session's sets as
 * columns descending toward failure.
 */
export function Field({ pricing, lstar }: { pricing: SessionPricing; lstar: number | null }) {
  const [ref, W] = useWidth();
  const narrow = W < 480;
  const H = narrow ? 260 : 320;
  const m = { l: 40, r: 12, t: 14, b: 40 };
  const LO = 40;
  const HI = 100;
  const topRir = Math.max(10, ...pricing.sets.map((s) => s.terminalRir + s.reps - 1 + 1));
  const x = (pct: number) => m.l + ((pct - LO) / (HI - LO)) * (W - m.l - m.r);
  const y = (rir: number) => H - m.b - (rir / topRir) * (H - m.t - m.b);
  const cols = narrow ? 40 : 60;
  const rows = Math.round(topRir * 2);
  const cw = (W - m.l - m.r) / cols;
  const rh = (H - m.t - m.b) / rows;
  const cells = useMemo(() => {
    const out: Array<{ x: number; y: number; v: number }> = [];
    for (let i = 0; i < cols; i++) {
      const pct = LO + ((i + 0.5) / cols) * (HI - LO);
      for (let j = 0; j < rows; j++) {
        const rir = ((j + 0.5) / rows) * topRir;
        out.push({ x: m.l + i * cw, y: H - m.b - (j + 1) * rh, v: repStimulus(pct, rir, lstar).stimulus });
      }
    }
    return out;
  }, [lstar, topRir, cols, rows, cw, rh, m.l, m.b]);

  // One column per distinct shape, with a count.
  const columns = useMemo(() => {
    const seen = new Map<string, { s: PricedSet; count: number }>();
    for (const s of pricing.sets) {
      const k = `${s.pct}|${s.reps}|${s.terminalRir}`;
      const e = seen.get(k);
      if (e) e.count++;
      else seen.set(k, { s, count: 1 });
    }
    return [...seen.values()];
  }, [pricing.sets]);

  return (
    <div ref={ref} className="rt-frame">
    <svg className="rt-field" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Stimulus per rep by load and reps in reserve, with this session's sets drawn on it">
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={cw + 0.5} height={rh + 0.5} className="rt-cell" style={{ fillOpacity: 0.04 + 0.7 * c.v }} />
      ))}
      {lstar != null && lstar >= LO && lstar <= HI && (
        <>
          <line x1={x(lstar)} x2={x(lstar)} y1={m.t} y2={H - m.b} className="rt-lstar" />
          <text x={x(lstar) + 5} y={m.t + 12} className="rt-lstar-label rt-halo">
            L* {fmt(lstar, 1)}%
          </text>
        </>
      )}
      {/* RIR 2: the top of the near-failure zone */}
      <line x1={m.l} x2={W - m.r} y1={y(2)} y2={y(2)} className="rt-floor" />
      <text x={m.l + 4} y={y(2) - 4} className="rt-axis">
        RIR 2, the near-failure floor
      </text>
      {columns.map(({ s, count }, i) => {
        const cx = x(s.pct);
        const top = y(s.terminalRir + s.reps - 1);
        const bot = y(s.terminalRir);
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={top} y2={bot} className="rt-col-halo" />
            <line x1={cx} x2={cx} y1={top} y2={bot} className="rt-col" />
            {s.stimuli.map((r, j) => (
              <g key={j}>
                <circle cx={cx} cy={y(r.rir)} r={6.5} className="rt-rep-halo" />
                <circle cx={cx} cy={y(r.rir)} r={5} className="rt-rep" style={{ fillOpacity: 0.12 + 0.88 * r.stimulus }} />
              </g>
            ))}
            <text x={cx} y={top - 10} className="rt-axis rt-mid rt-halo">
              {s.reps} rep{s.reps === 1 ? "" : "s"}
              {count > 1 ? ` × ${count}` : ""}
            </text>
          </g>
        );
      })}
      {(narrow ? [40, 60, 80, 100] : [40, 50, 60, 70, 80, 90, 100]).map((p) => (
        <text key={p} x={x(p)} y={H - m.b + 16} className="rt-axis rt-mid">
          {p}%
        </text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 6} className="rt-axis rt-mid rt-axis-title">
        Load, % of max
      </text>
      {Array.from({ length: Math.floor(topRir / 2) + 1 }, (_, i) => i * 2).map((r) => (
        <text key={r} x={m.l - 6} y={y(r) + 4} className="rt-axis rt-right">
          {r}
        </text>
      ))}
      <text transform={`translate(11 ${(m.t + H - m.b) / 2}) rotate(-90)`} className="rt-axis rt-mid rt-axis-title">
        Reps in reserve
      </text>
    </svg>
    </div>
  );
}

// ---------- the ledger ----------

interface LedgerRow {
  first: number;
  last: number;
  count: number;
  s: PricedSet;
  marginal: number;
}

/** Identical consecutive sets read as one row. */
function ledgerRows(sets: PricedSet[]): LedgerRow[] {
  const out: LedgerRow[] = [];
  for (const s of sets) {
    const prev = out[out.length - 1];
    if (prev && prev.s.pct === s.pct && prev.s.reps === s.reps && prev.s.rpe === s.rpe && prev.s.group === s.group && prev.s.part === s.part) {
      prev.last = s.n;
      prev.count++;
      prev.marginal += s.marginal;
    } else out.push({ first: s.n, last: s.n, count: 1, s, marginal: s.marginal });
  }
  return out;
}

function Strip({ reps, dim }: { reps: Array<{ stimulus: number }>; dim?: boolean }) {
  const w = 10;
  const g = 2;
  const W = Math.max(1, reps.length) * (w + g);
  return (
    <svg className={dim ? "rt-strip rt-strip-ref" : "rt-strip"} viewBox={`0 0 ${W} 14`} width={W} height={14} aria-hidden="true">
      {reps.map((r, i) => (
        <rect key={i} x={i * (w + g)} y={0} width={w} height={14} rx={1.5} className="rt-strip-cell" style={{ fillOpacity: 0.06 + 0.9 * r.stimulus }} />
      ))}
    </svg>
  );
}

function CreditBar({ s }: { s: PricedSet }) {
  const W = 120;
  return (
    <svg className="rt-credit" viewBox={`0 0 ${W} 10`} width={W} height={10} aria-hidden="true">
      <rect x={0} y={2} width={W} height={6} rx={3} className="rt-credit-track" />
      <rect x={0} y={2} width={W * Math.min(1, s.ratio)} height={6} rx={3} className={s.capped ? "rt-credit-over" : "rt-credit-fill"} />
      <rect x={0} y={2} width={W * s.credit} height={6} rx={3} className="rt-credit-fill" />
      {s.cap < 1 && <line x1={W * s.cap} x2={W * s.cap} y1={0} y2={10} className="rt-cap" />}
    </svg>
  );
}

function why(s: PricedSet): string {
  if (s.route === "none") return "nothing counts: too light and too far from failure";
  const route = s.route === "load" ? "the load recruits" : "only the last reps recruit";
  if (s.capped) return s.cap >= 1 ? `${route}; capped at a full set` : `${route}; capped at ${s.reps} rep${s.reps === 1 ? "" : "s"} ÷ 5`;
  return route;
}

export function Ledger({ pricing }: { pricing: SessionPricing }) {
  const rows = ledgerRows(pricing.sets);
  return (
    <div className="table-wrap">
      <table className="rt-ledger">
        <thead>
          <tr>
            <th>Set</th>
            <th>Each rep</th>
            <th>Reference</th>
            <th>Credit</th>
            <th>Adds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = r.s;
            return (
              <tr key={`${r.first}-${s.part ?? 0}`}>
                <td className="set-name">
                  {r.first === r.last ? r.first : `${r.first}–${r.last}`}
                  {s.part != null && <small>mini-set {s.part}</small>}
                  <small>
                    {s.reps} × {loadText(s.pct)}, RPE {halfPoint(s.rpe)}
                  </small>
                </td>
                <td data-label="Each rep">
                  <Strip reps={s.stimuli} />
                  <small className="cell-note">= {f2(s.raw)}</small>
                </td>
                <td data-label="Reference">
                  <Strip reps={s.reference} dim />
                  <small className="cell-note">
                    {s.reference.length} to RIR 2 = {f2(s.referenceRaw)}
                  </small>
                </td>
                <td data-label="Credit">
                  <CreditBar s={s} />
                  <small className="cell-note">
                    <strong>{f2(s.credit)}</strong>
                    {r.count > 1 ? ` each` : ""}: {why(s)}
                  </small>
                </td>
                <td data-label="Adds">
                  {f2(r.marginal)}
                  {r.count > 1 && <small className="cell-note">over {r.count} sets</small>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- the tally ----------

export function Tally({ pricing }: { pricing: SessionPricing }) {
  const [ref, W] = useWidth();
  const H = W < 480 ? 200 : 220;
  const m = { l: 40, r: 12, t: 14, b: 36 };
  const n = pricing.sets.length;
  const top = Math.max(2, Math.ceil(pricing.raw + 0.5));
  const x = (i: number) => m.l + (i / Math.max(1, n)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v / top) * (H - m.t - m.b);
  const steps = (pick: (s: PricedSet) => number) => {
    let d = `M ${x(0)} ${y(0)}`;
    pricing.sets.forEach((s, i) => {
      d += ` L ${x(i)} ${y(pick(s))} L ${x(i + 1)} ${y(pick(s))}`;
    });
    return d;
  };
  const rawPath = steps((s) => s.rawAfter);
  const credPath = steps((s) => s.creditedAfter);
  const ticks = Array.from({ length: top + 1 }, (_, i) => i);
  return (
    <div ref={ref} className="rt-frame">
    <svg className="rt-tally" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Effective sets accumulating over ${n} sets: ${f2(pricing.raw)} before diminishing returns, ${f2(pricing.credited)} after`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={t === 1 ? "rt-floor" : "rt-grid"} />
          <text x={m.l - 6} y={y(t) + 4} className="rt-axis rt-right">
            {t}
          </text>
        </g>
      ))}
      <text x={W - m.r - 4} y={y(1) - 4} className="rt-axis rt-right">
        the first full set
      </text>
      <path d={rawPath} className="rt-raw" />
      <path d={credPath} className="rt-cred" />
      {pricing.sets.map((s, i) => (
        <text key={i} x={(x(i) + x(i + 1)) / 2} y={H - m.b + 16} className="rt-axis rt-mid">
          {n <= (W < 480 ? 8 : 16) || i % 2 === 0 ? s.n : ""}
        </text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 4} className="rt-axis rt-mid rt-axis-title">
        After each set
      </text>
      <text x={x(n) - 4} y={y(pricing.raw) - 6} className="rt-axis rt-right rt-raw-label">
        {f2(pricing.raw)} before
      </text>
      <text x={x(n) - 4} y={y(pricing.credited) + 14} className="rt-axis rt-right rt-cred-label">
        {f2(pricing.credited)} credited
      </text>
    </svg>
    </div>
  );
}

/** The parameters in a line, for the page's caption. */
export const RT_WORDS = {
  routes: `R is 1 above L* (blended over ±${RT.LSTAR_BAND} points) or at RIR 2 and under; T climbs from ${RT.T_AT_LSTAR} at L* to 1 at 100%, or is 1 at RIR 1 and under.`,
  cap: `A set earns at most ${RT.STIM_FULL_REPS === 5 ? "reps ÷ 5" : `reps ÷ ${RT.STIM_FULL_REPS}`}, so a single is 0.2 at most.`,
  session: `The first full set counts in full; after that, 1 + ${RT.SESSION_LOG_SCALE} · ln(1 + (dose − 1) ÷ ${RT.SESSION_LOG_SCALE}).`,
};
