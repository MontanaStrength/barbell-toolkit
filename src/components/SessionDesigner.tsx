import { useEffect, useMemo, useRef, useState } from "react";
import { DESIGN_TEXT } from "../content/designs";
import type { Analysis } from "../engine/analyze";
import { LIFTS } from "../engine/constants";
import { contextFor, type CardSet } from "../engine/sessions/card";
import {
  DESIGNS,
  designByKey,
  type Design,
  type DesignCtx,
  type Param,
  type Values,
} from "../engine/sessions/designs";
import { evaluateSession } from "../engine/sessions/evaluation";
import {
  buildWorkspace,
  materializeWorkspace,
  editWorkspaceSet,
  duplicateWorkspaceSet,
  moveWorkspaceSet,
  removeWorkspaceSet,
  STRUCTURE_TAGS,
  recipeTags,
  type StructureTag,
  type Workspace,
  type WorkspaceSet,
} from "../engine/sessions/workspace";
import {
  loadDraft,
  saveDraft,
  profileSignature,
  type SessionDraft,
} from "../engine/sessions/draft";
import {
  repsLabel,
  thenLabel,
  gymCardText,
  projectedEffortText,
} from "../engine/sessions/presentation";
import { fmt, ms, toUnit, plateStep, type Unit } from "../format";
import { useStore } from "../store";
import SessionSetEditor from "./SessionSetEditor";
import SessionProfile from "./SessionProfile";

const SPOTTER_KEY = "barbell-toolkit/spotter/v1";
const loadText = (pct: number) => `${fmt(pct, 1)}%`;
const wt = (lb: number, unit: Unit) =>
  `${Number(toUnit(lb, unit).toFixed(2))} ${unit}`;
