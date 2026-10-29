import { useState } from "react";
import { Link } from "react-router-dom";
import QualCard from "../components/QualCard";
import { Reading } from "../components/Readings";
import { LIFT_KEYS, LIFTS, type LiftKey } from "../engine/constants";
import { readRep } from "../engine/metrics";
import WeightInput from "../components/WeightInput";
import { force as fmtForce, fmt, fromUnit, usePageTitle } from "../format";
import { useStore } from "../store";

const SCALE: [number, number] = [40, 110];

export default function RepReadout() {
  usePageTitle("Read a rep");
  const { mine, unit } = useStore();
  const [lift, setLift] = useState<LiftKey>(mine.lift ?? "bench");
  const [barLb, setBarLb] = useState<number | null>(() => (unit === "kg" ? fromUnit(100, "kg") : 225));
  const [force, setForce] = useState("1350");
  const [e1rmLb, setE1rmLb] = useState<number | null>(() =>
    mine.e1rm > 0 ? mine.e1rm : unit === "kg" ? fromUnit(140, "kg") : 315,
  );

  const line = LIFTS[lift].recruitLine;
  const r = readRep(barLb ?? NaN, parseFloat(force), e1rmLb);
  const pos = (x: number) => ((Math.min(Math.max(x, SCALE[0]), SCALE[1]) - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100;

  let verdict = "Enter a bar weight, a peak force and an e1RM.";
  if (r && r.ei != null && r.loadPct != null) {
    if (r.loadPct >= line) {
      verdict = `At ${fmt(r.loadPct, 0)}% of max, the load clears the ${line}% line by itself.`;
    } else if (r.ei >= line) {
      verdict = `EI ${fmt(r.ei, 1)}% off a ${fmt(r.loadPct, 0)}% bar: past the ${line}% line. Intent recruited what the load alone wouldn't.`;
    } else {
      verdict = `EI ${fmt(r.ei, 1)}%, ${fmt(line - r.ei, 1)} points under the ${line}% line. More intent closes part of that gap; below L*, the rest comes only through fatigue, late in a hard set.`;
    }
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>Read a rep</h1>
        <p className="lede">
          One rep off the sensor, read against the lift's recruitment line.
        </p>
      </div>

      <div className="probe-grid">
        <form className="panel stack" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="lift">Lift</label>
            <select id="lift" value={lift} onChange={(e) => setLift(e.target.value as LiftKey)}>
              {LIFT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LIFTS[k].name}
                </option>
              ))}
            </select>
          </div>
          <div className="fields">
            <div className="field">
              <label htmlFor="bar">Bar weight ({unit})</label>
              <WeightInput id="bar" valueLb={barLb} unit={unit} onChangeLb={setBarLb} />
            </div>
            <div className="field">
              <label htmlFor="force">Peak force (N)</label>
              <input id="force" inputMode="decimal" value={force} onChange={(e) => setForce(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e1rm">e1RM ({unit})</label>
              <WeightInput id="e1rm" valueLb={e1rmLb} unit={unit} onChangeLb={setE1rmLb} />
            </div>
          </div>
          <p className="field-hint">Peak force in newtons.</p>
        </form>

        <div className="stack" aria-live="polite">
          <div>
            <div className="reading-label">Multiple</div>
            <div className="reading-hero">
              <span className="big-number">{r ? fmt(r.multiple, 2) : "–"}</span>
              <span className="big-unit">× bar weight</span>
            </div>
          </div>
          <div className="readings">
            <Reading label="Surplus Index" value={r ? `${fmt(r.surplus * 100, 1)}%` : "–"} note={r ? `${fmt(r.surplus, 2)} g` : undefined} />
            <Reading label="Net force" value={r ? fmtForce(r.net, unit) : "–"} note={r ? `Peak ${fmtForce(r.forceLbf, unit)}` : undefined} />
            <Reading label="Load" value={r?.loadPct != null ? `${fmt(r.loadPct, 1)}%` : "–"} note="of e1RM" />
            <Reading label="Effective Intensity" value={r?.ei != null ? `${fmt(r.ei, 1)}%` : "–"} note="peak force ÷ e1RM" />
          </div>
        </div>
      </div>

      <section className="panel stack" aria-label="Effective Intensity against the recruitment line">
        <h2>Against the {LIFTS[lift].name.toLowerCase()} line</h2>
        <div className="scale">
          <div className="scale-track" />
          <div className="scale-line" style={{ left: `${pos(line)}%` }}>
            <span className="scale-line-label">{line}%</span>
          </div>
          {r?.ei != null && <div className="scale-marker" style={{ left: `${pos(r.ei)}%` }} aria-hidden="true" />}
        </div>
        <div className="scale-ticks" aria-hidden="true">
          {[40, 50, 60, 70, 80, 90, 100, 110].map((t) => (
            <span key={t}>{t}%</span>
          ))}
        </div>
        <p>{verdict}</p>
      </section>

      <QualCard id="rep" />

      <p className="muted">
        One rep is one sample. For a profile, <Link to="/probe">run the probe</Link>.
      </p>
    </div>
  );
}
