import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Reading } from "../components/Readings";
import type { Phase, Rep } from "../engine/analyze";
import { LIFT_KEYS, LIFTS, VL_ZONES, type LiftKey } from "../engine/constants";
import { fromCsv, toCsv } from "../engine/csv";
import { EXAMPLE_PROBE } from "../engine/example";
import { intentFloor, readRep } from "../engine/metrics";
import WeightInput from "../components/WeightInput";
import { fmt, suggestBarLb, todayIso, usePageTitle, wt, wtValue, type Unit } from "../format";
import { byDateDesc, probeWhen, type SavedProbe } from "../probes";
import { isUsable, useStore } from "../store";

const TARGETS = [60, 70, 80, 90];

interface Draft {
  round: number;
  phase: Phase;
  target: number;
  barLb: number | null;
  set: number;
  forceN: string;
  meanV: string;
  peakV: string;
}

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export default function Probe() {
  usePageTitle("Run the probe");
  const { currentId } = useStore();
  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>Run the probe</h1>
        <p className="lede">
          Log each rep as you go. Everything saves in this browser, so you can close the page between sets.
        </p>
      </div>
      <ProbeHistory />
      {/* Keyed so switching probes resets the half-typed rep. */}
      <ProbeEditor key={currentId} />
    </div>
  );
}

const probeOption = (s: SavedProbe) =>
  `${LIFTS[s.probe.lift].name}, ${s.probe.reps.length ? probeWhen(s) : `started ${probeWhen(s)}`} (${
    s.probe.reps.length ? `${s.probe.reps.length} reps` : "no reps yet"
  })`;

function ProbeHistory() {
  const { probes, currentId, mine, selectProbe, newProbe, deleteProbe } = useStore();
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (probes.length < 2 && !mine.reps.length) return null;
  const sorted = [...probes].sort(byDateDesc);
  const current = probes.find((s) => s.id === currentId)!;
  const sameLift = probes.filter((s) => s.probe.lift === mine.lift && isUsable(s.probe)).length;

  return (
    <section className="panel stack" aria-labelledby="probes-h">
      <div className="btn-row" style={{ justifyContent: "space-between" }}>
        <h2 id="probes-h">Your probes</h2>
        <button
          type="button"
          className="btn btn-small"
          disabled={!mine.reps.length}
          onClick={() => {
            newProbe();
            setConfirming(false);
            setNote(
              `Started a new ${LIFTS[mine.lift].name.toLowerCase()} probe; your earlier one is saved. Check the e1RM below and update it if your max has moved.`,
            );
          }}
        >
          New probe
        </button>
      </div>
      {probes.length > 1 && (
        <div className="field" style={{ maxWidth: 520 }}>
          <label htmlFor="p-pick">Logging into</label>
          <select
            id="p-pick"
            value={currentId}
            onChange={(e) => {
              selectProbe(e.target.value);
              setConfirming(false);
              setNote(null);
            }}
          >
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {probeOption(s)}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="field-hint">
        Start a new probe after each training block. Earlier ones stay saved here
        {sameLift >= 2 ? (
          <>
            , and the report's <Link to="/report/compare">Compare page</Link> shows what changed between them.
          </>
        ) : (
          ", and once you have two of the same lift the report shows what changed between them."
        )}
      </p>
      {note && (
        <p className="small" role="status">
          {note}
        </p>
      )}
      {probes.length > 1 &&
        (confirming ? (
          <div className="flag flag-warn btn-row" role="alertdialog" aria-label="Confirm">
            <span style={{ flex: "1 1 260px" }}>
              Delete the {probeOption(current)} probe? This can't be undone.
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                deleteProbe(currentId);
                setConfirming(false);
                setNote("Deleted that probe.");
              }}
            >
              Delete probe
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>
              Delete this probe
            </button>
          </div>
        ))}
    </section>
  );
}

