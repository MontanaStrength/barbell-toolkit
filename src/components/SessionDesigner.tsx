import { useMemo, useRef, useState } from "react";
import { DESIGN_TEXT } from "../content/designs";
import type { Analysis } from "../engine/analyze";
import { LIFTS } from "../engine/constants";
import {
  buildCard,
  contextFor,
  type Card,
  type CardSet,
} from "../engine/sessions/card";
import {
  DESIGNS,
  designByKey,
  type Design,
  type DesignCtx,
  type Family,
  type Values,
} from "../engine/sessions/designs";
import { fmt, ms, suggestBarLb, wt, type Unit } from "../format";

const SPOTTER_KEY = "barbell-toolkit/spotter/v1";

function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function repsLabel(s: CardSet): string {
  const r = s.reps;
  const base =
    r.kind === "fixed"
      ? `${r.n}`
      : r.kind === "upTo"
        ? `up to ${r.n}`
        : r.kind === "toStop"
          ? `to the stop, about ${r.about}`
          : r.kind === "cluster"
            ? `${r.parts.join("+")}, ${r.intraRest} s between`
            : `${r.minutes} min`;
  return s.tempo ? `${base}, ${s.tempo} tempo` : base;
}

const rpeLabel = (s: CardSet) => `RPE ${s.ceiling ? "≤ " : ""}${s.rpe}`;
const nextLabel = (s: CardSet) =>
  s.next === 0
    ? "–"
    : s.clock
      ? `every ${clock(s.next)}`
      : `rest ${clock(s.next)}`;

/** Why a design can't be used for this lifter and lift, if it can't. */
function blocked(d: Design, ctx: DesignCtx): string | null {
  if (d.lifts && !d.lifts.includes(ctx.lift)) {
    return `Not on the ${LIFTS[ctx.lift].name.toLowerCase()}. ${
      d.key === "densitySet"
        ? "Never an AMRAP under a barbell without a spotter, so it stays off bench and squat."
        : ""
    }`.trim();
  }
  return d.unavailable?.(ctx) ?? null;
}

/** A design's set structure at a glance: bar height is load, bar width is reps, against L*. */
function Shape({ card, lstar }: { card: Card; lstar: number | null }) {
  const W = 150;
  const H = 40;
  const y = (pct: number) =>
    H - 2 - ((Math.min(95, Math.max(50, pct)) - 50) / 45) * (H - 5);
  const width = (reps: number) => 2.5 + 1.7 * Math.min(reps, 10);
  // Each set is one bar, or one bar per mini-set for clusters.
  const pieces = card.sets.map((s) => {
    const r = s.reps;
    const parts =
      r.kind === "cluster"
        ? r.parts
        : [r.kind === "timed" ? 14 : r.kind === "toStop" ? r.about : r.n];
    return { s, parts };
  });
  const gap = card.sets.length > 9 ? 2 : 3.5;
  const natural =
    pieces.reduce(
      (t, p) => t + p.parts.reduce((u, n) => u + width(n) + 1, -1),
      0,
    ) +
    gap * (pieces.length - 1);
  const k = Math.min(1, W / natural);
  let x = 0;
  const rects: Array<{ x: number; w: number; s: CardSet }> = [];
  for (const p of pieces) {
    p.parts.forEach((n, i) => {
      rects.push({ x, w: width(n) * k, s: p.s });
      x += width(n) * k + (i < p.parts.length - 1 ? 1 : 0);
    });
    x += gap * k;
  }
  return (
    <svg
      className="shape"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={y(r.s.pct)}
          width={r.w}
          height={H - y(r.s.pct)}
          rx={1}
          className={r.s.road === "fatigue" ? "shape-fatigue" : "shape-load"}
        />
      ))}
      {lstar != null && (
        <line
          x1={0}
          x2={W}
          y1={y(lstar)}
          y2={y(lstar)}
          className="shape-lstar"
        />
      )}
    </svg>
  );
}

interface Row {
  first: number;
  last: number;
  s: CardSet;
  next: number;
  /** A different gap after the run's last set, such as the long rest closing a block. */
  after?: number;
}

/** Runs of identical sets read as one row: "Sets 1–10", not ten copies. */
function rowsOf(sets: CardSet[]): Row[] {
  const out: Row[] = [];
  const same = (a: CardSet, b: CardSet) =>
    a.group === b.group &&
    a.pct === b.pct &&
    a.rpe === b.rpe &&
    !!a.ceiling === !!b.ceiling &&
    !!a.clock === !!b.clock &&
    a.tempo === b.tempo &&
    JSON.stringify(a.reps) === JSON.stringify(b.reps);
  for (const s of sets) {
    const prev = out[out.length - 1];
    if (prev && prev.after === undefined && same(prev.s, s)) {
      prev.last = s.n;
      // The run closes on a set whose gap differs: the end of a block or of the session.
      if (s.next !== prev.next) prev.after = s.next;
    } else out.push({ first: s.n, last: s.n, s, next: s.next });
  }
  return out;
}

