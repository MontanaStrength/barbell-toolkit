import { useMemo } from "react";
import { Link } from "react-router-dom";
import { EIChart } from "../components/Charts";
import QualCard from "../components/QualCard";
import { analyze } from "../engine/analyze";
import { EXAMPLE_PROBE } from "../engine/example";
import { fmt, lb, usePageTitle } from "../format";

export default function Home() {
  usePageTitle("");
  const a = useMemo(() => analyze(EXAMPLE_PROBE), []);

  return (
    <>
      <section className="hero">
        <div className="stack-lg">
          <h1>Find the load that starts pulling in your fast-twitch.</h1>
          <p className="lede">
            Log a short probe with your velocity sensor and get your force–velocity profile: how much force you make at
            each load, where the bar starts recruiting high-threshold fibers, and when to stop a set for each goal.
          </p>
          <div className="btn-row">
            <Link to="/probe" className="btn">
              Run the probe
            </Link>
            <Link to="/report" className="btn btn-quiet">
              Read the example report
            </Link>
          </div>
          <p className="muted small">
            Free. Your data stays in this browser. Just want one number? <Link to="/rep">Read a single rep</Link>.
          </p>
        </div>
        <figure className="hero-figure panel">
          <EIChart a={a} compact />
          <figcaption>
            John's bench press. Above {fmt(a.lstar, 1)}% of a {EXAMPLE_PROBE.e1rm} lb max ({lb(a.lstarLb)}), the bar
            alone drives Effective Intensity past the {EXAMPLE_PROBE.recruitLine}% line. Below it, reps only get there
            if they're fast or taken close to failure.
          </figcaption>
        </figure>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>One session, about forty minutes</h2>
          <p className="muted">
            The probe is the Performance Lab's protocol. Rest the day before; the singles only count if they're fresh.
          </p>
        </div>
        <ol className="steps">
          <li>
            <h3>Set up</h3>
            <p>Pick the lift and enter your e1RM. It doesn't need to be exact; bar speed cross-checks it.</p>
          </li>
          <li>
            <h3>Ladder</h3>
            <p>Two or three max-intent singles at 60, 70, 80 and 90%. Log peak force and velocity for each.</p>
          </li>
          <li>
            <h3>All-out set</h3>
            <p>After a few minutes' rest, one set at 60% for as many fast reps as you can. Log every rep.</p>
          </li>
          <li>
            <h3>Read the report</h3>
            <p>Your Force–Load line, L*, how drive fades in a set, and a starting prescription with stop velocities.</p>
          </li>
        </ol>
      </section>

      <section className="section split">
        <div className="stack">
          <h2>Every number says when not to trust it</h2>
          <p>
            A velocity sensor gives readings, not truths. Each page of the report pairs its number with what it's good
            for and the conditions that break it, the way an instrument ships with its operating limits.
          </p>
          <p>
            Here's the card for L*. The same engine runs the in-person Performance Lab, and its math is checked against
            the original probe spreadsheet to six decimal places.
          </p>
        </div>
        <QualCard id="l-star" />
      </section>

      <section className="section split">
        <div className="stack">
          <h2>What you need</h2>
          <p>
            A sensor that reports <strong>peak force</strong>, <strong>mean velocity</strong> and{" "}
            <strong>peak velocity</strong> for each rep, such as a Tendo unit. A recent e1RM for the lift. A rested day.
          </p>
          <p className="muted">
            Phone-camera tracking doesn't qualify: it's too noisy for peak force, so the toolkit doesn't use it.
          </p>
        </div>
        <div className="stack">
          <h2>What you get</h2>
          <p>
            Your <Link to="/report/force-load">Force–Load line</Link>, your <Link to="/report/l-star">L*</Link> in
            pounds, how your <Link to="/report/decay">drive fades inside a set</Link>, and{" "}
            <Link to="/report/sessions">session bands</Link> with a stop velocity for power, strength and hypertrophy.
          </p>
          <p className="muted">
            Definitions for every number are on the <Link to="/metrics">metrics page</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