function ProbeEditor() {
  const { mine, setMine, setSource, viewProbe, currentId, unit } = useStore();
  const navigate = useNavigate();
  const forceRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Destructive actions confirm inline: some embeds refuse window.confirm().
  const [pending, setPending] = useState<
    | { kind: "clear" }
    | { kind: "example" }
    | { kind: "import"; reps: Rep[]; skipped: number; name: string }
    | null
  >(null);

  const lastRound = mine.reps.length ? Math.max(...mine.reps.map((r) => r.round)) : 1;
  const suggestLb = (target: number, e1rm = mine.e1rm) => (e1rm > 0 ? suggestBarLb(e1rm, target, unit) : null);
  const [draft, setDraft] = useState<Draft>({
    round: lastRound,
    phase: "ladder",
    target: 60,
    barLb: suggestLb(60),
    set: 1,
    forceN: "",
    meanV: "",
    peakV: "",
  });

  const sameSet = (r: Rep) =>
    r.round === draft.round && r.phase === draft.phase && r.target === draft.target && r.set === draft.set;
  const setReps = mine.reps.filter(sameSet);
  const nextRep = setReps.length ? Math.max(...setReps.map((r) => r.rep)) + 1 : 1;

  const bar = draft.barLb;
  const force = num(draft.forceN);
  const live = bar && force ? readRep(bar, force, mine.e1rm || null) : null;
  const floor = live?.loadPct != null ? intentFloor(live.loadPct) : null;
  const bestMean = Math.max(0, ...setReps.map((r) => r.meanV ?? 0));
  const mv = num(draft.meanV);
  const vl = draft.phase === "amrap" && mv != null && bestMean > 0 ? Math.max(0, (1 - mv / bestMean) * 100) : null;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const chooseTarget = (t: number) => update({ target: t, barLb: suggestLb(t), set: 1 });

  const changeLift = (lift: LiftKey) =>
    setMine((p) => ({ ...p, lift, mvt: LIFTS[lift].mvt, recruitLine: LIFTS[lift].recruitLine }));

  const changeE1rm = (lb: number | null) => {
    const e = lb ?? 0;
    setMine((p) => ({ ...p, e1rm: e }));
    if (e > 0) update({ barLb: suggestLb(draft.target, e) });
  };

  function logRep() {
    if (!bar || !force) {
      setMessage("Enter the bar weight and peak force to log the rep.");
      return;
    }
    const rep: Rep = {
      round: draft.round,
      date: todayIso(),
      phase: draft.phase,
      target: draft.target,
      lb: bar,
      set: draft.set,
      rep: nextRep,
      forceN: force,
      meanV: num(draft.meanV),
      peakV: num(draft.peakV),
    };
    setMine((p) => ({ ...p, reps: [...p.reps, rep] }));
    update({ forceN: "", meanV: "", peakV: "" });
    setMessage(`Logged rep ${rep.rep} at ${wt(rep.lb, unit)}.`);
    forceRef.current?.focus();
  }

  const deleteRep = (i: number) => setMine((p) => ({ ...p, reps: p.reps.filter((_, j) => j !== i) }));

  function exportCsv() {
    const blob = new Blob([toCsv(mine.reps)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `probe-${mine.lift}-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const res = fromCsv(await file.text());
    if (res.error) {
      setMessage(res.error);
      return;
    }
    if (mine.reps.length) {
      setPending({ kind: "import", reps: res.reps, skipped: res.skipped, name: file.name });
      return;
    }
    applyImport(res.reps, res.skipped);
  }

  function applyImport(reps: Rep[], skipped: number) {
    setMine((p) => ({ ...p, reps }));
    setPending(null);
    setMessage(`Imported ${reps.length} reps${skipped ? `; skipped ${skipped} rows that weren't ladder or AMRAP reps` : ""}.`);
  }

  function loadExample() {
    setMine({ ...EXAMPLE_PROBE });
    setPending(null);
    setMessage("Loaded the example probe. Edit or delete reps freely; it's your copy.");
  }

  function clearAll() {
    setMine((p) => ({ ...p, reps: [] }));
    setPending(null);
    setMessage("Cleared your probe.");
  }

  async function copyCsv() {
    const text = toCsv(mine.reps);
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`Copied ${mine.reps.length} reps as CSV. Paste them into a spreadsheet or a text file.`);
    } catch {
      setMessage(__PREVIEW__ ? "Couldn't reach the clipboard here." : "Couldn't reach the clipboard here. Use Export CSV instead.");
    }
  }

  const sorted = useMemo(
    () =>
      mine.reps
        .map((r, i) => ({ r, i }))
        .sort(
          (a, b) =>
            a.r.round - b.r.round ||
            (a.r.phase === b.r.phase ? 0 : a.r.phase === "ladder" ? -1 : 1) ||
            (a.r.target ?? a.r.lb) - (b.r.target ?? b.r.lb) ||
            a.r.set - b.r.set ||
            a.r.rep - b.r.rep,
        ),
    [mine.reps],
  );
  const rounds = [...new Set(sorted.map((x) => x.r.round))];
  const usable = isUsable(mine);

  return (
    <>
      <section className="panel stack" aria-labelledby="setup-h">
        <h2 id="setup-h">Set up</h2>
        <div className="fields">
          <div className="field">
            <label htmlFor="p-lift">Lift</label>
            <select id="p-lift" value={mine.lift} onChange={(e) => changeLift(e.target.value as LiftKey)}>
              {LIFT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LIFTS[k].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-e1rm">e1RM ({unit})</label>
            <WeightInput id="p-e1rm" valueLb={mine.e1rm || null} unit={unit} onChangeLb={changeE1rm} placeholder={unit === "kg" ? "e.g. 140" : "e.g. 315"} />
          </div>
          <div className="field">
            <label htmlFor="p-mvt">MVT (m/s)</label>
            <input id="p-mvt" inputMode="decimal" value={mine.mvt} onChange={(e) => setMine((p) => ({ ...p, mvt: num(e.target.value) ?? p.mvt }))} />
          </div>
          <div className="field">
            <label htmlFor="p-line">Recruitment line (% EI)</label>
            <input id="p-line" inputMode="decimal" value={mine.recruitLine} onChange={(e) => setMine((p) => ({ ...p, recruitLine: num(e.target.value) ?? p.recruitLine }))} />
          </div>
        </div>
        <p className="field-hint">
          MVT is the mean velocity of a true grinding single; about 0.15 m/s for bench and 0.30 for squat if you don't
          know yours. The line defaults to {LIFTS[mine.lift].recruitLine}% for the {LIFTS[mine.lift].name.toLowerCase()}.
        </p>
      </section>

      <details className="protocol" open={mine.reps.length === 0}>
        <summary>How to run the probe</summary>
        <div className="protocol-body stack">
          <p>
            One lift, about forty minutes, rested. The ladder only counts if it's fresh, so don't run it after a hard
            session. Each rep gives three numbers off the sensor: peak force, mean velocity and peak velocity.
          </p>
          <ol>
            <li>Warm up fully to 60%.</li>
            <li>
              <strong>Ladder at 60%.</strong> Two or three singles, every one as fast as you can move it, with the same
              technique and full range. About a minute between singles. Log each.
            </li>
            <li>
              <strong>Ladder at 70, 80 and 90%.</strong> The same, with two or three minutes between loads so each
              stays fresh.
            </li>
            <li>
              <strong>All-out set at 60%.</strong> Rest three to five minutes after the 90% singles, switch the phase to
              AMRAP, and do one set: fast intent every rep, until the bar grinds to a near stop or form slips. Log
              every rep; 15 to 25 is normal.
            </li>
          </ol>
          <p className="muted">
            Within a week or two, repeat it on another day as round 2: that measures your day-to-day noise and puts
            error bars on the profile. After a training block, start a new probe instead and compare the two. One
            misgrooved rep won't ruin either: log it and keep going.
          </p>
        </div>
      </details>

      <div className="probe-grid">
        <section className="panel stack" aria-labelledby="log-h">
          <h2 id="log-h">Log a rep</h2>
          <div className="stack">
            <div className="field">
              <span className="field-label" id="phase-l">Phase</span>
              <div className="segmented" role="group" aria-labelledby="phase-l">
                {(["ladder", "amrap"] as Phase[]).map((ph) => (
                  <button key={ph} type="button" aria-pressed={draft.phase === ph} onClick={() => update({ phase: ph, set: 1 })}>
                    {ph === "ladder" ? "Ladder" : "AMRAP"}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label" id="target-l">Load, % of e1RM</span>
              <div className="segmented" role="group" aria-labelledby="target-l">
                {TARGETS.map((t) => (
                  <button key={t} type="button" aria-pressed={draft.target === t} onClick={() => chooseTarget(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="fields">
              <div className="field">
                <label htmlFor="d-lb">Bar weight ({unit})</label>
                <WeightInput id="d-lb" valueLb={draft.barLb} unit={unit} onChangeLb={(barLb) => update({ barLb })} />
              </div>
              <div className="field">
                <label htmlFor="d-round">Round</label>
                <input id="d-round" inputMode="numeric" value={draft.round} onChange={(e) => update({ round: num(e.target.value) ?? 1 })} />
              </div>
              <div className="field">
                <label htmlFor="d-set">Set</label>
                <input id="d-set" inputMode="numeric" value={draft.set} onChange={(e) => update({ set: num(e.target.value) ?? 1 })} />
              </div>
            </div>
            <div className="fields">
              <div className="field">
                <label htmlFor="d-force">Peak force (N)</label>
                <input id="d-force" ref={forceRef} inputMode="decimal" value={draft.forceN} onChange={(e) => update({ forceN: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="d-mv">Mean velocity (m/s)</label>
                <input id="d-mv" inputMode="decimal" value={draft.meanV} onChange={(e) => update({ meanV: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="d-pv">Peak velocity (m/s)</label>
                <input id="d-pv" inputMode="decimal" value={draft.peakV} onChange={(e) => update({ peakV: e.target.value })} />
              </div>
            </div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={logRep}>
                Log rep {nextRep}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => update({ set: draft.set + 1 })}>
                Start set {draft.set + 1}
              </button>
            </div>
            <p className="small muted" role="status" aria-live="polite">
              {message ?? `Round ${draft.round}, ${draft.phase === "ladder" ? "ladder" : "AMRAP"} at ${draft.target}%, set ${draft.set}.`}
            </p>
          </div>
        </section>

        <section className="stack" aria-label="This rep">
          <h2>This rep</h2>
          <div className="live">
            <Reading label="Multiple" value={live ? `${fmt(live.multiple, 2)}×` : "–"} />
            <Reading label="Effective Intensity" value={live?.ei != null ? `${fmt(live.ei, 1)}%` : "–"} />
            {draft.phase === "ladder" ? (
              <Reading
                label="Intent check"
                value={
                  live && floor != null ? (
                    <span className={live.multiple >= floor ? "tone-good" : "tone-caution"}>
                      {live.multiple >= floor ? "Clear" : "Low"}
                    </span>
                  ) : (
                    "–"
                  )
                }
                note={floor != null ? `Draft floor ${fmt(floor, 2)}×` : undefined}
              />
            ) : (
              <Reading
                label="Velocity loss"
                value={
                  vl != null ? (
                    <span className={vl > VL_ZONES.caution ? "tone-caution" : "tone-good"}>{fmt(vl, 0)}%</span>
                  ) : (
                    "–"
                  )
                }
                note={bestMean > 0 ? `From best ${fmt(bestMean, 2)} m/s` : "From the set's best rep"}
              />
            )}
          </div>
          {live && floor != null && draft.phase === "ladder" && live.multiple < floor && (
            <p className="flag flag-warn">
              A max-intent single at this load usually reaches {fmt(floor, 2)}×. If this one felt soft, repeat it.
            </p>
          )}
          {!mine.e1rm && <p className="flag flag-warn">Enter your e1RM above to see Effective Intensity and suggested bar weights.</p>}
        </section>
      </div>

      <section className="stack" aria-labelledby="reps-h">
        <div className="btn-row" style={{ justifyContent: "space-between" }}>
          <h2 id="reps-h">Logged reps ({mine.reps.length})</h2>
          <div className="btn-row">
            <button type="button" className="btn btn-small btn-quiet" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
            {!__PREVIEW__ && (
              <button type="button" className="btn btn-small btn-quiet" onClick={exportCsv} disabled={!mine.reps.length}>
                Export CSV
              </button>
            )}
            <button type="button" className="btn btn-small btn-quiet" onClick={copyCsv} disabled={!mine.reps.length}>
              Copy CSV
            </button>
            <button type="button" className="link-btn" onClick={() => (mine.reps.length ? setPending({ kind: "example" }) : loadExample())}>
              Load the example
            </button>
            {mine.reps.length > 0 && (
              <button type="button" className="link-btn" onClick={() => setPending({ kind: "clear" })}>
                Clear all
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
        </div>

        {pending && (
          <div className="flag flag-warn btn-row" role="alertdialog" aria-label="Confirm">
            <span style={{ flex: "1 1 260px" }}>
              {pending.kind === "clear" && `Delete all ${mine.reps.length} logged reps? This can't be undone.`}
              {pending.kind === "example" && `Replace your ${mine.reps.length} logged reps with the example probe?`}
              {pending.kind === "import" && `Replace your ${mine.reps.length} logged reps with the ${pending.reps.length} in ${pending.name}?`}
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() =>
                pending.kind === "clear" ? clearAll() : pending.kind === "example" ? loadExample() : applyImport(pending.reps, pending.skipped)
              }
            >
              {pending.kind === "clear" ? "Delete all" : "Replace"}
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setPending(null)}>
              Keep my reps
            </button>
          </div>
        )}

        {mine.reps.length === 0 ? (
          <div className="empty stack">
            <p style={{ margin: "0 auto" }}>
              No reps yet. Log your first ladder single above, import a probe-log CSV, or load the example to see how it
              works.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Load</th>
                  <th>Bar ({unit})</th>
                  <th>Set</th>
                  <th>Rep</th>
                  <th>Force</th>
                  <th>Mean v</th>
                  <th>Peak v</th>
                  <th>Multiple</th>
                  <th>EI</th>
                  <th>
                    <span className="visually-hidden">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((rnd) => (
                  <RoundRows key={rnd} round={rnd} rows={sorted.filter((x) => x.r.round === rnd)} e1rm={mine.e1rm} unit={unit} onDelete={deleteRep} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted">CSV columns: round, date, phase, load_pct, load_lb, set, rep, peak_force_n, mean_vel, peak_vel. The probe-log spreadsheet's own headers import too.</p>
      </section>

      <div className="panel btn-row" style={{ justifyContent: "space-between" }}>
        <p>
          {usable
            ? "You have enough to draw a profile. More loads and a second round make it trustworthy."
            : "The report needs your e1RM and reps at two or more loads."}
        </p>
        {usable ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSource("mine");
              viewProbe(currentId);
              navigate("/report");
            }}
          >
            Open your report
          </button>
        ) : (
          <Link to="/report" className="btn btn-quiet">
            See the example report
          </Link>
        )}
      </div>
    </>
  );
}

