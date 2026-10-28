import { Fragment, useMemo, useRef, useState } from "react";
import { DESIGN_TEXT } from "../content/designs";
import type { Analysis } from "../engine/analyze";
import { LIFTS } from "../engine/constants";
import {
  buildCard,
  contextFor,
  type Card,
  type CardSet,
  type Edits,
  type SetEdit,
} from "../engine/sessions/card";
import {
  DESIGNS,
  designByKey,
  SHAPE_NAMES,
  type Design,
  type DesignCtx,
  type Family,
  type Param,
  type Shape as ShapeKey,
  type Values,
} from "../engine/sessions/designs";
import { halfPoint } from "../engine/sessions/effort";
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

const loadText = (pct: number) =>
  `${fmt(pct, Number.isInteger(pct) ? 0 : 1)}%`;

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

const rpeLabel = (s: CardSet) =>
  `RPE ${s.ceiling ? "≤ " : ""}${halfPoint(s.rpe)}`;
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

/** A knob's value in words: its own words if it has them, else the number and unit. */
function valueText(p: Param, x: number, v: Values): string {
  if (p.show) return p.show(x, v);
  return p.unit === "%"
    ? `${x}%`
    : p.unit === "s"
      ? `${x} s`
      : p.unit === "min"
        ? `${x} min`
        : `${x}`;
}

/** What a stepper can reach: a range, a short list, or where it is among named options. */
function rangeText(p: Param, allowed: number[], x: number): string {
  if (allowed.length === 1) return "the only option here";
  if (p.coded) return `${allowed.indexOf(x) + 1} of ${allowed.length}`;
  const unit =
    p.unit === "%" ? "%" : p.unit === "s" ? " s" : p.unit === "min" ? " min" : "";
  const last = allowed[allowed.length - 1];
  const runs = allowed.every((y, i) => i === 0 || y - allowed[i - 1] === 1);
  if (runs) return `${allowed[0]}–${last}${unit}`;
  return `${allowed.slice(0, -1).join(", ")} or ${last}${unit}`;
}

