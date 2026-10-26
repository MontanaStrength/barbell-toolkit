import { useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { DecayChart, DriveChart, EIChart, ForceLoadChart, ReliabilityChart } from "../components/Charts";
import QualCard from "../components/QualCard";
import { KV } from "../components/Readings";
import SourceBar from "../components/SourceBar";
import { analyze, type Analysis } from "../engine/analyze";
import { STOP_FRACTION } from "../engine/constants";
import { fmt, lb, ms, pct, usePageTitle } from "../format";
import { useStore } from "../store";
import NotFound from "./NotFound";

const SECTIONS = [
  { id: "", nav: "Overview", title: "The one-screen read" },
  { id: "force-load", nav: "Force–Load", title: "Force capability across the load axis" },
  { id: "drive", nav: "Drive compression", title: "How surplus force collapses under load" },
  { id: "l-star", nav: "L*", title: "Where the load starts pulling in fast-twitch" },
  { id: "decay", nav: "Within-set decay", title: "How drive fades inside a set, and what tracks it" },
  { id: "reliability", nav: "Reliability", title: "How much to trust each point" },
  { id: "sessions", nav: "Sessions", title: "Turning the numbers into sessions" },
] as const;

export default function Report() {
  const { section = "" } = useParams();
  const { analysis: a } = useStore();
  const idx = SECTIONS.findIndex((s) => s.id === section);
  const meta = SECTIONS[idx];
  usePageTitle(meta ? (meta.id ? `${meta.nav}, report` : "Report") : "Not found");
  if (!meta) return <NotFound />;

  const prev = idx > 0 ? SECTIONS[idx - 1] : null;
  const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;
  const href = (id: string) => (id ? `/report/${id}` : "/report");

  return (
    <>
      <SourceBar />
      <div className="report">
        <nav className="report-nav" aria-label="Report sections">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <NavLink to={href(s.id)} end className={({ isActive }) => (isActive ? "active" : undefined)}>
                  {s.nav}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
        <article className="report-body stack-lg">
          <h1 style={{ fontSize: "clamp(32px, 4.6vw, 46px)" }}>{meta.title}</h1>
          {section === "" && <Overview a={a} />}
          {section === "force-load" && <ForceLoad a={a} />}
          {section === "drive" && <Drive a={a} />}
          {section === "l-star" && <LStar a={a} />}
          {section === "decay" && <Decay a={a} />}
          {section === "reliability" && <Reliability a={a} />}
          {section === "sessions" && <Sessions a={a} />}
          <nav className="pager" aria-label="Previous and next section">
            {prev ? (
              <Link to={href(prev.id)}>
                <small>Previous</small>
                {prev.nav}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={href(next.id)} className="pager-next">
                <small>Next</small>
                {next.nav}
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}

function Says({ children }: { children: ReactNode }) {
  return (
    <section className="stack" aria-label="What it says">
      <h2 style={{ fontSize: 26 }}>What it says</h2>
      {children}
    </section>
  );
}

function Overview({ a }: { a: Analysis }) {
  const rows: Array<{ to: string; label: string; value: string; note: string }> = [
    {
      to: "/report/l-star",
      label: "L*, fast-twitch threshold",
      value: a.lstar != null ? `${fmt(a.lstar, 1)}%` : "–",
      note: a.lstarLb != null ? `${lb(a.lstarLb)}. Population at the same line: ${pct(a.lstarPop)}.` : "Needs a Force–Load line.",
    },
    {
      to: "/report/force-load",
      label: "Force–Load line",
      value: a.fl.m != null ? `${fmt(a.fl.m, 4)} per %` : "–",
      note: a.fl.r2 != null ? `R² ${fmt(a.fl.r2, 3)} across ${a.points.length} loads.` : "Needs two or more loads.",
    },
    {
      to: "/report/drive",
      label: "Drive compression",
      value: a.beta != null ? `β ${fmt(a.beta, 2)}` : "–",
      note: a.points.length ? `Surplus falls from ${fmt(a.points[0].surplus, 0)}% to ${fmt(a.points[a.points.length - 1].surplus, 0)}% across the tested loads.` : "",
    },
    {
      to: "/report/decay",
      label: "Velocity that tracks force loss",
      value: a.decoupling.corrMean != null ? `r ${fmt(a.decoupling.corrMean, 2)}` : "–",
      note:
        a.decoupling.corrMean != null
          ? `Mean velocity loss against surplus loss, ${a.decoupling.n} reps pooled. Peak velocity: r ${fmt(a.decoupling.corrPeak, 2)}.`
          : "Needs an all-out set with velocities.",
    },
    {
      to: "/report/l-star",
      label: "e1RM from bar speed",
      value: a.velE1rm != null ? lb(a.velE1rm) : "–",
      note: a.velCrossPct != null ? `${fmt(a.velCrossPct, 1)}% from the ${a.probe.e1rm} lb you entered.` : "Needs velocities at two or more loads.",
    },
    {
      to: "/report/reliability",
      label: "Confirmed loads",
      value: `${a.loadPoints.filter((p) => p.rounds.filter((r) => r.clean).length >= 2).length} of ${a.loadPoints.length}`,
      note: "Loads with two or more clean ladder rounds.",
    },
  ];
  return (
    <>
      <p className="lede">
        Six readings from {a.probe.reps.length} logged reps. Each links to the page that shows the evidence and says when
        not to trust it.
      </p>
      <div className="readings">
        {rows.map((r) => (
          <Link key={r.label} to={r.to} className="reading" style={{ textDecoration: "none" }}>
            <div className="reading-label">{r.label}</div>
            <div className="reading-value">{r.value}</div>
            <div className="reading-note">{r.note}</div>
          </Link>
        ))}
      </div>
      {a.flags.length > 0 && (
        <section className="stack" aria-label="Checks">
          <h2 style={{ fontSize: 26 }}>Checks on this data</h2>
          <ul className="flags">
            {a.flags.map((f) => (
              <li key={f.text} className={f.level === "warn" ? "flag flag-warn" : "flag"}>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      <EIChart a={a} />
    </>
  );
}

function ForceLoad({ a }: { a: Analysis }) {
  const curved =
    a.fl.m != null && a.fl.b != null && a.points.length >= 4
      ? a.points.map((p) => p.mult - (a.fl.m! * p.load + a.fl.b!))
      : null;
  const bowed = curved && curved[0] < 0 && curved[curved.length - 1] < 0 && curved.slice(1, -1).every((r) => r > 0);
  const sagged = curved && curved[0] > 0 && curved[curved.length - 1] > 0 && curved.slice(1, -1).every((r) => r < 0);
  const steeperLight = a.cleanSlope != null && a.fl.m != null && a.cleanSlope < a.fl.m;
  return (
    <>
      <ForceLoadChart a={a} />
      <Says>
        <p>
          <strong>Multiple</strong> is peak force divided by bar weight. As the bar gets heavier the Multiple falls
          {a.fl.r2 != null && a.fl.r2 > 0.9 ? ", here in a near-straight line" : ""}. The slope is how much force reserve
          you lose for each percent of e1RM added.
        </p>
        {(bowed || sagged) && (
          <p>
            Read the line as provisional: the points {bowed ? "bow above it in the middle" : "sag below it in the middle"},
            so a gentle curve is being fit with a straight line.
          </p>
        )}
        {steeperLight && (
          <p>
            Between the two lightest loads the drop is steeper ({fmt(a.cleanSlope, 4)} per %) than the overall line, so
            the flatter overall slope comes from the heavy end.
          </p>
        )}
        <p>
          Your line {a.fl.m != null && a.fl.m > -0.0114 ? "falls more slowly than" : "falls faster than"} the population
          line, which means you {a.fl.m != null && a.fl.m > -0.0114 ? "keep more" : "lose more"} force reserve as load
          rises than the average lifter in the model.
        </p>
      </Says>
      <KV
        rows={[
          ["Slope", `${fmt(a.fl.m, 5)} per %`],
          ["Intercept", fmt(a.fl.b, 3)],
          ["R²", fmt(a.fl.r2, 3)],
          ["Slope between the two lightest loads", fmt(a.cleanSlope, 4)],
          ["Population slope", "-0.0114"],
        ]}
      />
      <QualCard id="force-load" />
    </>
  );
}

function Drive({ a }: { a: Analysis }) {
  const first = a.points[0];
  const last = a.points[a.points.length - 1];
  return (
    <>
      <DriveChart a={a} />
      <Says>
        <p>
          <strong>Surplus</strong> is force made above the bar's weight, as a percent of that weight. Plotted against load
          it traces how explosive headroom shrinks as the bar gets heavy.
        </p>
        <p>
          Two fitted numbers describe the curve, and both are modeled, not measured. <strong>α ≈ {fmt(a.alpha, 0)}%</strong>{" "}
          is the curve projected below the tested range: a way to type lifters, not a real ceiling.{" "}
          <strong>β ≈ {fmt(a.beta, 2)}</strong> is the curvature. Trust the measured points over both.
        </p>
      </Says>
      <KV
        rows={[
          ["Drive ceiling α (modeled)", a.alpha != null ? `about ${fmt(a.alpha, 0)}%` : "–"],
          ["Compression β", fmt(a.beta, 3)],
          ...(first ? ([[`Surplus at ${fmt(first.load, 0)}%`, pct(first.surplus)]] as Array<[string, string]>) : []),
          ...(last && last !== first ? ([[`Surplus at ${fmt(last.load, 0)}%`, pct(last.surplus)]] as Array<[string, string]>) : []),
        ]}
      />
      <QualCard id="drive" />
    </>
  );
}

function LStar({ a }: { a: Analysis }) {
  const base = a.probe.e1rm;
  const [e1rm, setE1rm] = useState(base);
  const alt = useMemo(() => (e1rm === base ? a : analyze({ ...a.probe, e1rm })), [a, e1rm, base]);
  return (
    <>
      <EIChart a={a} />
      <Says>
        <p>
          <strong>Effective Intensity</strong> is peak force divided by e1RM: how much force a rep drives relative to
          your max. Where it crosses the <strong>{a.probe.recruitLine}% line</strong> is <strong>L*</strong>, the
          fast-twitch threshold. Above it, making that much force off a sub-max bar needs high-threshold motor units.
          It's inferred from the force signature, not counted from fibers.
        </p>
        <p>
          Here <strong>L* = {fmt(a.lstar, 1)}%</strong>
          {a.lstarLb != null ? <> (about {lb(a.lstarLb)})</> : null}. Below it, lighter reps only build that drive if you
          move them fast or take the set deep. Above it, the load itself pulls in the fast-twitch fibers.
        </p>
      </Says>
      <KV
        rows={[
          ["L*, personal", pct(a.lstar)],
          ["L* in pounds", lb(a.lstarLb)],
          ["L*, population at the same line", pct(a.lstarPop)],
          ["Recruitment line", `${a.probe.recruitLine}%`],
          ["EI at the heaviest load", pct(a.eiTop)],
          ["e1RM implied by bar speed", a.velE1rm != null ? `${lb(a.velE1rm)} (${fmt(a.velCrossPct, 1)}% off)` : "–"],
        ]}
      />
      <section className="panel stack" aria-labelledby="sens-h">
        <h2 id="sens-h" style={{ fontSize: 26 }}>If your max is off</h2>
        <p>
          The bars you lifted don't change, but every percentage does. Slide the e1RM to see how far L* moves.
        </p>
        <div className="field">
          <label htmlFor="sens">
            e1RM: <strong>{e1rm} lb</strong>
            {e1rm !== base ? ` (${e1rm > base ? "+" : ""}${fmt(((e1rm - base) / base) * 100, 1)}%)` : " (as entered)"}
          </label>
          <input
            id="sens"
            type="range"
            min={Math.round(base * 0.9)}
            max={Math.round(base * 1.1)}
            step={1}
            value={e1rm}
            onChange={(e) => setE1rm(+e.target.value)}
            style={{ minHeight: 0, padding: 0, border: "none", background: "none" }}
          />
        </div>
        <KV
          rows={[
            ["L*", `${pct(alt.lstar)} (was ${pct(a.lstar)})`],
            ["L* in pounds", `${lb(alt.lstarLb)} (was ${lb(a.lstarLb)})`],
          ]}
        />
      </section>
      <QualCard id="l-star" />
    </>
  );
}

function Decay({ a }: { a: Analysis }) {
  const [id, setId] = useState<string | null>(a.decayDefault);
  const set = a.decaySets.find((s) => s.id === (id ?? a.decayDefault)) ?? null;
  if (!set) {
    return (
      <div className="empty">
        <p style={{ margin: "0 auto" }}>
          No all-out set logged yet. Finish the probe with one AMRAP at 60% and log every rep.
        </p>
      </div>
    );
  }
  const early = set.reps.slice(0, Math.min(5, set.reps.length));
  const holdNear = early.filter((r) => r.surplus >= set.freshCeiling * 0.8).length;
  return (
    <>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="set-pick">All-out set</label>
        <select id="set-pick" value={set.id} onChange={(e) => setId(e.target.value)}>
          {a.decaySets.map((s) => (
            <option key={s.id} value={s.id}>
              Round {s.round}, {s.lb} lb ({fmt(s.load, 0)}%), {s.reps.length} reps
            </option>
          ))}
        </select>
      </div>
      <DecayChart set={set} />
      <Says>
        <p>
          Drive peaks at {fmt(set.freshCeiling, 0)}% surplus{holdNear >= 3 ? " and holds near it through the early reps" : ""},
          then fades as fatigue builds: the within-set decay a rep count hides. Stop a set where mean velocity crosses
          its floor, not at a fixed rep number.
        </p>
        {a.decoupling.corrMean != null && (
          <p>
            Across every all-out set ({a.decoupling.n} reps), surplus loss tracks mean-velocity loss at r ={" "}
            {fmt(a.decoupling.corrMean, 2)} and peak-velocity loss at r = {fmt(a.decoupling.corrPeak, 2)}.
            {a.decoupling.corrPeak != null && a.decoupling.corrPeak > a.decoupling.corrMean
              ? " Peak velocity scores higher partly because it comes from the same instant as peak force, so the two share noise."
              : ""}{" "}
            The velocity stops in the session bands are built on mean velocity, the steadier reading rep to rep.
          </p>
        )}
      </Says>
      <KV
        rows={[
          ["This set: surplus vs mean velocity", fmt(set.corrMean, 2)],
          ["This set: surplus vs peak velocity", fmt(set.corrPeak, 2)],
          ["All sets pooled: vs mean velocity loss", fmt(a.decoupling.corrMean, 3)],
          ["All sets pooled: vs peak velocity loss", fmt(a.decoupling.corrPeak, 3)],
        ]}
      />
      <QualCard id="decay" />
    </>
  );
}

function Reliability({ a }: { a: Analysis }) {
  const rounds = [...new Set(a.loadPoints.flatMap((p) => p.rounds.map((r) => r.round)))].sort((x, y) => x - y);
  return (
    <>
      <ReliabilityChart a={a} />
      <Says>
        <p>
          A trustworthy reading shows its error bars. Loads with two or more clean ladder rounds are confirmed across
          separate days, so they aren't a one-day artifact. Their spread is the coefficient of variation (CV) below.
        </p>
        <p>
          Loads with a single round are directionally sound, but their error margins fill in only as rounds accumulate.
          AMRAP openers are shown for reference and left out of the profile, because they're not max-intent singles.
        </p>
      </Says>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Load</th>
              {rounds.map((r) => (
                <th key={r}>Round {r}</th>
              ))}
              <th>Fresh</th>
              <th>CV</th>
            </tr>
          </thead>
          <tbody>
            {a.loadPoints.map((p) => (
              <tr key={p.key}>
                <td>
                  {fmt(p.load, 1)}% ({Math.round(p.lb)} lb)
                </td>
                {rounds.map((rnd) => {
                  const v = p.rounds.find((r) => r.round === rnd);
                  return <td key={rnd}>{v ? `${fmt(v.mult, 3)}${v.clean ? "" : "*"}` : "–"}</td>;
                })}
                <td>
                  <strong>{fmt(p.mult, 3)}</strong>
                </td>
                <td>{p.cv != null ? pct(p.cv * 100, 2) : "one round"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">* AMRAP opener, not counted.</p>
      <QualCard id="reliability" />
    </>
  );
}

function Sessions({ a }: { a: Analysis }) {
  if (a.lstar == null) {
    return (
      <div className="empty">
        <p style={{ margin: "0 auto" }}>Session bands need an L*. Log ladder singles at three or more loads.</p>
      </div>
    );
  }
  return (
    <>
      <p className="lede">
        Bands start at L* = {fmt(a.lstar, 1)}% ({lb(a.lstarLb)}). Each has a rep range, a set count tuned to the Hanley
        neural dose, and a stop velocity: end the set when a rep's mean velocity falls below it.
      </p>
      <h2 style={{ fontSize: 26 }}>Strength and speed</h2>
      <BandTable bands={a.bands} />
      <h2 style={{ fontSize: 26 }}>Hypertrophy</h2>
      <BandTable bands={a.hypBands} />

      <section className="stack" aria-labelledby="stops-h">
        <h2 id="stops-h" style={{ fontSize: 26 }}>Stop velocities at your tested loads</h2>
        <p>
          The stop moves toward your MVT ({fmt(a.probe.mvt, 2)} m/s) by a fraction set by the goal:{" "}
          {STOP_FRACTION.power} for power, {STOP_FRACTION.strength} for strength, {STOP_FRACTION.hypertrophy} for
          hypertrophy. Stop = (1 − f) × fresh velocity + f × MVT. This rule is provisional.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Load</th>
                <th>Fresh mean v</th>
                <th>Power stop</th>
                <th>Strength stop</th>
                <th>Hypertrophy stop</th>
              </tr>
            </thead>
            <tbody>
              {a.stopsAtTested.map((s) => (
                <tr key={s.lb}>
                  <td>
                    {fmt(s.load, 1)}% ({Math.round(s.lb)} lb)
                  </td>
                  <td>{ms(s.v)}</td>
                  <td>{ms(s.power)}</td>
                  <td>{ms(s.strength)}</td>
                  <td>{ms(s.hypertrophy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <QualCard id="sessions" />
    </>
  );
}

function BandTable({ bands }: { bands: Analysis["bands"] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Band</th>
            <th>Load</th>
            <th>Bar</th>
            <th>Reps</th>
            <th>Sets</th>
            <th>Stop below</th>
            <th>Neural dose</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.label}>
              <td className="band-name">
                {b.label}
                {b.note ? <small>{b.note}</small> : null}
              </td>
              <td>
                {fmt(b.lo, 0)}–{fmt(b.hi, 0)}%
              </td>
              <td>{b.loLb != null && b.hiLb != null ? `${Math.round(b.loLb)}–${Math.round(b.hiLb)} lb` : "–"}</td>
              <td>{b.reps}</td>
              <td>{b.sets}</td>
              <td>{ms(b.stop)}</td>
              <td>{b.neural != null ? fmt(b.neural, 0) : "not counted"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
