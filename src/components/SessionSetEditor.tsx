import { useId, useState, type FormEvent } from "react";
import type { Reps } from "../engine/sessions/designs";
import {
  validateWorkspaceSets,
  WorkspaceValidationError,
  type WorkspaceSet,
} from "../engine/sessions/workspace";
import { fromUnit, toUnit, type Unit } from "../format";

interface Props {
  set: WorkspaceSet;
  unit: Unit;
  onApply: (patch: Partial<WorkspaceSet>) => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
  only: boolean;
}

const number = (text: string) =>
  text.trim() === "" ? Number.NaN : Number(text);
const loadText = (lb: number, unit: Unit) =>
  String(Number(toUnit(lb, unit).toFixed(4)));

function repSummary(reps: Reps): string {
  if (reps.kind === "cluster") return `${reps.parts.join(" + ")} reps`;
  if (reps.kind === "timed") return `${reps.minutes} min`;
  if (reps.kind === "toStop") return `to the stop, about ${reps.about}`;
  return `${reps.kind === "upTo" ? "up to " : ""}${reps.n} reps`;
}

/** A local draft: nothing changes in the session until Apply succeeds. The
 * parent keys this editor by the saved set and unit to refresh after an edit. */
export default function SessionSetEditor({
  set,
  unit,
  onApply,
  onDuplicate,
  onMove,
  onRemove,
  first,
  last,
  only,
}: Props) {
  const id = useId();
  const [load, setLoad] = useState(() => loadText(set.loadLb, unit));
  const [kind, setKind] = useState<Reps["kind"]>(set.reps.kind);
  const [reps, setReps] = useState(() =>
    String(
      set.reps.kind === "fixed" || set.reps.kind === "upTo"
        ? set.reps.n
        : set.reps.kind === "toStop"
          ? set.reps.about
          : 5,
    ),
  );
  const [parts, setParts] = useState(() =>
    set.reps.kind === "cluster" ? set.reps.parts.join(" + ") : "2 + 2 + 2",
  );
  const [intraRest, setIntraRest] = useState(() =>
    String(set.reps.kind === "cluster" ? set.reps.intraRest : 20),
  );
  const [minutes, setMinutes] = useState(() =>
    String(set.reps.kind === "timed" ? set.reps.minutes : 10),
  );
  const [rpe, setRpe] = useState(() => String(set.rpe));
  const [ceiling, setCeiling] = useState(!!set.ceiling);
  const [clock, setClock] = useState(!!set.clock);
  const [recovery, setRecovery] = useState(() => String(set.recoverySeconds));
  const [error, setError] = useState<string | null>(null);

  function action(run: () => void) {
    try {
      setError(null);
      run();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That change could not be applied. Check the values and try again.",
      );
    }
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    action(() => {
      let instruction: Reps;
      if (kind === "cluster") {
        const miniSets = parts.split(/\s*[+,]\s*/).map(number);
        instruction = { kind, parts: miniSets, intraRest: number(intraRest) };
      } else if (kind === "timed") {
        instruction = { kind, minutes: number(minutes) };
      } else if (kind === "toStop") {
        instruction = { kind, about: number(reps) };
      } else {
        instruction = { kind, n: number(reps) };
      }
      const patch: Partial<WorkspaceSet> = {
        // Merely opening an editor in kg must not round the physical bar.
        loadLb:
          load === loadText(set.loadLb, unit)
            ? set.loadLb
            : fromUnit(number(load), unit),
        reps: instruction,
        rpe: number(rpe),
        ceiling,
        clock,
        recoverySeconds: number(recovery),
      };
      const issues = validateWorkspaceSets([{ ...set, ...patch }]);
      if (issues.length)
        throw new WorkspaceValidationError(
          issues.map((issue) => issue.replace(/^Set 1\b/, `Set ${set.n}`)),
        );
      onApply(patch);
    });
  }

  return (
    <details className="session-edit-block">
      <summary>
        <span>
          Set {set.n} · {set.group}
        </span>
        <span>
          {Number(toUnit(set.loadLb, unit).toFixed(2))} {unit} ·{" "}
          {repSummary(set.reps)}
        </span>
      </summary>
      <form className="stack" onSubmit={apply}>
        <div className="session-edit-grid">
          <label htmlFor={`${id}-load`}>
            Bar weight ({unit})
            <input
              id={`${id}-load`}
              inputMode="decimal"
              value={load}
              onChange={(event) => setLoad(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-kind`}>
            Rep rule
            <select
              id={`${id}-kind`}
              value={kind}
              onChange={(event) => setKind(event.target.value as Reps["kind"])}
            >
              <option value="fixed">Fixed reps</option>
              <option value="upTo">Up to a rep ceiling</option>
              <option value="toStop">To the effort stop</option>
              <option value="cluster">Cluster mini-sets</option>
              <option value="timed">Timed work</option>
            </select>
          </label>
          {kind === "cluster" ? (
            <>
              <label htmlFor={`${id}-parts`}>
                Mini-set reps, separated by +
                <input
                  id={`${id}-parts`}
                  value={parts}
                  onChange={(event) => setParts(event.target.value)}
                  placeholder="2 + 2 + 2"
                />
              </label>
              <label htmlFor={`${id}-intra`}>
                Rest inside cluster (seconds)
                <input
                  id={`${id}-intra`}
                  inputMode="decimal"
                  value={intraRest}
                  onChange={(event) => setIntraRest(event.target.value)}
                />
              </label>
            </>
          ) : kind === "timed" ? (
            <label htmlFor={`${id}-minutes`}>
              Work duration (minutes)
              <input
                id={`${id}-minutes`}
                inputMode="decimal"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </label>
          ) : (
            <label htmlFor={`${id}-reps`}>
              {kind === "upTo"
                ? "Rep ceiling"
                : kind === "toStop"
                  ? "Estimated reps"
                  : "Reps"}
              <input
                id={`${id}-reps`}
                inputMode="numeric"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
              />
            </label>
          )}
          <label htmlFor={`${id}-intent`}>
            Effort instruction
            <select
              id={`${id}-intent`}
              value={ceiling ? "ceiling" : "guide"}
              onChange={(event) => setCeiling(event.target.value === "ceiling")}
            >
              <option value="guide">RPE guide</option>
              <option value="ceiling">RPE ceiling</option>
            </select>
          </label>
          <label htmlFor={`${id}-rpe`}>
            {ceiling ? "No harder than RPE" : "RPE guide"}
            <input
              id={`${id}-rpe`}
              inputMode="decimal"
              value={rpe}
              onChange={(event) => setRpe(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-timing`}>
            Recovery timing
            <select
              id={`${id}-timing`}
              value={clock ? "clock" : "rest"}
              onChange={(event) => setClock(event.target.value === "clock")}
            >
              <option value="rest">Rest after the set</option>
              <option value="clock">Start-to-start interval</option>
            </select>
          </label>
          <label htmlFor={`${id}-recovery`}>
            {clock ? "Start every (seconds)" : "Rest (seconds)"}
            <input
              id={`${id}-recovery`}
              inputMode="decimal"
              value={recovery}
              onChange={(event) => setRecovery(event.target.value)}
            />
          </label>
        </div>
        {kind === "toStop" ? (
          <p className="small muted">
            The stop rule decides the actual rep count. Estimated reps are used
            for planning time.
          </p>
        ) : null}
        {last ? (
          <p className="small muted">
            This recovery is kept if another set follows later. No rest is
            counted after the final set.
          </p>
        ) : null}
        {set.tempo ? (
          <p className="small muted">Tempo stays {set.tempo}.</p>
        ) : null}
        {error ? (
          <p className="note note-warn" role="alert">
            {error}
          </p>
        ) : null}
        <div className="btn-row">
          <button type="submit" className="btn btn-small">
            Apply changes
          </button>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            onClick={() => action(onDuplicate)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            disabled={first}
            onClick={() => action(() => onMove(-1))}
          >
            Move up
          </button>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            disabled={last}
            onClick={() => action(() => onMove(1))}
          >
            Move down
          </button>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            disabled={only}
            onClick={() => action(onRemove)}
          >
            Remove
          </button>
        </div>
      </form>
    </details>
  );
}