/** A plain numeric stepper for editing one set. */
function Stepper({
  label,
  value,
  show,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  show: (x: number) => string;
  min: number;
  max: number;
  step: number;
  onChange: (x: number) => void;
}) {
  const id = `e-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="knob">
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} disabled={value - step < min} onClick={() => onChange(value - step)}>
          −
        </button>
        <output aria-live="polite">{show(value)}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value + step > max} onClick={() => onChange(value + step)}>
          +
        </button>
      </div>
    </div>
  );
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
  /** Felt RPE across the run, lowest and highest. */
  felt: [number, number] | null;
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
    !a.edited &&
    !b.edited &&
    JSON.stringify(a.reps) === JSON.stringify(b.reps);
  for (const s of sets) {
    const prev = out[out.length - 1];
    if (prev && prev.after === undefined && same(prev.s, s)) {
      prev.last = s.n;
      if (s.felt != null && prev.felt) prev.felt = [Math.min(prev.felt[0], s.felt), Math.max(prev.felt[1], s.felt)];
      else prev.felt = null;
      // The run closes on a set whose gap differs: the end of a block or of the session.
      if (s.next !== prev.next) prev.after = s.next;
    } else out.push({ first: s.n, last: s.n, s, next: s.next, felt: s.felt != null ? [s.felt, s.felt] : null });
  }
  return out;
}

/** When the sets before make a run feel harder than its label, say so (half a point or more by its end). */
function feltNote(r: Row): string | null {
  if (!r.felt || r.s.ceiling || r.felt[1] - r.s.rpe < 0.45) return null;
  const word = (x: number) => (x >= 9.95 ? "failure" : `${halfPoint(x)}`);
  const lo = halfPoint(r.felt[0]);
  const hi = halfPoint(r.felt[1]);
  if (hi - halfPoint(r.s.rpe) < 0.5) return null;
  return r.first !== r.last && hi - lo >= 0.5 ? `feels like RPE ${word(lo)} rising to ${word(hi)}` : `feels like RPE ${word(hi)} after the sets before it`;
}

function thenLabel(r: Row): string {
  const base = nextLabel({ ...r.s, next: r.next });
  if (r.after === undefined || r.after === 0 || r.first === r.last) return base;
  return `${base}, then ${clock(r.after)}`;
}

const setsLabel = (r: Row) =>
  r.first === r.last ? `${r.first}` : `${r.first}–${r.last}`;

/** The session's size in a sentence: reps, sets, neural dose against its band, minutes. */
function totalsText(card: Card, family: Family): string {
  const t = card.totals;
  if (t.reps == null || t.neural == null) {
    return `One ${t.minutes}-minute block. The reps are whatever clean work fits in it, so there's no rep count or neural dose to add up.`;
  }
  const [lo, hi] = t.target;
  const n = Math.round(t.neural);
  const where = n < lo ? "under" : n > hi ? "over" : "inside";
  return `${t.approximate ? "Up to " : ""}${t.reps} reps in ${t.sets} ${
    t.sets === 1 ? "set" : "sets"
  }, about ${t.minutes} min. Neural dose ${n}, ${where} the ${lo}–${hi} a ${family} block aims for.`;
}

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
  const [shape, setShape] = useState<ShapeKey | "all">("all");
  const [edits, setEdits] = useState<Record<string, Edits>>({});
  const [history, setHistory] = useState<Array<{ key: string; inputs: Partial<Values>; edits: Edits }>>([]);
  const [editing, setEditing] = useState<number | null>(null);
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
    () => (why ? null : buildCard(design, ctx, inputs[key], edits[key])),
    [why, design, ctx, inputs, edits, key],
  );
  const speeds = ctx.fresh(75) != null;

  const bar = (pct: number) => wt(suggestBarLb(e1rm, pct, unit), unit);
  // Every change is one undo step: the knobs and set edits of this design as they were.
  const remember = () =>
    setHistory((h) => [...h.slice(-29), { key, inputs: inputs[key] ?? {}, edits: edits[key] ?? {} }]);
  // Only the knobs a lifter touches are stored, so the rest keep following their own rules.
  // A knob change rebuilds the sets, so hand edits to them are dropped.
  const setValue = (k: string, v: number) => {
    remember();
    setInputs((all) => ({ ...all, [key]: { ...all[key], [k]: v } }));
    setEdits((all) => ({ ...all, [key]: {} }));
    setEditing(null);
  };
  const editSet = (i: number, e: SetEdit) => {
    remember();
    setEdits((all) => ({ ...all, [key]: { ...all[key], [i]: { ...all[key]?.[i], ...e } } }));
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setKey(last.key);
    setInputs((all) => ({ ...all, [last.key]: last.inputs }));
    setEdits((all) => ({ ...all, [last.key]: last.edits }));
    setEditing(null);
  };
  const canUndo = history.length > 0 && history[history.length - 1].key === key;

  const cardRef = useRef<HTMLElement>(null);
  function pick(d: Design, scroll = false) {
    setKey(d.key);
    setNote(null);
    setEditing(null);
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
          `${r.first === r.last ? `Set ${r.first}` : `Sets ${r.first}–${r.last}`}, ${r.s.group}: ${repsLabel(r.s)} @ ${loadText(r.s.pct)} (${bar(r.s.pct)}), ${rpeLabel(r.s)}${
            feltNote(r) ? ` (${feltNote(r)})` : ""
          }, ${r.s.single ? "check" : "stop below"} ${ms(r.s.stopV)}${r.next ? `, ${thenLabel(r)}` : ""}`,
      ),
      ...card.rules.map((r) => `- ${r}`),
      totalsText(card, design.family),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setNote("Copied. Paste it into your notes for the gym.");
    } catch {
      setNote("Couldn't reach the clipboard here.");
    }
  }

  const inFamily = DESIGNS.filter((d) => d.family === family);
  const shapes = (["all", ...Object.keys(SHAPE_NAMES)] as Array<ShapeKey | "all">).filter(
    (k) => k === "all" || inFamily.some((d) => d.shape === k),
  );
  const list = inFamily.filter((d) => shape === "all" || d.shape === shape);

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
          {ctx.lstar != null
            ? " Bars above the red line are on the load road; grey ones below it are on the fatigue road."
            : " This probe has no L*, so the roads stay blank, and designs that start at L* + 1 use a standard floor instead."}
        </p>
        {!speeds && (
          <p className="flag">
            This probe has no bar speeds, so the card can give loads, reps
            and effort but no stop velocities.
          </p>
        )}
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

      <div className="segmented segmented-quiet" role="group" aria-label="Shape of the loads">
        {shapes.map((k) => (
          <button key={k} type="button" aria-pressed={shape === k} onClick={() => setShape(k)}>
            {k === "all" ? "All shapes" : SHAPE_NAMES[k]}
          </button>
        ))}
      </div>

      <ul className="design-grid" aria-label={`${family} designs`}>
        {list.map((d) => {
          const preview = previews[d.key];
          return (
            <li key={d.key}>
              <button
                type="button"
                className="design-card"
                aria-pressed={d.key === key}
                onClick={() => pick(d, true)}
              >
                <span className="design-name">
                  {DESIGN_TEXT[d.key].name}
                  {DESIGN_TEXT[d.key].draft && <span className="draft-tag">Experimental</span>}
                </span>
                <span className="design-summary">
                  {DESIGN_TEXT[d.key].summary}
                </span>
                {preview ? (
                  <Shape card={preview} lstar={ctx.lstar} />
                ) : (
                  <span className="design-off">
                    Not for this lift or profile
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <article
        ref={cardRef}
        className="panel stack session-card"
        aria-labelledby="card-h"
      >
        <div className="stack-sm">
          <div className="card-head">
            <h3 id="card-h" style={{ fontSize: 28 }}>
              {text.name}
              {text.draft && <span className="draft-tag">Experimental</span>}
            </h3>
            {canUndo && (
              <button type="button" className="btn btn-small btn-quiet" onClick={undo}>
                Undo
              </button>
            )}
          </div>
          <p className="muted">{text.explanation}</p>
          {text.draft && (
            <p className="small muted">
              One of the eight designs added Oct 24, 2026. The structure is settled; the words are a draft.
            </p>
          )}
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
                    const allowed = card.options[p.key];
                    const at = allowed.indexOf(v);
                    if (p.buttons) {
                      return (
                        <div key={p.key} className="knob">
                          <span className="field-label">{p.label}</span>
                          <div
                            className="segmented"
                            role="group"
                            aria-label={p.label}
                          >
                            {allowed.map((x) => (
                              <button
                                key={x}
                                type="button"
                                aria-pressed={v === x}
                                onClick={() => setValue(p.key, x)}
                              >
                                {valueText(p, x, card.values)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    const word = p.coded ? "Previous" : "Less";
                    const more = p.coded ? "Next" : "More";
                    return (
                      <div
                        key={p.key}
                        className={p.coded ? "knob knob-wide" : "knob"}
                      >
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
                            aria-label={`${word} ${p.label.toLowerCase()}`}
                            disabled={at <= 0}
                            onClick={() => setValue(p.key, allowed[at - 1])}
                          >
                            −
                          </button>
                          <output aria-live="polite">
                            {valueText(p, v, card.values)}
                          </output>
                          <button
                            type="button"
                            aria-label={`${more} ${p.label.toLowerCase()}`}
                            disabled={at >= allowed.length - 1}
                            onClick={() => setValue(p.key, allowed[at + 1])}
                          >
                            +
                          </button>
                        </div>
                        <span className="knob-range">
                          {rangeText(p, allowed, v)}
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
                      const felt = feltNote(row);
                      const open = editing === s.n - 1;
                      const e = card.values && (edits[key]?.[s.n - 1] ?? {});
                      const repsN =
                        s.reps.kind === "fixed" || s.reps.kind === "upTo"
                          ? s.reps.n
                          : s.reps.kind === "cluster"
                            ? s.reps.parts[0]
                            : s.reps.kind === "toStop"
                              ? s.reps.about
                              : null;
                      return (
                        <Fragment key={row.first}>
                        <tr className={s.edited ? "edited" : undefined}>
                          <td className="set-name">
                            {setsLabel(row)}
                            <small>{s.group}</small>
                            {row.first === row.last && (
                              <button
                                type="button"
                                className="link-btn small"
                                aria-expanded={open}
                                onClick={() => setEditing(open ? null : s.n - 1)}
                              >
                                {open ? "Done" : s.edited ? "Edited" : "Edit"}
                              </button>
                            )}
                          </td>
                          <td>
                            <strong>{bar(s.pct)}</strong>
                            <small className="cell-note">
                              {loadText(s.pct)}
                            </small>
                          </td>
                          <td>
                            {repsLabel(s)}
                            <small className="cell-note">{rpeLabel(s)}</small>
                            {felt && <small className="cell-note felt">{felt}</small>}
                          </td>
                          <td>
                            {ms(s.stopV)}
                            {s.single && s.stopV != null && (
                              <small className="cell-note">
                                a check, not a stop
                              </small>
                            )}
                          </td>
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
                        {open && (
                          <tr className="edit-row">
                            <td colSpan={6}>
                              <div className="knobs">
                                <Stepper
                                  label={`Set ${s.n} load`}
                                  value={s.pct}
                                  show={(x) => `${loadText(x)} · ${bar(x)}`}
                                  min={40}
                                  max={97}
                                  step={1}
                                  onChange={(x) => editSet(s.n - 1, { pct: x })}
                                />
                                {repsN != null && (
                                  <Stepper
                                    label={`Set ${s.n} ${s.reps.kind === "cluster" ? "reps per mini-set" : s.reps.kind === "fixed" ? "reps" : "reps, about"}`}
                                    value={repsN}
                                    show={(x) => `${x}`}
                                    min={1}
                                    max={20}
                                    step={1}
                                    onChange={(x) => editSet(s.n - 1, { reps: x })}
                                  />
                                )}
                                {s.next > 0 && (
                                  <Stepper
                                    label={s.clock ? `Set ${s.n} clock` : `Rest after set ${s.n}`}
                                    value={s.next}
                                    show={clock}
                                    min={15}
                                    max={600}
                                    step={15}
                                    onChange={(x) => editSet(s.n - 1, { next: x })}
                                  />
                                )}
                                {s.edited && (
                                  <div className="knob">
                                    <span className="field-label">&nbsp;</span>
                                    <button
                                      type="button"
                                      className="btn btn-small btn-quiet"
                                      onClick={() => {
                                        remember();
                                        setEdits((all) => {
                                          const next = { ...all[key] };
                                          delete next[s.n - 1];
                                          return { ...all, [key]: next };
                                        });
                                      }}
                                    >
                                      Back to the recipe
                                    </button>
                                  </div>
                                )}
                              </div>
                              {Object.keys(e).length === 0 && (
                                <p className="small muted">Changing a knob above rebuilds the sets and drops hand edits. Undo brings them back.</p>
                              )}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="totals">{totalsText(card, design.family)}</p>

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