function RoundRows({
  round,
  rows,
  e1rm,
  unit,
  onDelete,
}: {
  round: number;
  rows: Array<{ r: Rep; i: number }>;
  e1rm: number;
  unit: Unit;
  onDelete: (i: number) => void;
}) {
  return (
    <>
      <tr className="row-group">
        <td colSpan={11}>Round {round}</td>
      </tr>
      {rows.map(({ r, i }) => {
        const m = readRep(r.lb, r.forceN, e1rm || null);
        return (
          <tr key={i}>
            <td>{r.phase === "ladder" ? "Ladder" : "AMRAP"}</td>
            <td>{r.target != null ? `${r.target}%` : "–"}</td>
            <td>{wtValue(r.lb, unit)}</td>
            <td>{r.set}</td>
            <td>{r.rep}</td>
            <td>{r.forceN}</td>
            <td>{fmt(r.meanV, 2)}</td>
            <td>{fmt(r.peakV, 2)}</td>
            <td>{m ? `${fmt(m.multiple, 2)}×` : "–"}</td>
            <td>{m?.ei != null ? `${fmt(m.ei, 1)}%` : "–"}</td>
            <td>
              <button type="button" className="link-btn" onClick={() => onDelete(i)} aria-label={`Delete round ${r.round} ${r.phase} set ${r.set} rep ${r.rep}`}>
                Delete
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
