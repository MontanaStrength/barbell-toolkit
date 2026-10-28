import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import {
  CompareEIChart,
  CompareForceChart,
  DecayChart,
  DriveChart,
  EIChart,
  ForceLoadChart,
  ReliabilityChart,
} from "../components/Charts";
import QualCard from "../components/QualCard";
import { KV } from "../components/Readings";
import SessionDesigner from "../components/SessionDesigner";
import SourceBar from "../components/SourceBar";
import { analyze, type Analysis } from "../engine/analyze";
import { compareProbes, noiseBasis, sharedRange, type Change } from "../engine/compare";
import { LIFTS, N_TO_LBF, STOP_FRACTION } from "../engine/constants";
import { fmt, force, fromUnit, ms, pct, plateStep, signed, suggestBarLb, toUnit, usePageTitle, wt, wtRange, type Unit } from "../format";
import { byDateDesc, probeDate, probeWhen, type SavedProbe } from "../probes";
import { isUsable, useStore } from "../store";
import NotFound from "./NotFound";

const SECTIONS = [
  { id: "", nav: "Overview", title: "The one-screen read" },
  { id: "force-load", nav: "Force–Load", title: "Force capability across the load axis" },
  { id: "drive", nav: "Drive compression", title: "How surplus force collapses under load" },
  { id: "l-star", nav: "L*", title: "Where the load starts pulling in fast-twitch" },
  { id: "decay", nav: "Within-set decay", title: "How drive fades inside a set, and what tracks it" },
  { id: "reliability", nav: "Reliability", title: "How much to trust each point" },
  { id: "sessions", nav: "Sessions", title: "Turning the numbers into sessions" },
  { id: "compare", nav: "Compare", title: "What changed between probes" },
] as const;

