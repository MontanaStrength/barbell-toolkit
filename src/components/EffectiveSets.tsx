// How a session counts as effective sets: each set against its reference, and
// the running tally through diminishing returns.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { CardSet } from "../engine/sessions/card";
import { priceSession, RT, sessionValue, type PricedSet, type PriceInput, type SessionPricing } from "../engine/sessions/rt";
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

/** The session card's line: singular only when it rounds to exactly one. */
export function effectiveSetsPhrase(credited: number): string {
  const n = fmt(credited, 1);
  return `About ${n} effective set${n === "1.0" ? "" : "s"}`;
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

// ---------- the ledger ----------

interface LedgerRow {
  first: number;
  last: number;
  /** Priced parts in the row: sets, or a cluster's mini-sets. */
  count: number;
  s: PricedSet;
  marginal: number;
}

/** Identical consecutive parts read as one row, across sets as well as within a cluster. */
export function ledgerRows(sets: PricedSet[]): LedgerRow[] {
  const out: LedgerRow[] = [];
  for (const s of sets) {
    const prev = out[out.length - 1];
    const sameShape = prev && prev.s.pct === s.pct && prev.s.reps === s.reps && prev.s.rpe === s.rpe && prev.s.group === s.group;
    if (sameShape && (prev.s.part == null) === (s.part == null)) {
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

/** Which route the credit came through, in words. */
export function routeWords(s: PricedSet): string {
  switch (s.route) {
    case "none":
      return "nothing counts: too light and too far from failure";
    case "fatigue":
      return "only the last reps recruit";
    case "both":
      return "the load recruits in part and the last reps do the rest";
    case "load":
      return s.nearLstar ? "the load recruits in part" : "the load recruits";
  }
}

function why(s: PricedSet): string {
  const route = routeWords(s);
  if (s.route === "none") return route;
  if (s.capped) return s.cap >= 1 ? `${route}; capped at a full set` : `${route}; capped at ${s.reps} rep${s.reps === 1 ? "" : "s"} ÷ 5`;
  return route;
}

/** Where the set's load sits against L*: the regime its reps are priced in. */
export function positionWords(s: PricedSet, lstar: number | null): string | null {
  if (lstar == null) return null;
  if (s.nearLstar) return "near L*";
  return s.pct >= lstar ? "above L*" : "below L*";
}

/** What would make this set a full one. */
export function toFullWords(s: PricedSet): string {
  if (s.toFull === 0) return "A full set.";
  if (s.toFull == null) {
    return s.reps < RT.STIM_FULL_REPS
      ? `Too short to be a full set: that takes ${RT.STIM_FULL_REPS} reps, so ${f2(s.cap)} at most here.`
      : "Can't be a full set without passing failure.";
  }
  return `${s.toFull} more rep${s.toFull === 1 ? "" : "s"} would make it a full set.`;
}

export function Ledger({ pricing, bar, lstar }: { pricing: SessionPricing; bar?: (pct: number) => string; lstar: number | null }) {
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
            const cluster = s.part != null;
            return (
              <tr key={`${r.first}-${s.part ?? 0}`}>
                <td className="set-name">
                  {r.first === r.last ? r.first : `${r.first}–${r.last}`}
                  {cluster && (
                    <small>
                      {r.count} mini-set{r.count === 1 ? "" : "s"}
                    </small>
                  )}
                  <small>
                    {s.reps} × {loadText(s.pct)}
                    {bar ? ` (${bar(s.pct)})` : ""}, RPE {halfPoint(s.rpe)}
                    {positionWords(s, lstar) ? `, ${positionWords(s, lstar)}` : ""}
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
                  <small className="cell-note rt-to-full">{toFullWords(s)}</small>
                </td>
                <td data-label="Adds">
                  {f2(r.marginal)}
                  {r.count > 1 && (
                    <small className="cell-note">
                      over {r.count} {cluster ? "mini-sets" : "sets"}
                    </small>
                  )}
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
  // One label per set, centred over its parts, so a cluster reads as one set.
  const labels: Array<{ n: number; from: number; to: number }> = [];
  pricing.sets.forEach((s, i) => {
    const last = labels[labels.length - 1];
    if (last && last.n === s.n) last.to = i + 1;
    else labels.push({ n: s.n, from: i, to: i + 1 });
  });
  const every = labels.length <= (W < 480 ? 8 : 16) ? 1 : 2;
  return (
    <div ref={ref} className="rt-frame">
      <svg
        className="rt-tally"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Effective sets accumulating over ${n} sets: ${f2(pricing.raw)} before diminishing returns, ${f2(pricing.credited)} after`}
      >
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
        {labels.map((l, i) => (
          <text key={l.n} x={(x(l.from) + x(l.to)) / 2} y={H - m.b + 16} className="rt-axis rt-mid">
            {i % every === 0 ? l.n : ""}
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

// ---------- the words ----------

/** The parameters in a line, for the page's captions. */
export const RT_WORDS = {
  rep: `Per rep, stimulus is R × T. R is 1 above L* (blended over ±${RT.LSTAR_BAND} points) or at RIR 2 and under, and falls by ${Math.round(100 * (1 - Math.exp(-RT.K_R)))}% a rep above that; T climbs from ${RT.T_AT_LSTAR} at L* to 1 at 100%, or is 1 at RIR 1 and under. The reference is at the same load, so above L* the tension term cancels and a set's credit is its reps over a hard set's. A set earns at most ${RT.STIM_FULL_REPS === 5 ? "reps ÷ 5" : `reps ÷ ${RT.STIM_FULL_REPS}`}, so a single is 0.2 at most. The reference counts whole reps, so the credit steps where a hard set loses one.`,
  session: `The first full set counts in full; after that, 1 + ${RT.SESSION_LOG_SCALE} · ln(1 + (dose − 1) ÷ ${RT.SESSION_LOG_SCALE}).`,
};

/**
 * The count's departures from the usual tally, as rules of thumb. The numbers
 * come from RT; the light and heavy loads are picked around this lifter's L*.
 */
export function rulesOfThumb(lstar: number | null): string[] {
  const marginal = (k: number) => sessionValue(k) - sessionValue(k - 1);
  const twelve = sessionValue(12);
  const out = [
    `A set is worth at most reps ÷ ${RT.STIM_FULL_REPS}: a single 0.2, a double 0.4, a triple 0.6, however heavy and however hard.`,
  ];
  if (lstar != null) {
    out.push(
      `Above L*, a set is its reps as a share of a hard set's reps at that load, so a rep short of RIR 2 costs one rep's share: a tenth where a hard set is ten reps, a fifth where it is five.`,
      `Below L*, only the last three or so reps count: a rep short of RIR 2 cuts a set to about half, two short to about a quarter. From L* − ${RT.LSTAR_BAND} to L* + ${RT.LSTAR_BAND} the load recruits in part.`,
    );
  } else {
    out.push(`With no L*, every set prices by proximity alone: only the last three or so reps count, and a rep short of RIR 2 cuts a set to about half.`);
  }
  out.push(
    `Reaching RIR 2 with ${RT.STIM_FULL_REPS} or more reps is a full set. RIR 1 or 0 earn no more: the last two reps buy fatigue, not credit, in this pricing.`,
    `The fifth hard set adds about half of what the first did (${f2(marginal(5))}); the tenth, a third (${f2(marginal(10))}). Twelve hard sets are credited ${fmt(twelve, 1)}, not 12.`,
  );
  return out;
}
