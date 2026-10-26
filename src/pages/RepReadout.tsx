import { useState } from "react";
import { Link } from "react-router-dom";
import QualCard from "../components/QualCard";
import { Reading } from "../components/Readings";
import { LIFT_KEYS, LIFTS, type LiftKey } from "../engine/constants";
import { readRep } from "../engine/metrics";
import { fmt, usePageTitle } from "../format";
import { useStore } from "../store";

const SCALE: [number, number] = [40, 110];

export default function RepReadout() {
  usePageTitle("Read a rep");
  const { mine } = useStore();
  const [lift, setLift] = useState<LiftKey>(mine.lift ?? "bench");
  const [bar, setBar] = useState("225");
  const [force, setForce] = useState("1350");
  const [e1rm, setE1rm] = useState(mine.e1rm > 0 ? String(mine.e1rm) : "315");

  const line = LIFTS[lift].recruitLine;
  const r = readRep(parseFloat(bar), parseFloat(force), parseFloat(e1rm));
  const pos = (x: number) => ((Math.min(Math.max(x, SCALE[0]), SCALE[1]) - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100;

  let verdict = "Enter a bar weight, a peak force and your e1RM.";
  if (r && r.ei != null && r.loadPct != null) {
    if (r.loadPct >= 85) {
      verdict = `At ${fmt(r.loadPct, 0)}% of your max the load clears the ${line}% line by itself, so this rep's EI adds little.`;
    } else if (r.ei >= line) {
      verdict = `This rep drove ${fmt(r.ei, 1)}% of your max force off a ${fmt(r.loadPct, 0)}% bar: past the ${line}% line. By this model, intent brought in high-threshold fibers the load alone wouldn't.`;
    } else {
      verdict = `This rep drove ${fmt(r.ei, 1)}% of your max force, ${fmt(line - r.ei, 1)} points under the ${line}% line. At this load the work only counts toward recruitment if it's faster or taken closer to failure.`;
    }
  }

  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>Read a rep</h1>
        <p className="lede">
          One rep off your sensor, turned into the numbers the report uses. No protocol needed.
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
              <label htmlFor="bar">Bar weight (lb)</label>
              <input id="bar" inputMode="decimal" value={bar} onChange={(e) => setBar(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="force">Peak force (N)</label>
              <input id="force" inputMode="decimal" value={force} onChange={(e) => setForce(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e1rm">e1RM (lb)</label>
              <input id="e1rm" inputMode="decimal" value={e1rm} onChange={(e) => setE1rm(e.target.value)} />
            </div>
          </div>
          <p className="field-hint">Peak force in newtons, as most sensors report it. It's converted to pounds-force here.</p>
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
            <Reading label="Net force" value={r ? `${fmt(r.net, 0)} lbf` : "–"} note={r ? `Peak ${fmt(r.forceLbf, 0)} lbf` : undefined} />
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
        A single rep is one sample. For a profile you can program from, <Link to="/probe">run the probe</Link>.
      </p>
    </div>
  );
}