const EMPTY_WORKSPACE: Workspace = {
  values: {},
  options: {},
  sets: [],
  rules: [],
  warnings: [],
  totals: {
    sets: 0,
    reps: null,
    neural: null,
    target: [0, 0],
    minutes: 0,
    seconds: 0,
    approximate: false,
    repKind: "fixed",
  },
};
function loadSpotter() {
  try {
    return localStorage.getItem(SPOTTER_KEY) === "1";
  } catch {
    return false;
  }
}
function blocked(d: Design, ctx: DesignCtx): string | null {
  if (d.lifts && !d.lifts.includes(ctx.lift))
    return `This recipe is not available for ${LIFTS[ctx.lift].name.toLowerCase()}.`;
  return d.unavailable?.(ctx) ?? null;
}
function valueText(p: Param, x: number, v: Values): string {
  return p.show
    ? p.show(x, v)
    : `${x}${p.unit === "%" ? "%" : p.unit ? ` ${p.unit}` : ""}`;
}
function Shape({ sets, lstar }: { sets: CardSet[]; lstar: number | null }) {
  const parts = sets.flatMap((s) =>
    (s.reps.kind === "cluster"
      ? s.reps.parts
      : [
          s.reps.kind === "timed"
            ? 10
            : s.reps.kind === "toStop"
              ? s.reps.about
              : s.reps.n,
        ]
    ).map((n) => ({ pct: s.pct, reps: n })),
  );
  const total = parts.reduce((n, p) => n + Math.min(p.reps, 15) + 2, 0) || 1;
  const y = (pct: number) => 38 - (Math.max(0, Math.min(100, pct)) / 100) * 35;
  let x = 0;
  return (
    <svg
      className="shape"
      viewBox="0 0 160 42"
      width="160"
      height="42"
      role="img"
      aria-label="Load and rep arrangement; dashed line marks the profile L star"
    >
      {parts.map((p, i) => {
        const width = (Math.min(p.reps, 15) / total) * 158;
        const left = x;
        x += ((Math.min(p.reps, 15) + 2) / total) * 158;
        return (
          <rect
            key={i}
            x={left}
            y={y(p.pct)}
            width={width}
            height={40 - y(p.pct)}
            rx="1"
            className="shape-load"
          />
        );
      })}
      {lstar != null && (
        <line
          x1="0"
          x2="160"
          y1={y(lstar)}
          y2={y(lstar)}
          className="shape-lstar"
        />
      )}
    </svg>
  );
}
function RecipeKnobs({
  design,
  workspace,
  onChange,
}: {
  design: Design;
  workspace: Workspace;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div className="knobs">
      {design.params.map((p) => {
        const options = workspace.options[p.key] ?? [],
          value = workspace.values[p.key],
          index = options.indexOf(value);
        return (
          <div className={p.coded ? "knob knob-wide" : "knob"} key={p.key}>
            <span className="field-label" id={`recipe-${p.key}`}>
              {p.label}
            </span>
            {p.buttons ? (
              <div
                className="segmented"
                role="group"
                aria-labelledby={`recipe-${p.key}`}
              >
                {options.map((x) => (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={value === x}
                    onClick={() => onChange(p.key, x)}
                  >
                    {valueText(p, x, workspace.values)}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="stepper"
                role="group"
                aria-labelledby={`recipe-${p.key}`}
              >
                <button
                  type="button"
                  aria-label={`${p.coded ? "Previous" : "Less"} ${p.label.toLowerCase()}`}
                  disabled={index <= 0}
                  onClick={() => onChange(p.key, options[index - 1])}
                >
                  −
                </button>
                <output>{valueText(p, value, workspace.values)}</output>
                <button
                  type="button"
                  aria-label={`${p.coded ? "Next" : "More"} ${p.label.toLowerCase()}`}
                  disabled={index < 0 || index >= options.length - 1}
                  onClick={() => onChange(p.key, options[index + 1])}
                >
                  +
                </button>
              </div>
            )}
            {options.length > 1 && !p.coded && (
              <span className="knob-range">
                {valueText(p, options[0], workspace.values)} –{" "}
                {valueText(p, options[options.length - 1], workspace.values)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
function totalsText(workspace: Workspace) {
  const t = workspace.totals;
  const reps =
    t.reps == null
      ? "Open rep count"
      : `${t.repKind === "ceiling" ? "Up to " : t.repKind === "estimate" ? "About " : ""}${t.reps} reps`;
  return `${reps} · ${t.sets} ${t.sets === 1 ? "set / block" : "sets / blocks"} · about ${t.minutes} min`;
}
function prescriptionRows(sets: WorkspaceSet[]) {
  const rows: Array<{ set: WorkspaceSet; last: number; finishes: boolean }> =
    [];
  for (const set of sets) {
    const prior = rows[rows.length - 1];
    if (
      prior &&
      !prior.finishes &&
      prior.set.group === set.group &&
      prior.set.loadLb === set.loadLb &&
      prior.set.rpe === set.rpe &&
      prior.set.ceiling === set.ceiling &&
      prior.set.clock === set.clock &&
      prior.set.tempo === set.tempo &&
      prior.set.recoverySeconds === set.recoverySeconds &&
      JSON.stringify(prior.set.reps) === JSON.stringify(set.reps)
    ) {
      prior.last = set.n;
      prior.finishes = set.n === sets.length;
    } else rows.push({ set, last: set.n, finishes: set.n === sets.length });
  }
  return rows;
}
function RuleEditor({
  rules,
  onApply,
}: {
  rules: string[];
  onApply: (rules: string[]) => void;
}) {
  const [text, setText] = useState(rules.join("\n"));
  return (
    <details className="session-details rule-editor">
      <summary>Edit execution rules</summary>
      <form
        className="stack-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(
            text
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 100),
          );
        }}
      >
        <label className="field-label" htmlFor="custom-execution-rules">
          One instruction per line
        </label>
        <textarea
          id="custom-execution-rules"
          value={text}
          maxLength={10000}
          rows={6}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="small muted">
          Keep conditional stops and recovery instructions consistent with the
          work above. These instructions are copied to the gym card.
        </p>
        <button className="btn btn-small" type="submit">
          Apply execution rules
        </button>
      </form>
    </details>
  );
}

export default function SessionDesigner({
  a,
  unit,
}: {
  a: Analysis;
  unit: Unit;
}) {
  const { source, viewed } = useStore();
  const scope = useMemo(
    () =>
      profileSignature(
        a.probe,
        source === "example" ? "example" : (viewed?.id ?? "mine"),
      ),
    [a.probe, source, viewed?.id],
  );
  return <RecipeWorkspace key={scope} a={a} unit={unit} scope={scope} />;
}

function RecipeWorkspace({
  a,
  unit,
  scope,
}: {
  a: Analysis;
  unit: Unit;
  scope: string;
}) {
  const ctx = useMemo(() => contextFor(a, a.probe.lift, a.probe.mvt), [a]);
  const [draft, setDraft] = useState<SessionDraft>(() =>
    loadDraft(scope, unit),
  );
  const [history, setHistory] = useState<SessionDraft[]>([]);
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All structures");
  const [editing, setEditing] = useState(false);
  const [spotter, setSpotter] = useState(loadSpotter);
  const [note, setNote] = useState<string | null>(null);
  const [gym, setGym] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const cardRef = useRef<HTMLElement>(null);
  const design = designByKey(draft.recipeKey) ?? DESIGNS[0];
  const text = DESIGN_TEXT[design.key];
  const why = blocked(design, ctx);
  const base = useMemo(
    () =>
      why
        ? EMPTY_WORKSPACE
        : buildWorkspace(
            design,
            ctx,
            draft.inputs[design.key],
            a.probe.e1rm,
            unit,
          ),
    [why, design, ctx, draft.inputs, a.probe.e1rm, unit],
  );
  const workspace = useMemo(
    () =>
      !why && draft.customSets
        ? materializeWorkspace(base, draft.customSets, ctx, a.probe.e1rm)
        : base,
    [why, base, draft.customSets, ctx, a.probe.e1rm],
  );
  const rules = draft.customRules[design.key] ?? workspace.rules;
  const rulesLabel = draft.customRules[design.key]
    ? "Your execution rules"
    : draft.customSets
      ? "Original recipe guidance — review after custom edits"
      : "Execution rules";
  const evaluation = useMemo(
    () => evaluateSession(workspace.sets, a.probe.lift, design.key),
    [workspace.sets, a.probe.lift, design.key],
  );
  const previews = useMemo(
    () =>
      Object.fromEntries(
        DESIGNS.map((d) => [
          d.key,
          blocked(d, ctx)
            ? null
            : buildWorkspace(d, ctx, {}, a.probe.e1rm, unit),
        ]),
      ),
    [ctx, a.probe.e1rm, unit],
  );
  const pinnedEvaluation = useMemo(
    () =>
      draft.pinned
        ? evaluateSession(
            draft.pinned.sets,
            a.probe.lift,
            draft.pinned.recipeKey,
          )
        : null,
    [draft.pinned, a.probe.lift],
  );
  const needsSpotter = !!design.spotter?.includes(a.probe.lift) && !spotter;
  const filtered = DESIGNS.filter((d) => {
    return (
      `${DESIGN_TEXT[d.key].name} ${DESIGN_TEXT[d.key].summary}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All structures" ||
        recipeTags(d.key).includes(filter as StructureTag))
    );
  });
  useEffect(() => {
    setSaved(saveDraft({ ...draft, unit }));
  }, [draft, unit]);
  function change(next: SessionDraft) {
    setHistory((h) => [...h.slice(-19), draft]);
    setDraft({ ...next, unit });
    setNote(null);
    setGym(null);
  }
  function pick(key: string) {
    const customByRecipe = { ...draft.customByRecipe };
    if (draft.customSets) customByRecipe[draft.recipeKey] = draft.customSets;
    change({
      ...draft,
      recipeKey: key,
      customByRecipe,
      customSets: customByRecipe[key] ?? null,
    });
    setLibrary(false);
    setEditing(false);
    requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function setValue(key: string, value: number) {
    const customByRecipe = { ...draft.customByRecipe };
    delete customByRecipe[design.key];
    const customRules = { ...draft.customRules };
    delete customRules[design.key];
    change({
      ...draft,
      inputs: {
        ...draft.inputs,
        [design.key]: { ...draft.inputs[design.key], [key]: value },
      },
      customSets: null,
      customByRecipe,
      customRules,
    });
  }
  function custom(sets: WorkspaceSet[]) {
    change({
      ...draft,
      customSets: sets,
      customByRecipe: { ...draft.customByRecipe, [design.key]: sets },
    });
  }
  function resetRecipe() {
    const customByRecipe = { ...draft.customByRecipe };
    delete customByRecipe[design.key];
    const inputs = { ...draft.inputs };
    delete inputs[design.key];
    const customRules = { ...draft.customRules };
    delete customRules[design.key];
    change({ ...draft, inputs, customSets: null, customByRecipe, customRules });
  }
  function pin() {
    change({
      ...draft,
      pinned: {
        name: text.name + (draft.customSets ? " · custom" : ""),
        recipeKey: design.key,
        scope,
        unit,
        sets: structuredClone(workspace.sets),
        rules: [...rules],
        warnings: [...workspace.warnings],
      },
    });
    setNote(
      "Snapshot saved. Change the session or choose another recipe to compare.",
    );
  }
  async function copy() {
    const content = gymCardText({
      name: text.name + (draft.customSets ? " · custom" : ""),
      liftName: LIFTS[a.probe.lift].name,
      e1rm: a.probe.e1rm,
      unit,
      sets: workspace.sets,
      rules,
      rulesLabel,
      warnings: [
        ...workspace.warnings,
        ...evaluation.warnings.filter((w) =>
          /exceed|ceiling|invalid|needs review/.test(w),
        ),
      ],
      summary: totalsText(workspace),
    });
    setGym(content);
    try {
      await navigator.clipboard.writeText(content);
      setNote("Gym card copied.");
    } catch {
      setNote("Select the gym card text below to copy it.");
    }
  }
  return (
    <section
      className="stack-lg designer recipe-workspace"
      aria-labelledby="design-h"
    >
      <div className="workspace-heading">
        <div>
          <h2 id="design-h">Design a session</h2>
          <p className="muted">One workout. Several training qualities.</p>
        </div>
        <span className="small muted">
          {saved
            ? "Draft saved in this browser"
            : "Storage unavailable · draft kept on this page"}
        </span>
      </div>
      <div className="recipe-selector panel">
        <div>
          <span className="field-label">Your protocol</span>
          <h3>
            {text.name}
            {draft.customSets ? " · custom" : ""}
          </h3>
          <p className="small muted">{text.summary}</p>
          <p className="small muted">
            {draft.customSets
              ? "Custom bar weights kept as entered"
              : `Recipe weights use ${plateStep(unit)} ${unit} increments`}
          </p>
        </div>
        <Shape sets={workspace.sets} lstar={ctx.lstar} />
        <button
          className="btn btn-small"
          type="button"
          aria-expanded={library}
          aria-controls="protocol-library"
          onClick={() => setLibrary(!library)}
        >
          {library
            ? "Close library"
            : `Choose from ${DESIGNS.length} protocols`}
        </button>
      </div>
      {library && (
        <section
          className="protocol-library stack"
          id="protocol-library"
          aria-labelledby="protocol-library-h"
        >
          <div className="workspace-heading">
            <h3 id="protocol-library-h">Protocol library</h3>
            <span className="small muted">
              {filtered.length} of {DESIGNS.length} recipes
            </span>
          </div>
          <div className="library-controls">
            <label>
              Find a protocol
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or arrangement"
              />
            </label>
            <label>
              Structure
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="All structures">All structures</option>
                {Object.entries(STRUCTURE_TAGS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted">
            Names describe recipes, not exclusive outcomes. A protocol can
            contribute to both strength and hypertrophy.
          </p>
          <ul className="design-grid" aria-label="All protocol recipes">
            {filtered.map((d) => (
              <li key={d.key}>
                <button
                  type="button"
                  className="design-card"
                  aria-pressed={d.key === design.key}
                  onClick={() => pick(d.key)}
                >
                  <span className="design-name">{DESIGN_TEXT[d.key].name}</span>
                  <span className="design-summary">
                    {DESIGN_TEXT[d.key].summary}
                  </span>
                  {previews[d.key] ? (
                    <Shape sets={previews[d.key]!.sets} lstar={ctx.lstar} />
                  ) : (
                    <span className="design-off">
                      Unavailable for this lift or profile
                    </span>
                  )}
                  {DESIGN_TEXT[d.key].draft && (
                    <span className="small muted">Experimental recipe</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p className="muted">
              No protocols match. Try another name or structure.
            </p>
          )}
        </section>
      )}
      <div className="session-work-grid">
        <article
          ref={cardRef}
          className="panel stack session-card"
          aria-labelledby="workout-h"
        >
          <div className="workspace-heading">
            <h3 id="workout-h">Your workout</h3>
            <div className="btn-row">
              <button
                className="btn btn-small btn-quiet"
                type="button"
                disabled={!history.length}
                onClick={() => {
                  const previous = history[history.length - 1];
                  if (previous) {
                    setDraft(previous);
                    setHistory(history.slice(0, -1));
                    setGym(null);
                    setNote("Last change undone.");
                  }
                }}
              >
                Undo
              </button>
              <button
                className="btn btn-small btn-quiet"
                type="button"
                onClick={resetRecipe}
              >
                Reset recipe
              </button>
            </div>
          </div>
          <details className="session-details recipe-about">
            <summary>About this protocol</summary>
            <p>{text.explanation}</p>
            {text.cue && <p className="cue">{text.cue}</p>}
          </details>
          {why ? (
            <p className="flag">{why}</p>
          ) : (
            <>
              {needsSpotter && (
                <label className="flag check">
                  <input
                    type="checkbox"
                    checked={spotter}
                    onChange={(e) => {
                      setSpotter(e.target.checked);
                      try {
                        localStorage.setItem(
                          SPOTTER_KEY,
                          e.target.checked ? "1" : "0",
                        );
                      } catch {
                        /* In-memory only. */
                      }
                    }}
                  />
                  I have a spotter or rack safeties for barbell rest-pause work.
                </label>
              )}
              {ctx.fresh(75) == null && (
                <p className="small muted">
                  No measured speed profile: velocity guides remain blank.
                </p>
              )}
              <details
                className="session-details recipe-settings"
                open={!draft.customSets}
              >
                <summary>Recipe settings</summary>
                {draft.customSets && (
                  <p className="small muted">
                    Changing a recipe setting rebuilds its sets. Undo restores
                    your custom arrangement.
                  </p>
                )}
                <RecipeKnobs
                  design={design}
                  workspace={base}
                  onChange={setValue}
                />
              </details>
              <div
                className="workout-prescription"
                aria-label="Prescribed sets"
              >
                <div className="workout-table-head" aria-hidden="true">
                  <span>Set</span>
                  <span>Load</span>
                  <span>Reps / rule</span>
                  <span>Then</span>
                </div>
                {prescriptionRows(workspace.sets).map((row) => {
                  const s = row.set,
                    efforts = evaluation.perSet
                      .filter((p) => p.index >= s.n && p.index <= row.last)
                      .map((p) => p.projectedRpe);
                  const effort = projectedEffortText(efforts);
                  return (
                    <div className="workout-row" key={s.id}>
                      <div>
                        <strong>
                          {s.n === row.last ? s.n : `${s.n}–${row.last}`}
                        </strong>
                        <small>{s.group}</small>
                      </div>
                      <div>
                        <span className="mobile-field">Load</span>
                        <strong>{wt(s.loadLb, unit)}</strong>
                        <small>{loadText(s.pct)}</small>
                      </div>
                      <div>
                        <span className="mobile-field">Reps / rule</span>
                        <strong>{repsLabel(s.reps)}</strong>
                        <small>
                          {s.ceiling
                            ? `RPE ceiling ${s.rpe}`
                            : s.reps.kind === "toStop"
                              ? `Stop at RPE ${s.rpe}`
                              : s.reps.kind === "fixed"
                                ? "Fixed work"
                                : `RPE guide ${s.rpe}`}
                          {s.tempo ? ` · ${s.tempo} tempo` : ""}
                        </small>
                        <small>
                          {s.stopV == null
                            ? "Velocity unavailable"
                            : `${s.single ? "Check" : "Velocity guide"} ${ms(s.stopV)}`}
                        </small>
                      </div>
                      <div>
                        <span className="mobile-field">Then</span>
                        {thenLabel(s, s.n === workspace.sets.length)}
                        {row.finishes && row.last > s.n && (
                          <small>Finish after set {row.last}</small>
                        )}
                        <small>
                          {effort != null
                            ? `Predicted RPE ${effort}`
                            : "Effort depends on completed work"}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="totals">{totalsText(workspace)}</p>
              <p className="small muted">
                Time uses an estimated rep duration and excludes warm-up.
                Forecasts describe the requested work; they do not change it.
              </p>
              {workspace.warnings.length > 0 && (
                <ul className="session-warnings small">
                  {workspace.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="btn-row">
                <button
                  className="btn btn-small btn-quiet"
                  type="button"
                  onClick={() => setEditing(!editing)}
                  aria-expanded={editing}
                  aria-controls="session-set-editor"
                >
                  {editing ? "Close set editor" : "Edit sets & recovery"}
                </button>
                <button
                  className="btn btn-small btn-quiet"
                  type="button"
                  onClick={pin}
                >
                  Keep for comparison
                </button>
                <button
                  className="btn btn-small"
                  type="button"
                  disabled={needsSpotter}
                  onClick={copy}
                >
                  Copy for the gym
                </button>
              </div>
              {editing && (
                <section
                  id="session-set-editor"
                  className="stack-sm"
                  aria-label="Set and recovery editor"
                >
                  <p className="small muted">
                    Each cluster stays together when moved or duplicated.
                    Changes are reversible with Undo.
                  </p>
                  {workspace.sets.map((s, i) => (
                    <SessionSetEditor
                      key={`${s.id}-${unit}-${JSON.stringify(s)}`}
                      set={s}
                      unit={unit}
                      first={i === 0}
                      last={i === workspace.sets.length - 1}
                      only={workspace.sets.length === 1}
                      onApply={(patch) =>
                        custom(editWorkspaceSet(workspace.sets, s.id, patch))
                      }
                      onDuplicate={() =>
                        custom(
                          duplicateWorkspaceSet(
                            workspace.sets,
                            s.id,
                            `custom-${crypto.randomUUID()}`,
                          ),
                        )
                      }
                      onMove={(delta) =>
                        custom(moveWorkspaceSet(workspace.sets, s.id, delta))
                      }
                      onRemove={() =>
                        custom(removeWorkspaceSet(workspace.sets, s.id))
                      }
                    />
                  ))}
                </section>
              )}
              {editing && (
                <RuleEditor
                  key={`${design.key}-${rules.join("\n")}`}
                  rules={rules}
                  onApply={(next) => {
                    change({
                      ...draft,
                      customRules: { ...draft.customRules, [design.key]: next },
                    });
                    setNote("Execution rules updated.");
                  }}
                />
              )}
              {rules.length > 0 && (
                <details className="session-details" open>
                  <summary>{rulesLabel}</summary>
                  <ul className="rules">
                    {rules.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </article>
        {!why && <SessionProfile evaluation={evaluation} />}
      </div>
      {note && (
        <p className="small muted" role="status">
          {note}
        </p>
      )}
      {gym && (
        <details className="panel session-details gym-card" open>
          <summary>Gym card</summary>
          <textarea
            readOnly
            aria-label="Gym card text"
            value={gym}
            rows={Math.min(18, workspace.sets.length + 6)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </details>
      )}
      {draft.pinned && pinnedEvaluation && (
        <section
          className="panel stack session-comparison"
          aria-labelledby="comparison-h"
        >
          <div className="workspace-heading">
            <h3 id="comparison-h">Compare sessions</h3>
            <button
              type="button"
              className="btn btn-small btn-quiet"
              onClick={() => change({ ...draft, pinned: null })}
            >
              Clear comparison
            </button>
          </div>
          <p className="small muted">
            Same profile and model. Compare each quality in its own units; check
            workload and recovery differences.
          </p>
          <div className="comparison-cards">
            {[
              {
                name: draft.pinned.name,
                sets: draft.pinned.sets,
                evaluation: pinnedEvaluation,
                label: "Saved snapshot",
                warnings: draft.pinned.warnings,
                rules: draft.pinned.rules,
              },
              {
                name: text.name + (draft.customSets ? " · custom" : ""),
                sets: workspace.sets,
                evaluation,
                label: "Current workout",
                warnings: workspace.warnings,
                rules,
              },
            ].map((item, i) => (
              <div className="comparison-card" key={i}>
                <span className="field-label">{item.label}</span>
                <h3>{item.name}</h3>
                <Shape sets={item.sets} lstar={ctx.lstar} />
                <dl className="session-metrics">
                  <dt>Strength credit</dt>
                  <dd>{fmt(item.evaluation.benefits?.strength, 2)}</dd>
                  <dt>Hypertrophy credit</dt>
                  <dd>{fmt(item.evaluation.benefits?.hypertrophy, 2)}</dd>
                  <dt>Central / peripheral cost</dt>
                  <dd>
                    {fmt(item.evaluation.costs?.central, 1)} /{" "}
                    {fmt(item.evaluation.costs?.peripheral, 1)}
                  </dd>
                </dl>
                <details className="session-details">
                  <summary>Load, reps and recovery</summary>
                  <ol>
                    {item.sets.map((s) => (
                      <li key={s.id}>
                        {wt(s.loadLb, unit)} × {repsLabel(s.reps)} ·{" "}
                        {thenLabel(s, s.n === item.sets.length)}
                      </li>
                    ))}
                  </ol>
                </details>
                {(item.rules.length > 0 ||
                  item.warnings.length > 0 ||
                  item.evaluation.warnings.length > 0) && (
                  <details className="session-details">
                    <summary>Execution rules and checks</summary>
                    <ul>
                      {[
                        ...item.rules,
                        ...item.warnings,
                        ...item.evaluation.warnings,
                      ].map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {item.evaluation.status !== "estimated" && (
                  <p className="small muted">
                    Complete estimate unavailable. Review the work and its model
                    checks.
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-small btn-quiet restore-comparison"
            onClick={() => {
              const p = draft.pinned!;
              change({
                ...draft,
                recipeKey: p.recipeKey,
                customSets: structuredClone(p.sets),
                customByRecipe: {
                  ...draft.customByRecipe,
                  [p.recipeKey]: structuredClone(p.sets),
                },
                customRules: {
                  ...draft.customRules,
                  [p.recipeKey]: [...p.rules],
                },
              });
              setNote("Saved workout restored.");
            }}
          >
            Restore saved workout
          </button>
        </section>
      )}
      <p className="session-lstar-context small muted">
        {ctx.lstar == null
          ? "This profile has no L* estimate."
          : `Dashed red line: this profile’s L* at ${fmt(ctx.lstar, 1)}%.`}{" "}
        L* provides load context, not an exclusive strength or hypertrophy
        category.
      </p>
    </section>
  );
}