export default function Report() {
  const { section = "" } = useParams();
  const navRef = useRef<HTMLOListElement>(null);
  // On phones the section menu scrolls sideways; keep the current section in view.
  useEffect(() => {
    const ol = navRef.current;
    const link = ol?.querySelector<HTMLElement>("a.active");
    if (ol && link && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = link.offsetLeft - (ol.clientWidth - link.offsetWidth) / 2;
  }, [section]);
  const { analysis: a, unit } = useStore();
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
          <ol ref={navRef}>
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
          {section === "" && <Overview a={a} unit={unit} />}
          {section === "force-load" && <ForceLoad a={a} />}
          {section === "drive" && <Drive a={a} />}
          {section === "l-star" && <LStar a={a} unit={unit} />}
          {section === "decay" && <Decay a={a} unit={unit} />}
          {section === "reliability" && <Reliability a={a} unit={unit} />}
          {section === "sessions" && <Sessions a={a} unit={unit} />}
          {section === "compare" && <Compare unit={unit} />}
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

/** Other complete probes of the same lift as the one on screen, newest first. */
function useOtherProbes(): { viewed: SavedProbe | null; others: SavedProbe[] } {
  const { source, viewed, probes } = useStore();
  if (source === "example" || !viewed) return { viewed: null, others: [] };
  const others = probes
    .filter((s) => s.id !== viewed.id && s.probe.lift === viewed.probe.lift && isUsable(s.probe))
    .sort(byDateDesc);
  return { viewed, others };
}

function Overview({ a, unit }: { a: Analysis; unit: Unit }) {
  const { others } = useOtherProbes();
  const rows: Array<{ to: string; label: string; value: string; note: string }> = [
    {
      to: "/report/l-star",
      label: "L*, fast-twitch threshold",
      value: a.lstar != null ? `${fmt(a.lstar, 1)}%` : "–",
      note: a.lstarLb != null ? `${wt(a.lstarLb, unit)}. Population at the same line: ${pct(a.lstarPop)}.` : "Needs a Force–Load line.",
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
      value: a.velE1rm != null ? wt(a.velE1rm, unit) : "–",
      note: a.velCrossPct != null ? `${fmt(a.velCrossPct, 1)}% from the ${wt(a.probe.e1rm, unit)} you entered.` : "Needs velocities at two or more loads.",
    },
    {
      to: "/report/reliability",
      label: "Confirmed loads",
      value: `${a.loadPoints.filter((p) => p.rounds.filter((r) => r.clean).length >= 2).length} of ${a.loadPoints.length}`,
      note: "Loads with two or more clean ladder rounds.",
    },
  ];
  const flags = [...a.flags];
  if (a.velCrossPct != null && a.velCrossPct > 5 && a.velE1rm != null) {
    flags.push({
      level: "info",
      text: `Bar speed puts your max near ${wt(a.velE1rm, unit)}, ${fmt(a.velCrossPct, 0)}% from the ${wt(a.probe.e1rm, unit)} you entered. Check your e1RM or MVT.`,
    });
  }
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
      {flags.length > 0 && (
        <section className="stack" aria-label="Checks">
          <h2 style={{ fontSize: 26 }}>Checks on this data</h2>
          <ul className="flags">
            {flags.map((f) => (
              <li key={f.text} className={f.level === "warn" ? "flag flag-warn" : "flag"}>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {others.length > 0 && (
        <p className="panel panel-tight">
          You have {others.length === 1 ? "another" : `${others.length} other`} {LIFTS[a.probe.lift].name.toLowerCase()}{" "}
          probe{others.length === 1 ? "" : "s"}, the latest from {probeWhen(others[0])}.{" "}
          <Link to="/report/compare">See what changed</Link>.
        </p>
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

function LStar({ a, unit }: { a: Analysis; unit: Unit }) {
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
          {a.lstarLb != null ? <> (about {wt(a.lstarLb, unit)})</> : null}. Below it, lighter reps only build that drive if you
          move them fast or take the set deep. Above it, the load itself pulls in the fast-twitch fibers.
        </p>
      </Says>
      <KV
        rows={[
          ["L*, personal", pct(a.lstar)],
          ["L* as a bar weight", wt(a.lstarLb, unit)],
          ["L*, population at the same line", pct(a.lstarPop)],
          ["Recruitment line", `${a.probe.recruitLine}%`],
          ["EI at the heaviest load", pct(a.eiTop)],
          ["e1RM implied by bar speed", a.velE1rm != null ? `${wt(a.velE1rm, unit)} (${fmt(a.velCrossPct, 1)}% off)` : "–"],
        ]}
      />
      <section className="panel stack" aria-labelledby="sens-h">
        <h2 id="sens-h" style={{ fontSize: 26 }}>If your max is off</h2>
        <p>
          The bars you lifted don't change, but every percentage does. Slide the e1RM to see how far L* moves.
        </p>
        <div className="field">
          <label htmlFor="sens">
            e1RM: <strong>{wt(e1rm, unit)}</strong>
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
            ["L* as a bar weight", `${wt(alt.lstarLb, unit)} (was ${wt(a.lstarLb, unit)})`],
          ]}
        />
      </section>
      <QualCard id="l-star" />
    </>
  );
}

function Decay({ a, unit }: { a: Analysis; unit: Unit }) {
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
              Round {s.round}, {wt(s.lb, unit)} ({fmt(s.load, 0)}%), {s.reps.length} reps
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

function Reliability({ a, unit }: { a: Analysis; unit: Unit }) {
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
                  {fmt(p.load, 1)}% ({wt(p.lb, unit)})
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

function Sessions({ a, unit }: { a: Analysis; unit: Unit }) {
  return (
    <>
      <SessionDesigner a={a} unit={unit} />

      <section className="stack" aria-labelledby="bands-h">
        <h2 id="bands-h" style={{ fontSize: 30 }}>
          Your bands
        </h2>
        {a.lstar == null ? (
          <div className="empty">
            <p style={{ margin: "0 auto" }}>
              {a.fl.m == null
                ? "The bands start at L*, which comes from the Force–Load line. That line needs singles at two or more loads."
                : `The bands start at L*, where Effective Intensity crosses the ${a.probe.recruitLine}% line. On this probe it doesn't cross anywhere from 30 to 100% of max, so there are no bands to show.`}
            </p>
          </div>
        ) : (
          <>
            <p>
              Bands start at L* = {fmt(a.lstar, 1)}% ({wt(a.lstarLb, unit)}). Each has a rep range, a set count tuned to
              the Hanley neural dose, and a stop velocity: end the set when a rep's mean velocity falls below it.
            </p>
            <h3>Strength and speed</h3>
            <BandTable bands={a.bands} unit={unit} />
            <h3>Hypertrophy</h3>
            <BandTable bands={a.hypBands} unit={unit} />
          </>
        )}
      </section>

      <section className="stack" aria-labelledby="stops-h">
        <h3 id="stops-h">Stop velocities at your tested loads</h3>
        <p>
          The stop moves toward your MVT ({fmt(a.probe.mvt, 2)} m/s) by a fraction set by the goal:{" "}
          {STOP_FRACTION.power} for power, {STOP_FRACTION.strength} for strength, and for hypertrophy{" "}
          {STOP_FRACTION.hypertrophyBelowLstar} below L* and {STOP_FRACTION.hypertrophyAboveLstar} above it, because
          light sets only recruit high-threshold fibers when taken deep. Stop = (1 − f) × fresh velocity + f × MVT.
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
                    {fmt(s.load, 1)}% ({wt(s.lb, unit)})
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

function BandTable({ bands, unit }: { bands: Analysis["bands"]; unit: Unit }) {
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
              <td>{wtRange(b.loLb, b.hiLb, unit)}</td>
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

// ---------- comparing probes ----------

/** A bar both probes lifted, near 75% of the newer max, on the plates of the chosen unit. */
function pickBar(range: [number, number] | null, e1rm: number, unit: Unit): number | null {
  if (!range) return null;
  const [lo, hi] = range;
  const step = fromUnit(plateStep(unit), unit);
  let w = suggestBarLb(e1rm, 75, unit);
  if (w > hi) w -= Math.ceil((w - hi) / step - 1e-9) * step;
  if (w < lo) w += Math.ceil((lo - w) / step - 1e-9) * step;
  return w >= lo && w <= hi ? w : (lo + hi) / 2;
}

function Compare({ unit }: { unit: Unit }) {
  const { viewed, others } = useOtherProbes();
  if (!viewed) {
    return (
      <div className="empty stack">
        <p style={{ margin: "0 auto" }}>
          Compare lines up two of your own probes of the same lift: force and bar speed at the same weight, L*, and your
          session bands, each with a noise band so you can tell a real change from measurement wobble. The worked
          example is a single probe, so there's nothing to compare it with.
        </p>
        <p style={{ margin: "0 auto" }}>
          <Link to="/probe" className="btn">
            Run the probe
          </Link>
        </p>
      </div>
    );
  }
  if (!others.length) {
    return (
      <div className="empty stack">
        <p style={{ margin: "0 auto" }}>
          This is your only {LIFTS[viewed.probe.lift].name.toLowerCase()} probe so far. After your next training block,
          press <strong>New probe</strong> on the probe page and run it again. This one stays saved, and this page will
          show what changed.
        </p>
        <p style={{ margin: "0 auto" }}>
          <Link to="/probe" className="btn btn-quiet">
            Go to the probe page
          </Link>
        </p>
      </div>
    );
  }
  return <CompareBody key={viewed.id} viewed={viewed} others={others} unit={unit} />;
}

function Verdict({ ch, mag }: { ch: Change; mag: (x: number | null) => string }) {
  if (ch.verdict === "unknown") return <span className="verdict verdict-unknown">No noise band</span>;
  return (
    <span className={`verdict verdict-${ch.verdict}`}>
      {ch.verdict === "real" ? "Bigger than the noise" : "Inside the noise"} (±{mag(ch.band)})
    </span>
  );
}

interface Shown {
  value: (x: number | null) => string;
  delta: (x: number | null) => string;
  mag: (x: number | null) => string;
}

function CompareBody({ viewed, others, unit }: { viewed: SavedProbe; others: SavedProbe[]; unit: Unit }) {
  const before = others.find((s) => probeDate(s) <= probeDate(viewed)) ?? others[0];
  const [otherId, setOtherId] = useState(before.id);
  const other = others.find((s) => s.id === otherId) ?? before;
  const [early, late] = probeDate(other) <= probeDate(viewed) ? [other, viewed] : [viewed, other];
  const barLb = useMemo(
    () => pickBar(sharedRange(early.probe, late.probe), late.probe.e1rm, unit),
    [early, late, unit],
  );
  const c = useMemo(() => compareProbes(early.probe, late.probe, { barLb }), [early, late, barLb]);
  const ch = c.changes;
  const labels = { earlier: probeWhen(early), later: probeWhen(late) };
  const bar = barLb != null ? wt(barLb, unit) : null;

  const fUnit = unit === "kg" ? "N" : "lbf";
  const toF = (lbf: number) => (unit === "kg" ? lbf / N_TO_LBF : lbf);
  const S: Record<"force" | "speed" | "lstar" | "lstarLb" | "slope" | "mult" | "e1rm" | "alpha" | "beta", Shown> = {
    force: { value: (x) => force(x, unit), delta: (x) => (x == null ? "–" : `${signed(toF(x), 0)} ${fUnit}`), mag: (x) => (x == null ? "–" : `${Math.round(toF(x))} ${fUnit}`) },
    speed: { value: (x) => ms(x), delta: (x) => `${signed(x, 2)} m/s`, mag: (x) => ms(x) },
    lstar: { value: (x) => pct(x), delta: (x) => `${signed(x, 1)} points`, mag: (x) => `${fmt(x, 1)} points` },
    lstarLb: {
      value: (x) => wt(x, unit),
      delta: (x) => (x == null ? "–" : `${signed(toUnit(x, unit), unit === "kg" ? 1 : 0)} ${unit}`),
      mag: (x) => (x == null ? "–" : `${fmt(toUnit(x, unit), unit === "kg" ? 1 : 0)} ${unit}`),
    },
    slope: { value: (x) => (x == null ? "–" : `${fmt(x, 4)} per %`), delta: (x) => signed(x, 4), mag: (x) => fmt(x, 4) },
    mult: { value: (x) => (x == null ? "–" : `${fmt(x, 3)}×`), delta: (x) => signed(x, 3), mag: (x) => fmt(x, 3) },
    e1rm: { value: (x) => wt(x, unit), delta: (x) => (x == null ? "–" : `${signed(toUnit(x, unit), unit === "kg" ? 1 : 0)} ${unit}`), mag: () => "" },
    alpha: { value: (x) => (x == null ? "–" : `${fmt(x, 0)}%`), delta: (x) => `${signed(x, 0)} points`, mag: (x) => `${fmt(x, 0)} points` },
    beta: { value: (x) => fmt(x, 2), delta: (x) => signed(x, 2), mag: (x) => fmt(x, 2) },
  };

  const headline: Array<{ label: string; ch: Change; s: Shown }> = [
    ...(bar ? [{ label: `Peak force at ${bar}`, ch: ch.forceAt, s: S.force }, { label: `Bar speed at ${bar}`, ch: ch.vAt, s: S.speed }] : []),
    { label: "L*, % of max", ch: ch.lstar, s: S.lstar },
    { label: "L* as a bar weight", ch: ch.lstarLb, s: S.lstarLb },
  ];

  const basis = { e: noiseBasis(c.noise.earlier), l: noiseBasis(c.noise.later) };
  const days = basis.e.days + basis.l.days;
  const unsized = basis.e.none + basis.l.none > 0;
  const real = (x: Change) => x.verdict === "real";
  const fPct =
    ch.forceAt.delta != null && ch.forceAt.before ? (ch.forceAt.delta / ch.forceAt.before) * 100 : null;
  // Split the change in L* as a bar weight into the max moving and L* itself moving.
  const fromMax = ch.lstar.before != null ? (ch.lstar.before * c.e1rm.delta) / 100 : null;
  const fromLstar = ch.lstar.delta != null ? (ch.lstar.delta * c.e1rm.after) / 100 : null;

  const verdictWords = (x: Change, s: Shown) =>
    x.verdict === "real"
      ? "That's bigger than the noise."
      : x.verdict === "noise"
        ? `That's inside the noise: these two probes can't resolve a change smaller than about ${s.mag(x.band)}.`
        : "There's no noise band for it, so it can't be called either way.";

  return (
    <>
      <div className="field" style={{ maxWidth: 520 }}>
        <label htmlFor="cmp-pick">Compare your {probeWhen(viewed)} probe with</label>
        <select id="cmp-pick" value={other.id} onChange={(e) => setOtherId(e.target.value)}>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {LIFTS[s.probe.lift].name}, {probeWhen(s)}
            </option>
          ))}
        </select>
      </div>
      <p className="lede">
        {LIFTS[late.probe.lift].name}, {labels.earlier} to {labels.later}. Your entered max went from{" "}
        {wt(c.e1rm.before, unit)} to {wt(c.e1rm.after, unit)}.
        {c.lineChanged || c.mvtChanged
          ? ` The earlier probe used ${c.lineChanged ? `a ${early.probe.recruitLine}% line` : ""}${c.lineChanged && c.mvtChanged ? " and " : ""}${c.mvtChanged ? `an MVT of ${fmt(early.probe.mvt, 2)} m/s` : ""}; both are read against the newer settings here.`
          : ""}
      </p>

      <div className="readings readings-quad">
        {headline.map((h) => (
          <div key={h.label} className="reading">
            <div className="reading-label">{h.label}</div>
            <div className="reading-value">{h.s.value(h.ch.after)}</div>
            <div className="reading-note">
              Was {h.s.value(h.ch.before)}, {h.s.delta(h.ch.delta)}
            </div>
            <Verdict ch={h.ch} mag={h.s.mag} />
          </div>
        ))}
      </div>
      <p className="small muted">
        Noise bands are 95% ranges on each change, sized from how much your repeated singles at each load disagree
        {days === 0
          ? ". Neither probe repeated a load on a second day, so that spread comes from within a session; day-to-day noise is usually larger."
          : ": across days where you repeated a load, within a session elsewhere."}
        {unsized ? " Readings without a band rest on loads with a single rep each." : ""}
      </p>

      <Says>
        {bar && ch.forceAt.delta != null && (
          <p>
            At {bar}, peak force went from {S.force.value(ch.forceAt.before)} to {S.force.value(ch.forceAt.after)}
            {fPct != null ? ` (${signed(fPct, 1)}%)` : ""}. {verdictWords(ch.forceAt, S.force)}
            {ch.vAt.delta != null && (
              <>
                {" "}
                Fresh bar speed at that weight went from {ms(ch.vAt.before)} to {ms(ch.vAt.after)}:{" "}
                {ch.vAt.verdict === "real" ? "bigger than the noise" : ch.vAt.verdict === "noise" ? "inside the noise" : "no noise band"}.
              </>
            )}
          </p>
        )}
        {ch.lstar.delta != null && (
          <p>
            L* moved from {pct(ch.lstar.before)} to {pct(ch.lstar.after)} of your max ({S.lstar.delta(ch.lstar.delta)}).{" "}
            {verdictWords(ch.lstar, S.lstar)}
            {c.e1rm.delta !== 0 && fromMax != null && fromLstar != null && ch.lstarLb.delta != null && (
              <>
                {" "}
                As a bar weight it went from {wt(ch.lstarLb.before, unit)} to {wt(ch.lstarLb.after, unit)}:{" "}
                {S.lstarLb.delta(fromMax)} from your max moving and {S.lstarLb.delta(fromLstar)} from L* itself.
              </>
            )}
          </p>
        )}
        <p>
          {real(ch.lstar)
            ? "L* has shifted by more than the noise, so your session bands have moved with it. Train from the newer probe's bands."
            : real(ch.forceAt) || real(ch.vAt)
              ? `${
                  real(ch.forceAt)
                    ? `You're making ${ch.forceAt.delta! > 0 ? "more" : "less"} force at the same bar`
                    : `Your bar speed at the same weight is ${ch.vAt.delta! > 0 ? "up" : "down"}`
                } by more than the noise, but L* hasn't moved beyond its own. The newer probe is still your best estimate of where you are; its bands are below.`
              : "Nothing here moved more than the noise. That doesn't prove nothing changed; it means these two probes can't show it. Repeating each load on a second day (round 2) narrows the band."}
        </p>
      </Says>

      <CompareForceChart earlier={c.earlier} later={c.later} noise={c.noise} barLb={barLb} unit={unit} labels={labels} />
      <CompareEIChart earlier={c.earlier} later={c.later} labels={labels} />

      <section className="stack" aria-labelledby="cmp-bands-h">
        <h2 id="cmp-bands-h" style={{ fontSize: 26 }}>
          What changes in your sessions
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Band</th>
                <th>{labels.earlier}</th>
                <th>{labels.later}</th>
              </tr>
            </thead>
            <tbody>
              {c.bands.map((b) => (
                <tr key={b.label}>
                  <td className="band-name">{b.label}</td>
                  <td>{b.before ? `${wtRange(b.before.loLb, b.before.hiLb, unit)}, stop ${ms(b.before.stop)}` : "–"}</td>
                  <td>
                    <strong>{b.after ? wtRange(b.after.loLb, b.after.hiLb, unit) : "–"}</strong>
                    {b.after ? `, stop ${ms(b.after.stop)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="cmp-all-h">
        <h2 id="cmp-all-h" style={{ fontSize: 26 }}>
          Every reading
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reading</th>
                <th>Before</th>
                <th>Now</th>
                <th>Change</th>
                <th>95% noise</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["L*, % of max", ch.lstar, S.lstar],
                  ["L* as a bar weight", ch.lstarLb, S.lstarLb],
                  ["Force–Load slope", ch.slope, S.slope],
                  ...(bar
                    ? ([
                        [`Multiple at ${bar}`, ch.multAt, S.mult],
                        [`Peak force at ${bar}`, ch.forceAt, S.force],
                        [`Bar speed at ${bar}`, ch.vAt, S.speed],
                      ] as Array<[string, Change, Shown]>)
                    : []),
                  ["e1RM from bar speed", ch.velE1rm, { ...S.lstarLb }],
                  ["Drive ceiling α (modeled)", ch.alpha, S.alpha],
                  ["Compression β", ch.beta, S.beta],
                ] as Array<[string, Change, Shown]>
              ).map(([label, x, s]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{s.value(x.before)}</td>
                  <td>{s.value(x.after)}</td>
                  <td>{s.delta(x.delta)}</td>
                  <td>
                    {x.band != null ? `±${s.mag(x.band)}` : "–"}
                    {x.verdict === "real" ? " (real)" : ""}
                  </td>
                </tr>
              ))}
              <tr>
                <td>e1RM you entered</td>
                <td>{wt(c.e1rm.before, unit)}</td>
                <td>{wt(c.e1rm.after, unit)}</td>
                <td>{S.e1rm.delta(c.e1rm.delta)}</td>
                <td>an input, not a reading</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <QualCard id="compare" />
    </>
  );
}
