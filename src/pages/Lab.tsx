// Session lab: a prototype of one engine for every set structure.
import { useMemo, useState } from "react";
import { LIFTS } from "../engine/constants";
import { PRESETS, presetByKey, type Preset } from "../engine/lab/presets";
import { blankBlock, FATIGUE, HEAVY, readout, SHAPES, simulate, type Block, type LabSet, type ShapeKey, type Spec } from "../engine/lab/sessionLab";
import { contextFor } from "../engine/sessions/card";
import { fmt, ms, suggestBarLb, usePageTitle, wt } from "../format";
import { useStore } from "../store";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const loadText = (pct: number) => `${fmt(pct, Number.isInteger(pct) ? 0 : 1)}%`;
const rpeText = (x: number) => (x < 5 ? "under 5" : `${Math.round(x * 2) / 2}`);
const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];
const FIDELITY = { exact: "Exact", close: "Close", approximate: "Approximate" } as const;

function valueText(s: Spec, x: number): string {
  if (s.show) return s.show(x);
  if (s.unit === "%") return `${x}%`;
  if (s.unit === "s") return x >= 60 ? clock(x) : `${x} s`;
  return `${x}`;
}

function Knob({ spec, value, onChange, idPrefix }: { spec: Spec; value: number; onChange: (x: number) => void; idPrefix: string }) {
  const id = `${idPrefix}-${spec.key}`;
  if (spec.buttons) {
    return (
      <div className="knob knob-wide">
        <span className="field-label">{spec.label}</span>
        <div className="segmented" role="group" aria-label={spec.label}>
          {spec.buttons.map(([x, label]) => (
            <button key={x} type="button" aria-pressed={value === x} onClick={() => onChange(x)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const step = (d: number) => onChange(Math.min(spec.max, Math.max(spec.min, Math.round((value + d) * 100) / 100)));
  return (
    <div className="knob">
      <span className="field-label" id={id}>
        {spec.label}
      </span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button type="button" aria-label={`Less: ${spec.label.toLowerCase()}`} disabled={value - spec.step < spec.min - 1e-9} onClick={() => step(-spec.step)}>
          −
        </button>
        <output aria-live="polite">{valueText(spec, value)}</output>
        <button type="button" aria-label={`More: ${spec.label.toLowerCase()}`} disabled={value + spec.step > spec.max + 1e-9} onClick={() => step(spec.step)}>
          +
        </button>
      </div>
    </div>
  );
}

function repsText(s: LabSet): string {
  if (s.parts.length > 1) return `${s.parts.join("+")}, ${s.intra} s between`;
  return s.ecc ? `${s.parts[0]}, ${s.ecc} s down` : `${s.parts[0]}`;
}

export default function Lab() {
  usePageTitle("Session lab");
  const { analysis: a, unit, source } = useStore();
  const lift = a.probe.lift;
  const ctx = useMemo(() => contextFor(a, lift, a.probe.mvt), [a, lift]);
  const [presetKey, setPresetKey] = useState("topSetBackoff");
  const [blocks, setBlocks] = useState<Block[]>(() => presetByKey("topSetBackoff")!.blocks);
  const [edited, setEdited] = useState(false);
  const preset: Preset | null = presetByKey(presetKey);

  const sets = useMemo(() => simulate(blocks, ctx), [blocks, ctx]);
  const r = useMemo(() => readout(sets, ctx.lstar), [sets, ctx.lstar]);
  const bar = (pct: number) => wt(suggestBarLb(a.probe.e1rm, pct, unit), unit);

  const choose = (key: string) => {
    setPresetKey(key);
    setEdited(false);
    const p = presetByKey(key);
    setBlocks(p ? p.blocks.map((b) => ({ shape: b.shape, v: { ...b.v } })) : [blankBlock("constant")]);
  };
  const change = (i: number, next: Block) => {
    setEdited(true);
    setBlocks((all) => all.map((b, j) => (j === i ? next : b)));
  };

  return (
    <div className="stack-lg lab">
      <div className="stack">
        <p className="lab-tag">Prototype</p>
        <h1 style={{ fontSize: "clamp(32px, 4.6vw, 46px)" }}>Session lab</h1>
        <p>
          One engine for every set structure. A session is one to four blocks, each block is one of six shapes, and every
          set comes down to three dials: the load (read against L*), the rule that ends the set, and the rest. One fatigue
          model runs across the whole session, so every RPE comes from the same place. Strength and hypertrophy aren't
          families here; they're what the readout says the dials produce.
        </p>
        <p className="small muted">
          Filled in from {source === "example" ? "the example" : "your"} {LIFTS[lift].name.toLowerCase()} profile
          {ctx.lstar != null ? `, L* ${fmt(ctx.lstar, 1)}%` : ", which has no L*"}. Nothing here is saved.
        </p>
      </div>

      <div className="field" style={{ maxWidth: 520 }}>
        <label htmlFor="lab-preset">Start from one of the 26 designs</label>
        <select id="lab-preset" value={presetKey} onChange={(e) => choose(e.target.value)}>
          <optgroup label="Filed under strength">
            {PRESETS.filter((p) => p.was === "strength").map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Filed under hypertrophy">
            {PRESETS.filter((p) => p.was === "hypertrophy").map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <option value="blank">A blank block</option>
        </select>
        {preset && (
          <p className="field-hint">
            <span className={`fid fid-${preset.fidelity}`}>{FIDELITY[preset.fidelity]}</span> {preset.note}
            {edited ? " (Edited since.)" : ""}
          </p>
        )}
      </div>

      {blocks.map((b, i) => (
        <section key={i} className="panel stack lab-block" aria-label={`Block ${i + 1}`}>
          <div className="lab-block-head">
            <h2 style={{ fontSize: 24 }}>
              Block {i + 1}: {SHAPES[b.shape].name}
            </h2>
            {blocks.length > 1 && (
              <button
                type="button"
                className="btn btn-small btn-quiet"
                onClick={() => {
                  setEdited(true);
                  setBlocks((all) => all.filter((_, j) => j !== i));
                }}
              >
                Remove
              </button>
            )}
          </div>
          <div className="segmented" role="group" aria-label={`Block ${i + 1} shape`}>
            {SHAPE_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={b.shape === k} onClick={() => b.shape !== k && change(i, blankBlock(k))}>
                {SHAPES[k].name}
              </button>
            ))}
          </div>
          <p className="small muted">{SHAPES[b.shape].blurb}</p>
          <div className="knobs">
            {SHAPES[b.shape].specs
              .filter((s) => !s.when || s.when(b.v))
              .filter((s) => !(s.key === "after" && i === blocks.length - 1))
              .map((s) => (
                <Knob key={s.key} idPrefix={`lab-b${i}`} spec={s} value={b.v[s.key]} onChange={(x) => change(i, { ...b, v: { ...b.v, [s.key]: x } })} />
              ))}
          </div>
        </section>
      ))}
      {blocks.length < 4 && (
        <div>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            onClick={() => {
              setEdited(true);
              setBlocks((all) => [...all, blankBlock("constant")]);
            }}
          >
            Add a block
          </button>
        </div>
      )}

      <section className="stack" aria-labelledby="lab-sets">
        <h2 id="lab-sets" style={{ fontSize: 30 }}>
          The session
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Set</th>
                <th>Load</th>
                <th>Reps</th>
                <th>Ends at</th>
                <th>Stop below</th>
                <th>Carried in</th>
                <th>Then</th>
                <th>Road</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.n}>
                  <td className="set-name">
                    {s.n}
                    <small>
                      {blocks.length > 1 ? `B${s.block + 1} · ` : ""}
                      {s.group}
                    </small>
                  </td>
                  <td>
                    <strong>{bar(s.load)}</strong>
                    <small className="cell-note">{loadText(s.load)}</small>
                  </td>
                  <td>
                    {repsText(s)}
                    {s.cutShort && <small className="cell-note warn">fewer than asked: nothing left</small>}
                  </td>
                  <td>
                    RPE {rpeText(s.rpe)}
                    <small className={s.overCeiling ? "cell-note warn" : "cell-note"}>
                      {s.overCeiling
                        ? s.parts.some((p) => p >= 6)
                          ? "past 7.5 for 6+ reps"
                          : "past RPE 9"
                        : s.stopKind === 1
                          ? "drop rep"
                          : s.target != null
                            ? `stop at ${s.target}`
                            : "fixed reps"}
                    </small>
                  </td>
                  <td>
                    {ms(s.stopV)}
                    {s.single && s.stopV != null && <small className="cell-note">a check, not a stop</small>}
                  </td>
                  <td>{s.fatigue >= 0.1 ? `−${fmt(s.fatigue, 1)} reps` : "fresh"}</td>
                  <td>{s.rest ? `rest ${clock(s.rest)}` : "–"}</td>
                  <td>{s.road ? <span className={`road road-${s.road}`}>{s.road === "load" ? "Load" : "Fatigue"}</span> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          "Carried in" is the capacity, in reps at that load, still missing from earlier sets when this one starts. Right
          after a set, capacity is down by the reps just done; most of it returns with a half-life of{" "}
          {FATIGUE.fastHalfLife[0]}–{FATIGUE.fastHalfLife[1]} s (longer after harder sets), and{" "}
          {FATIGUE.slowShare[0] * 100}–{FATIGUE.slowShare[1] * 100}% lingers for the session (half-life{" "}
          {FATIGUE.slowHalfLife / 60} min). Provisional numbers, tuned to SA's straight-set drift and rest-interval
          studies.
        </p>
      </section>

      <section className="panel stack lab-readout" aria-labelledby="lab-read">
        <h2 id="lab-read" style={{ fontSize: 26 }}>
          What it adds up to: <span className={`lean lean-${r.lean}`}>{r.lean === "mixed" ? "mixed" : `${r.lean}-leaning`}</span>
        </h2>
        <p>{r.why}</p>
        <div className="lab-stats">
          <div>
            <strong>{r.reps}</strong>
            <span>reps in {r.sets} sets</span>
          </div>
          <div>
            <strong>{Math.round(r.heavy * 100)}%</strong>
            <span>of reps at {HEAVY}% or more</span>
          </div>
          <div>
            <strong>{r.effective ?? "–"}</strong>
            <span>effective reps (load road, or within 3 of failure below L*)</span>
          </div>
          <div>
            <strong>{Math.round(r.quality * 100)}%</strong>
            <span>of reps before the peak-force drop</span>
          </div>
          <div>
            <strong>{r.velocityLoss != null ? `${fmt(r.velocityLoss, 0)}%` : "–"}</strong>
            <span>average velocity loss when a set ends</span>
          </div>
          <div>
            <strong>{fmt(r.neural, 0)}</strong>
            <span>neural dose</span>
          </div>
          <div>
            <strong>{r.minutes} min</strong>
            <span>about</span>
          </div>
        </div>
        <p className="small muted">
          The lean is a provisional rule for poking at: strength-leaning when at least half the reps are at {HEAVY}% or
          more and sets end before about 25% velocity loss; hypertrophy-leaning when most reps are lighter and at least 25
          of them count as effective; mixed otherwise.
        </p>
      </section>
    </div>
  );
}
