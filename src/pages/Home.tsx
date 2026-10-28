import { useMemo } from "react";
import { Link } from "react-router-dom";
import { EIChart } from "../components/Charts";
import QualCard from "../components/QualCard";
import { analyze } from "../engine/analyze";
import { EXAMPLE_PROBE } from "../engine/example";
import { fmt, usePageTitle, wt } from "../format";
import { useStore } from "../store";

export default function Home() {
  usePageTitle("");
  const { unit } = useStore();
  const a = useMemo(() => analyze(EXAMPLE_PROBE), []);

  return (
    <>
      <section className="hero">
        <div className="stack-lg">
          <div className="stack-sm">
            <p className="kicker">For lifters and coaches with a velocity sensor</p>
            <h1>Find the load that starts pulling in your fast-twitch.</h1>
          </div>
          <p className="lede">
            One session of sensor readings becomes a force–velocity profile: force at each load, the load where the
            bar starts recruiting high-threshold fibers, and a stop velocity for every set.
          </p>
          <div className="btn-row">
            <Link to="/probe" className="btn">
              Run the probe
            </Link>
            <Link to="/report" className="btn btn-quiet">
              See an example report
            </Link>
          </div>
          <p className="muted small">
            Or <Link to="/rep">read a single rep</Link>.
          </p>
        </div>
        <figure className="hero-figure panel">
          <EIChart a={a} compact />
          <figcaption>
            Example bench press, {wt(EXAMPLE_PROBE.e1rm, unit)} max. Ladder singles as Effective Intensity, peak force
            over max. The curve crosses the recruitment line at L* = {fmt(a.lstar, 1)}% ({wt(a.lstarLb, unit)}).
          </figcaption>
        </figure>
      </section>

      <section className="facts panel" aria-label="Before you start">
        <div>
          <h2>Sensor</h2>
          <p>
            Any unit that reports <strong>peak force</strong>, <strong>mean velocity</strong> and{" "}
            <strong>peak velocity</strong> per rep, such as a Tendo.
          </p>
        </div>
        <div>
          <h2>Input</h2>
          <p>Readings entered rep by rep, or imported as CSV. A recent max for the lift.</p>
        </div>
        <div>
          <h2>Data</h2>
          <p>Stays in this browser. Export as CSV any time. No account.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The probe: one session, about forty minutes</h2>
          <p className="muted">Fresh. Rest the day before.</p>
        </div>
        <ol className="steps">
          <li>
            <h3>Set up</h3>
            <p>Choose the lift and enter an e1RM. Bar speed cross-checks it.</p>
          </li>
          <li>
            <h3>Ladder</h3>
            <p>Two or three max-intent singles at 60, 70, 80 and 90%. Log each.</p>
          </li>
          <li>
            <h3>All-out set</h3>
            <p>One set at 60%, fast intent, as many reps as hold. Log every rep.</p>
          </li>
          <li>
            <h3>Read the report</h3>
            <p>
              <Link to="/report/force-load">Force–Load line</Link>, <Link to="/report/l-star">L*</Link>,{" "}
              <Link to="/report/decay">within-set decay</Link>, and <Link to="/report/sessions">sessions</Link> with
              stop velocities.
            </p>
          </li>
        </ol>
      </section>

      <section className="section split">
        <div className="stack">
          <h2>Operating limits</h2>
          <p>
            Each reading in the report carries what it's for and the conditions that break it. This is the card for
            L*.
          </p>
          <p className="muted">
            Formulas for every number are on the <Link to="/metrics">metrics page</Link>.
          </p>
        </div>
        <QualCard id="l-star" />
      </section>
    </>
  );
}