function thenLabel(r: Row): string {
  const base = nextLabel({ ...r.s, next: r.next });
  if (r.after === undefined || r.after === 0 || r.first === r.last) return base;
  return `${base}, then ${clock(r.after)}`;
}

const setsLabel = (r: Row) =>
  r.first === r.last ? `${r.first}` : `${r.first}–${r.last}`;

export default function SessionDesigner({
  a,
  unit,
}: {
  a: Analysis;
  unit: Unit;
}) {
  const lift = a.probe.lift;
  const e1rm = a.probe.e1rm;
  const ctx = useMemo(() => contextFor(a, lift, a.probe.mvt), [a, lift]);
  const [family, setFamily] = useState<Family>("strength");
  const [key, setKey] = useState("topSetBackoff");
  const [inputs, setInputs] = useState<Record<string, Partial<Values>>>({});
  const [spotter, setSpotter] = useState(() => loadFlag(SPOTTER_KEY));
  const [note, setNote] = useState<string | null>(null);

  const previews = useMemo(
    () =>
      Object.fromEntries(
        DESIGNS.map((d) => [d.key, blocked(d, ctx) ? null : buildCard(d, ctx)]),
      ),
    [ctx],
  );

  const design = designByKey(key)!;
  const text = DESIGN_TEXT[key];
  const why = blocked(design, ctx);
  const needsSpotter = !why && !!design.spotter?.includes(lift) && !spotter;
  const card = useMemo(
    () => (why ? null : buildCard(design, ctx, inputs[key])),
    [why, design, ctx, inputs, key],
  );

  const bar = (pct: number) => wt(suggestBarLb(e1rm, pct, unit), unit);
  // Only the knobs a lifter touches are stored, so the rest keep following their own rules.
  const setValue = (k: string, v: number) =>
    setInputs((all) => ({ ...all, [key]: { ...all[key], [k]: v } }));

  const cardRef = useRef<HTMLElement>(null);
  function pick(d: Design, scroll = false) {
    setKey(d.key);
    setNote(null);
    // On a narrow screen the card sits below the whole list; take the lifter to it.
    if (scroll && window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() =>
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }

  async function copy() {
    if (!card) return;
    const lines = [
      `${text.name}, ${LIFTS[lift].name.toLowerCase()} (e1RM ${wt(e1rm, unit)})`,
      ...rowsOf(card.sets).map(
        (r) =>
          `${r.first === r.last ? `Set ${r.first}` : `Sets ${r.first}–${r.last}`}, ${r.s.group}: ${repsLabel(r.s)} @ ${fmt(r.s.pct, 0)}% (${bar(r.s.pct)}), ${rpeLabel(r.s)}, stop below ${ms(r.s.stopV)}${
            r.next ? `, ${thenLabel(r)}` : ""
          }`,
      ),
      ...card.rules.map((r) => `- ${r}`),
      `${card.totals.approximate ? "Up to " : ""}${card.totals.reps} reps, neural dose ${fmt(card.totals.neural, 0)}, about ${card.totals.minutes} min.`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setNote("Copied. Paste it into your notes for the gym.");
    } catch {
      setNote("Couldn't reach the clipboard here.");
    }
  }

  const list = DESIGNS.filter((d) => d.family === family);

  return (
    <section className="stack-lg designer" aria-labelledby="design-h">
      <div className="stack">
        <h2 id="design-h" style={{ fontSize: 30 }}>
          Design a session
        </h2>
        <p>
          Pick one of {DESIGNS.length} set structures. Each fills in from this
          profile: bar weights from the max, a stop velocity for every set from
          the fresh speed at that load, and the road each set is on from L*.
          Bars above the red line are on the load road; grey ones below it are
          on the fatigue road.
        </p>
      </div>

      <div className="segmented" role="group" aria-label="Goal">
        {(["strength", "hypertrophy"] as Family[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={family === f}
            onClick={() => {
              setFamily(f);
              if (designByKey(key)?.family !== f)
                pick(DESIGNS.find((d) => d.family === f)!);
            }}
          >
            {f === "strength" ? "Strength" : "Hypertrophy"} (
            {DESIGNS.filter((d) => d.family === f).length})
          </button>
        ))}
      </div>

      <div className="design-grid" role="list">
        {list.map((d) => {
          const preview = previews[d.key];
          return (
            <button
              key={d.key}
              type="button"
              role="listitem"
              className="design-card"
              aria-pressed={d.key === key}
              onClick={() => pick(d, true)}
            >
              <span className="design-name">{DESIGN_TEXT[d.key].name}</span>
              <span className="design-summary">
                {DESIGN_TEXT[d.key].summary}
              </span>
              {preview ? (
                <Shape card={preview} lstar={ctx.lstar} />
              ) : (
                <span className="design-off">Not for this lift or profile</span>
              )}
            </button>
          );
        })}
      </div>

      <article
        ref={cardRef}
        className="panel stack session-card"
        aria-labelledby="card-h"
      >
        <div className="stack-sm">
          <h3 id="card-h" style={{ fontSize: 28 }}>
            {text.name}
          </h3>
          <p className="muted">{text.explanation}</p>
        </div>

        {why ? (
          <p className="flag">{why}</p>
        ) : needsSpotter ? (
          <div className="flag stack-sm">
            <p>
              Rest-pause on a barbell {LIFTS[lift].name.toLowerCase()} only with
              a spotter or rack safeties set at the right height.
            </p>
            <label className="check">
              <input
                type="checkbox"
                onChange={(e) => {
                  setSpotter(e.target.checked);
                  try {
                    localStorage.setItem(
                      SPOTTER_KEY,
                      e.target.checked ? "1" : "0",
                    );
                  } catch {
                    // Storage blocked: the confirmation lasts for this visit.
                  }
                }}
              />
              I train with a spotter or rack safeties
            </label>
          </div>
        ) : (
          card && (
            <>
              {design.params.length > 0 && (
                <div className="knobs">
                  {design.params.map((p) => {
                    const v = card.values[p.key];
                    const [lo, hi] = card.bounds[p.key];
                    const step = p.step ?? 1;
                    if (p.choices) {
                      return (
                        <div key={p.key} className="knob">
                          <span className="field-label">{p.label}</span>
                          <div
                            className="segmented"
                            role="group"
                            aria-label={p.label}
                          >
                            {p.choices.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                aria-pressed={v === c.value}
                                onClick={() => setValue(p.key, c.value)}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    const shown =
                      p.unit === "%"
                        ? `${v}%`
                        : p.unit === "s"
                          ? `${v} s`
                          : p.unit === "min"
                            ? `${v} min`
                            : `${v}`;
                    return (
                      <div key={p.key} className="knob">
                        <span className="field-label" id={`k-${p.key}`}>
                          {p.label}
                        </span>
                        <div
                          className="stepper"
                          role="group"
                          aria-labelledby={`k-${p.key}`}
                        >
                          <button
                            type="button"
                            aria-label={`Less ${p.label.toLowerCase()}`}
                            disabled={v - step < lo - 1e-9}
                            onClick={() => setValue(p.key, v - step)}
                          >
                            −
                          </button>
                          <output aria-live="polite">{shown}</output>
                          <button
                            type="button"
                            aria-label={`More ${p.label.toLowerCase()}`}
                            disabled={v + step > hi + 1e-9}
                            onClick={() => setValue(p.key, v + step)}
                          >
                            +
                          </button>
                        </div>
                        <span className="knob-range">
                          {lo === hi
                            ? "fixed for this profile"
                            : `${lo}–${hi}${p.unit === "%" ? "%" : p.unit === "s" ? " s" : p.unit === "min" ? " min" : ""}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Load</th>
                      <th>Reps</th>
                      <th>Stop below</th>
                      <th>Then</th>
                      <th>Road</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsOf(card.sets).map((row) => {
                      const s = row.s;
                      return (
                        <tr key={row.first}>
                          <td className="set-name">
                            {setsLabel(row)}
                            <small>{s.group}</small>
                          </td>
                          <td>
                            <strong>{bar(s.pct)}</strong>
                            <small className="cell-note">
                              {fmt(s.pct, 0)}%
                            </small>
                          </td>
                          <td>
                            {repsLabel(s)}
                            <small className="cell-note">{rpeLabel(s)}</small>
                          </td>
                          <td>{ms(s.stopV)}</td>
                          <td>{thenLabel(row)}</td>
                          <td>
                            {s.road ? (
                              <span className={`road road-${s.road}`}>
                                {s.road === "load" ? "Load" : "Fatigue"}
                              </span>
                            ) : (
                              "–"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="totals">
                {card.totals.approximate ? "Up to " : ""}
                {card.totals.reps} reps in {card.totals.sets}{" "}
                {card.totals.sets === 1 ? "set" : "sets"}, neural dose{" "}
                {fmt(card.totals.neural, 0)}, about {card.totals.minutes} min.
              </p>

              {card.rules.length > 0 && (
                <ul className="rules">
                  {card.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              {text.cue && <p className="cue">“{text.cue}”</p>}

              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
                  onClick={copy}
                >
                  Copy for the gym
                </button>
                {note && (
                  <span className="small muted" role="status">
                    {note}
                  </span>
                )}
              </div>
            </>
          )
        )}
      </article>
    </section>
  );
}
