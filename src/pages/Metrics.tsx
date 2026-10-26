import { Link } from "react-router-dom";
import { LIFT_KEYS, LIFTS, STOP_FRACTION } from "../engine/constants";
import { usePageTitle } from "../format";

const METRICS = [
  {
    name: "Net force",
    formula: "Peak force − bar weight",
    unit: "lbf",
    meaning: "Force left over after holding the bar up. The physical quantity the ratios are built from.",
  },
  {
    name: "Surplus Index",
    formula: "(Peak force − bar weight) ÷ bar weight",
    unit: "%",
    meaning: "Net force as a share of the bar. The headline measure of explosive headroom.",
  },
  {
    name: "Multiple",
    formula: "Peak force ÷ bar weight",
    unit: "×",
    meaning: "The same headroom as a multiplier. 1.40× means 40% surplus.",
  },
  {
    name: "Effective Intensity (EI)",
    formula: "Peak force ÷ e1RM  =  load % × Multiple",
    unit: "% of e1RM",
    meaning: "How much force a rep drives relative to your max. A recruitment proxy: a fast light rep and a slow heavy one can reach the same EI.",
  },
  {
    name: "g-Index",
    formula: "Surplus Index expressed in g",
    unit: "g",
    meaning: "The same surplus read as acceleration: 0.40 g is a 40% surplus.",
  },
  {
    name: "L*, fast-twitch threshold",
    formula: "Load % where EI from your Force–Load line crosses the recruitment line",
    unit: "% of e1RM",
    meaning: "Below L*, reps need speed or proximity to failure to reach the line. Above it, the load gets there by itself.",
  },
  {
    name: "Drive compression (α, β)",
    formula: "Surplus = α · (1 − load/100)^β",
    unit: "",
    meaning: "How surplus collapses with load. α is a modeled ceiling below the tested range; β is the curvature.",
  },
  {
    name: "Velocity stop",
    formula: "(1 − f) · fresh mean velocity + f · MVT",
    unit: "m/s",
    meaning: `End the set when a rep's mean velocity falls below this. f is ${STOP_FRACTION.power} for power, ${STOP_FRACTION.strength} for strength, ${STOP_FRACTION.hypertrophy} for hypertrophy (provisional).`,
  },
  {
    name: "Neural dose (Hanley)",
    formula: "Sets · reps · (100 ÷ (100 − intensity))²",
    unit: "",
    meaning: "Session load weighted steeply by intensity. Strength bands aim for 450–600; hypertrophy blocks 350–600.",
  },
];

export default function Metrics() {
  usePageTitle("Metrics");
  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>Metrics</h1>
        <p className="lede">
          Every number the toolkit reports, with its formula. Store the raw readings; everything here is derived from
          them, and rounding happens only on screen.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th style={{ textAlign: "left" }}>Formula</th>
              <th>Unit</th>
              <th style={{ textAlign: "left" }}>What it tells you</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.name}>
                <td>
                  <strong>{m.name}</strong>
                </td>
                <td className="note" style={{ color: "var(--ink)" }}>
                  {m.formula}
                </td>
                <td>{m.unit}</td>
                <td className="note">{m.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="split">
        <div className="stack">
          <h2>Recruitment lines by lift</h2>
          <p>
            The line is the Effective Intensity a rep has to reach to count as recruiting high-threshold units. It's set
            per lift and you can override it on the probe page.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lift</th>
                <th>Line</th>
                <th>Default MVT</th>
              </tr>
            </thead>
            <tbody>
              {LIFT_KEYS.map((k) => (
                <tr key={k}>
                  <td>{LIFTS[k].name}</td>
                  <td>{LIFTS[k].recruitLine}%</td>
                  <td>{LIFTS[k].mvt.toFixed(2)} m/s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted">
        See them on real data in the <Link to="/report">example report</Link>, or work out one rep on the{" "}
        <Link to="/rep">rep readout</Link>.
      </p>
    </div>
  );
}
