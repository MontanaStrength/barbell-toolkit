import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Reading } from "../components/Readings";
import type { Phase, Rep } from "../engine/analyze";
import { LIFT_KEYS, LIFTS, VL_ZONES, type LiftKey } from "../engine/constants";
import { fromCsv, toCsv } from "../engine/csv";
import { EXAMPLE_PROBE } from "../engine/example";
import { intentFloor, readRep } from "../engine/metrics";
import { fmt, plateRound, usePageTitle } from "../format";
import { isUsable, useStore } from "../store";

const TARGETS = [60, 70, 80, 90];

interface Draft {
  round: number;
  phase: Phase;
  target: number;
  lb: string;
  set: number;
  forceN: string;
  meanV: string;
  peakV: string;
}

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Probe() {
  usePageTitle("Run the probe");
  const { mine, setMine, setSource } = useStore();
  const navigate = useNavigate();
  const forceRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lastRound = mine.reps.length ? Math.max(...mine.reps.map((r) => r.round)) : 1;
  const suggestLb = (target: number) => (mine.e1rm > 0 ? String(plateRound((mine.e1rm * target) / 100)) : "");
  const [draft, setDraft] = useState<Draft>({
    round: lastRound,
    phase: "ladder",
    target: 60,
    lb: suggestLb(60),
    set: 1,
    forceN: "",
    meanV: "",
    peakV: "",
  });

  const sameSet = (r: Rep) =>
    r.round === draft.round && r.phase === draft.phase && r.target === draft.target && r.set === draft.set;
  const setReps = mine.reps.filter(sameSet);
  const nextRep = setReps.length ? Math.max(...setReps.map((r) => r.rep)) + 1 : 1;

  const bar = num(draft.lb);
  const force = num(draft.forceN);
  const live = bar && force ? readRep(bar, force, mine.e1rm || null) : null;
  const floor = live?.loadPct != null ? intentFloor(live.loadPct) : null;
  const bestMean = Math.max(0, ...setReps.map((r) => r.meanV ?? 0));
  const mv = num(draft.meanV);
  const vl = draft.phase === "amrap" && mv != null && bestMean > 0 ? Math.max(0, (1 - mv / bestMean) * 100) : null;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const chooseTarget = (t: number) => update({ target: t, lb: suggestLb(t), set: 1 });

  const changeLift = (lift: LiftKey) =>
    setMine((p) => ({ ...p, lift, mvt: LIFTS[lift].mvt, recruitLine: LIFTS[lift].recruitLine }));

  const changeE1rm = (v: string) => {
    const e = num(v) ?? 0;
    setMine((p) => ({ ...p, e1rm: e }));
    if (e > 0) update({ lb: String(plateRound((e * draft.target) / 100)) });
  };

  function logRep() {
    if (!bar || !force) {
      setMessage("Enter the bar weight and peak force to log the rep.");
      return;
    }
    const rep: Rep = {
      round: draft.round,
      date: today(),
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
    setMessage(`Logged rep ${rep.rep} at ${rep.lb} lb.`);
    forceRef.current?.focus();
  }

  const deleteRep = (i: number) => setMine((p) => ({ ...p, reps: p.reps.filter((_, j) => j !== i) }));

  function exportCsv() {
    const blob = new Blob([toCsv(mine.reps)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `probe-${mine.lift}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const res = fromCsv(await file.text());
    if (res.error) {
      setMessage(res.error);
      return;
    }
    if (mine.reps.length && !window.confirm(`Replace your ${mine.reps.length} logged reps with the ${res.reps.length} in this file?`)) return;
    setMine((p) => ({ ...p, reps: res.reps }));
    setMessage(`Imported ${res.reps.length} reps${res.skipped ? `; skipped ${res.skipped} rows that weren't ladder or AMRAP reps` : ""}.`);
  }

  function loadExample() {
    if (mine.reps.length && !window.confirm("Replace your logged reps with the example probe?")) return;
    setMine({ ...EXAMPLE_PROBE });
    setMessage("Loaded the example probe. Edit or delete reps freely; it's your copy.");
  }

  function clearAll() {
    if (!window.confirm("Delete every logged rep? This can't be undone.")) return;
    setMine((p) => ({ ...p, reps: [] }));
    setMessage("Cleared your probe.");
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
    <div className="stack-lg">
      <div className="stack">
        <h1>Run the probe</h1>
        <p className="lede">
          Log each rep as you go. Everything saves in this browser, so you can close the page between sets.
        </p>
      </div>

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
            <label htmlFor="p-e1rm">e1RM (lb)</label>
            <input id="p-e1rm" inputMode="decimal" value={mine.e1rm || ""} placeholder="e.g. 315" onChange={(e) => changeE1rm(e.target.value)} />
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
            Repeat the probe on another day as round 2 to put error bars on your profile. One misgrooved rep won't
            ruin it: log it and keep going.
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
                <label htmlFor="d-lb">Bar weight (lb)</label>
                <input id="d-lb" inputMode="decimal" value={draft.lb} onChange={(e) => update({ lb: e.target.value })} />
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
            <button type="button" className="btn btn-small btn-quiet" onClick={exportCsv} disabled={!mine.reps.length}>
              Export CSV
            </button>
            <button type="button" className="link-btn" onClick={loadExample}>
              Load the example
            </button>
            {mine.reps.length > 0 && (
              <button type="button" className="link-btn" onClick={clearAll}>
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
                  <th>Bar</th>
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
                  <RoundRows key={rnd} round={rnd} rows={sorted.filter((x) => x.r.round === rnd)} e1rm={mine.e1rm} onDelete={deleteRep} />
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
    </div>
  );
}

function RoundRows({
  round,
  rows,
  e1rm,
  onDelete,
}: {
  round: number;
  rows: Array<{ r: Rep; i: number }>;
  e1rm: number;
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
            <td>{r.lb}</td>
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
