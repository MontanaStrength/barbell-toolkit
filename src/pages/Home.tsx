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
            Barbell Toolkit turns one session of readings from your velocity sensor into a force–velocity profile: how
            much force you make at each load, the load where the bar starts recruiting high-threshold fibers, and when
            to stop a set for power, strength or hypertrophy. Every number comes with how far to trust it.
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
            Just want one number? <Link to="/rep">Read a single rep</Link>.
          </p>
        </div>
        <figure className="hero-figure panel">
          <EIChart a={a} compact />
          <figcaption>
            Example: John's bench press. The dots are his ladder singles, plotted as Effective Intensity, peak force as
            a share of his {wt(EXAMPLE_PROBE.e1rm, unit)} max. Above {fmt(a.lstar, 1)}% ({wt(a.lstarLb, unit)}), the
            load alone carries a rep past the red recruitment line. Below it, reps only get there if they're fast or
            taken close to failure.
          </figcaption>
        </figure>
      </section>

      <section className="facts panel" aria-label="Before you start">
        <div>
          <h2>What you need</h2>
          <p>
            A sensor that reports <strong>peak force</strong>, <strong>mean velocity</strong> and{" "}
            <strong>peak velocity</strong> for each rep (a Tendo unit, for example), and a recent max for the lift.
          </p>
        </div>
        <div>
          <h2>It isn't a tracker</h2>
          <p>
            You enter your sensor's numbers, rep by rep or as a CSV. Phone-camera tracking is too noisy for peak force,
            so the toolkit doesn't use it.
          </p>
        </div>
        <div>
          <h2>Free, no account</h2>
          <p>Your probe stays in this browser. Nothing is uploaded, and you can export it as a CSV any time.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>One session, about forty minutes</h2>
          <p className="muted">Rest the day before; the singles only count if they're fresh.</p>
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
            <p>
              Your <Link to="/report/force-load">Force–Load line</Link>, <Link to="/report/l-star">L*</Link>,{" "}
              <Link to="/report/decay">how drive fades in a set</Link>, and{" "}
              <Link to="/report/sessions">session bands</Link> with stop velocities.
            </p>
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
            Here's the card for L*. The math behind it is tested against the original probe spreadsheet to six
            decimal places.
          </p>
          <p className="muted">
            Definitions for every number are on the <Link to="/metrics">metrics page</Link>.
          </p>
        </div>
        <QualCard id="l-star" />
      </section>
    </>
  );
}
