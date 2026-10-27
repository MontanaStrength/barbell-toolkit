import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Label,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { N_TO_LBF, POPULATION_FL } from "../engine/constants";
import type { Analysis, DecaySet } from "../engine/analyze";
import type { PointNoise } from "../engine/compare";
import { toUnit, wt, type Unit } from "../format";

// Recharts takes colours as props; CSS variables keep them in step with the theme.
const C = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  rule: "var(--rule)",
  steel: "var(--steel)",
  signal: "var(--signal)",
  velocity: "var(--velocity)",
  surface: "var(--surface)",
};

const tick = { fill: C.ink2, fontSize: 13, fontFamily: "var(--font-body)" };
const axisLabel = { fill: C.ink2, fontSize: 13, fontFamily: "var(--font-body)" };
const tooltipStyle = {
  contentStyle: {
    background: C.surface,
    border: `1px solid ${C.rule}`,
    borderRadius: 6,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: C.ink,
  },
  labelStyle: { color: C.ink2 },
  itemStyle: { color: C.ink },
};

function loadDomain(a: Analysis): [number, number] {
  const loads = a.points.map((p) => p.load);
  const lo = Math.min(50, ...loads.map((l) => Math.floor((l - 4) / 5) * 5));
  const hi = Math.max(95, ...loads.map((l) => Math.ceil((l + 4) / 5) * 5));
  return [lo, hi];
}

const range = (lo: number, hi: number, step = 1) => {
  const out: number[] = [];
  for (let x = lo; x <= hi + 1e-9; x += step) out.push(+x.toFixed(4));
  return out;
};

// Recharts only recognises axes that are its direct children, so this returns
// the element rather than being used as a component.
function loadAxis(domain: [number, number]) {
  return (
    <XAxis
      type="number"
      dataKey="load"
      domain={domain}
      tick={tick}
      tickLine={false}
      axisLine={{ stroke: C.rule }}
      ticks={range(domain[0], domain[1], 10)}
      allowDuplicatedCategory={false}
    >
      <Label value="Load, % of e1RM" position="insideBottom" offset={-14} style={axisLabel} />
    </XAxis>
  );
}

const margin = { top: 16, right: 16, bottom: 28, left: 8 };

export function ForceLoadChart({ a }: { a: Analysis }) {
  const domain = loadDomain(a);
  const xs = range(domain[0], domain[1], 1);
  const fit = a.fl.m != null && a.fl.b != null ? xs.map((L) => ({ load: L, fit: a.fl.m! * L + a.fl.b! })) : [];
  const pop = xs.map((L) => ({ load: L, pop: POPULATION_FL.m * L + POPULATION_FL.b }));
  const pts = a.points.map((p) => ({ load: +p.load.toFixed(1), mult: +p.mult.toFixed(3) }));
  return (
    <>
      <div className="chart-frame" role="img" aria-label="Multiple against load, with the fitted line and the population line">
        <ResponsiveContainer>
          <ComposedChart margin={margin}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            {loadAxis(domain)}
            <YAxis type="number" domain={["auto", "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={48} tickFormatter={(v: number) => `${v.toFixed(2)}×`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(3)}×`} labelFormatter={(l: number) => `${l}% of e1RM`} />
            <Line data={pop} dataKey="pop" name="Population" stroke={C.steel} strokeDasharray="1 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line data={fit} dataKey="fit" name="Your fit" stroke={C.steel} strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={pts} dataKey="mult" name="Fresh Multiple" fill={C.ink} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch swatch-dot" /> Fresh Multiple at each load</span>
        <span><i className="swatch swatch-dash" /> Your line</span>
        <span><i className="swatch swatch-dot-line" /> Population line</span>
      </div>
    </>
  );
}

export function DriveChart({ a }: { a: Analysis }) {
  const domain = loadDomain(a);
  const pts = a.points.map((p) => ({ load: +p.load.toFixed(1), surplus: +p.surplus.toFixed(1) }));
  const curve = a.driveCurve.filter((d) => d.load >= domain[0] && d.load <= domain[1]);
  return (
    <>
      <div className="chart-frame" role="img" aria-label="Surplus force against load, with the fitted compression curve">
        <ResponsiveContainer>
          <ComposedChart margin={margin}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            {loadAxis(domain)}
            <YAxis type="number" domain={[0, "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={48} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} labelFormatter={(l: number) => `${l}% of e1RM`} />
            <Line data={curve} dataKey="fit" name="Compression curve" stroke={C.steel} strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={pts} dataKey="surplus" name="Surplus" fill={C.ink} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch swatch-dot" /> Measured surplus</span>
        <span><i className="swatch swatch-dash" /> Fitted compression curve</span>
      </div>
    </>
  );
}

export function EIChart({ a, compact = false }: { a: Analysis; compact?: boolean }) {
  const domain = loadDomain(a);
  const xs = range(domain[0], domain[1], 1);
  const curve =
    a.fl.m != null && a.fl.b != null ? xs.map((L) => ({ load: L, ei: (a.fl.m! * L + a.fl.b!) * L })) : [];
  const pts = a.points.map((p) => ({ load: +p.load.toFixed(1), ei: +p.ei.toFixed(1) }));
  const line = a.probe.recruitLine;
  return (
    <>
      <div className={compact ? "chart-frame chart-frame-short" : "chart-frame"} role="img" aria-label={`Effective Intensity against load. It crosses the ${line}% line at L* = ${a.lstar?.toFixed(1)}% of e1RM.`}>
        <ResponsiveContainer>
          <ComposedChart margin={margin}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            {loadAxis(domain)}
            <YAxis type="number" domain={[60, "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={48} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}% EI`} labelFormatter={(l: number) => `${l}% of e1RM`} />
            <ReferenceLine y={line} stroke={C.signal} strokeWidth={2.5} ifOverflow="extendDomain">
              <Label value={`Recruitment line, ${line}%`} position="insideTopRight" offset={8} style={{ ...axisLabel, fill: C.signal, fontWeight: 600 }} />
            </ReferenceLine>
            {a.lstar != null && (
              <ReferenceLine x={+a.lstar.toFixed(1)} stroke={C.signal} strokeDasharray="4 4" strokeWidth={1.5}>
                <Label value={`L* ${a.lstar.toFixed(1)}%`} position="insideTopRight" offset={8} style={{ ...axisLabel, fill: C.signal, fontWeight: 600 }} />
              </ReferenceLine>
            )}
            <Line data={curve} dataKey="ei" name="From your line" stroke={C.steel} strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={pts} dataKey="ei" name="Effective Intensity" fill={C.ink} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <div className="legend">
          <span><i className="swatch swatch-dot" /> Effective Intensity at each load</span>
          <span><i className="swatch swatch-dash" /> From your Force–Load line</span>
          <span><i className="swatch swatch-signal" /> Recruitment line</span>
        </div>
      )}
    </>
  );
}

export function DecayChart({ set }: { set: DecaySet }) {
  const data = set.reps.map((r) => ({ rep: r.rep, surplus: +r.surplus.toFixed(1), meanV: r.meanV }));
  return (
    <>
      <div className="chart-frame" role="img" aria-label="Surplus force and mean velocity rep by rep through one all-out set">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ ...margin, right: 8 }}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            <XAxis dataKey="rep" type="number" domain={[1, "dataMax"]} allowDecimals={false} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} ticks={data.map((d) => d.rep)}>
              <Label value="Rep" position="insideBottom" offset={-14} style={axisLabel} />
            </XAxis>
            <YAxis yAxisId="s" domain={[0, "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={44} tickFormatter={(v: number) => `${v}%`} />
            <YAxis yAxisId="v" orientation="right" domain={[0, "auto"]} tick={{ ...tick, fill: C.velocity }} tickLine={false} axisLine={{ stroke: C.rule }} width={44} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip {...tooltipStyle} labelFormatter={(l: number) => `Rep ${l}`} formatter={(v: number, n: string) => (n === "Mean velocity" ? `${v.toFixed(2)} m/s` : `${v.toFixed(1)}%`)} />
            <Line yAxisId="s" dataKey="surplus" name="Surplus" stroke={C.ink} strokeWidth={2} dot={{ r: 3.5, fill: C.ink, strokeWidth: 0 }} isAnimationActive={false} />
            <Line yAxisId="v" dataKey="meanV" name="Mean velocity" stroke={C.velocity} strokeWidth={2} dot={{ r: 3, fill: C.velocity, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch" /> Surplus force, left axis</span>
        <span><i className="swatch swatch-velocity" /> Mean velocity (m/s), right axis</span>
      </div>
    </>
  );
}

export function ReliabilityChart({ a }: { a: Analysis }) {
  const domain = loadDomain(a);
  const clean: Array<{ load: number; mult: number }> = [];
  const openers: Array<{ load: number; mult: number }> = [];
  for (const p of a.loadPoints) {
    for (const r of p.rounds) {
      (r.clean ? clean : openers).push({ load: +p.load.toFixed(1), mult: +r.mult.toFixed(3) });
    }
  }
  return (
    <>
      <div className="chart-frame chart-frame-short" role="img" aria-label="Fresh Multiple by load for each probe round">
        <ResponsiveContainer>
          <ComposedChart margin={margin}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            {loadAxis(domain)}
            <YAxis type="number" domain={["auto", "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={48} tickFormatter={(v: number) => `${v.toFixed(2)}×`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(3)}×`} labelFormatter={(l: number) => `${l}% of e1RM`} />
            <Scatter data={openers} dataKey="mult" name="AMRAP opener" fill="transparent" stroke={C.steel} strokeWidth={2} isAnimationActive={false} />
            <Scatter data={clean} dataKey="mult" name="Ladder round" fill={C.ink} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch swatch-dot" /> Ladder round (counts toward the profile)</span>
        <span><i className="swatch swatch-ring" /> AMRAP opener (shown, not counted)</span>
      </div>
    </>
  );
}

// ---------- comparing two probes ----------

const niceDomain = (lo: number, hi: number, step: number): [number, number] => [
  Math.floor(lo / step) * step,
  Math.ceil(hi / step) * step,
];

/**
 * Peak force against bar weight for two probes. This is the direct reading:
 * it doesn't depend on the e1RM entered for either probe. Error bars are each
 * load's 95% noise.
 */
export function CompareForceChart({
  earlier,
  later,
  noise,
  barLb,
  unit,
  labels,
}: {
  earlier: Analysis;
  later: Analysis;
  noise: { earlier: PointNoise[]; later: PointNoise[] };
  barLb: number | null;
  unit: Unit;
  labels: { earlier: string; later: string };
}) {
  const toX = (lb: number) => +toUnit(lb, unit).toFixed(1);
  const toF = (lbf: number) => +(unit === "kg" ? lbf / N_TO_LBF : lbf).toFixed(1);
  const curve = (a: Analysis) => {
    if (a.fl.m == null || a.fl.b == null || !a.loadPoints.length) return [];
    const lbs = a.loadPoints.map((p) => p.lb);
    const lo = Math.min(...lbs);
    const hi = Math.max(...lbs);
    return Array.from({ length: 31 }, (_, i) => {
      const W = lo + ((hi - lo) * i) / 30;
      return { x: toX(W), f: toF((a.fl.m! * ((W / a.probe.e1rm) * 100) + a.fl.b!) * W) };
    });
  };
  const pts = (n: PointNoise[]) =>
    n.map((p) => ({ x: toX(p.lb), f: toF(p.mult * p.lb), err: p.seMult != null ? toF(1.96 * p.seMult * p.lb) : 0 }));
  const all = [...noise.earlier, ...noise.later].map((p) => toX(p.lb));
  const step = unit === "kg" ? 10 : 20;
  const domain = all.length ? niceDomain(Math.min(...all) - step / 2, Math.max(...all) + step / 2, step) : ([0, 1] as [number, number]);
  const fUnit = unit === "kg" ? "N" : "lbf";
  return (
    <>
      <div className="chart-frame" role="img" aria-label={`Peak force against bar weight for ${labels.earlier} and ${labels.later}`}>
        <ResponsiveContainer>
          <ComposedChart margin={{ ...margin, left: 16 }}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            <XAxis type="number" dataKey="x" domain={domain} ticks={range(domain[0], domain[1], step)} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} allowDuplicatedCategory={false}>
              <Label value={`Bar weight, ${unit}`} position="insideBottom" offset={-14} style={axisLabel} />
            </XAxis>
            <YAxis type="number" domain={["auto", "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={52}>
              <Label value={`Peak force, ${fUnit}`} angle={-90} position="insideLeft" offset={-6} style={{ ...axisLabel, textAnchor: "middle" }} />
            </YAxis>
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${Math.round(v)} ${fUnit}`} labelFormatter={(l: number) => `${l} ${unit}`} />
            {barLb != null && (
              <ReferenceLine x={toX(barLb)} stroke={C.ink2} strokeDasharray="2 3">
                <Label value={wt(barLb, unit)} position="insideTopLeft" offset={8} style={{ ...axisLabel, fontWeight: 600 }} />
              </ReferenceLine>
            )}
            <Line data={curve(earlier)} dataKey="f" name={labels.earlier} stroke={C.steel} strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line data={curve(later)} dataKey="f" name={labels.later} stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={pts(noise.earlier)} dataKey="f" name={labels.earlier} fill={C.surface} stroke={C.steel} strokeWidth={2} isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="y" width={6} strokeWidth={1.5} stroke={C.steel} />
            </Scatter>
            <Scatter data={pts(noise.later)} dataKey="f" name={labels.later} fill={C.ink} isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="y" width={6} strokeWidth={1.5} stroke={C.ink} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch swatch-dot" /> {labels.later}</span>
        <span><i className="swatch swatch-ring" /> {labels.earlier}</span>
        <span><i className="swatch swatch-error" /> 95% noise at each load</span>
      </div>
    </>
  );
}

/** Effective Intensity for two probes against the recruitment line, with both L* markers. */
export function CompareEIChart({
  earlier,
  later,
  labels,
}: {
  earlier: Analysis;
  later: Analysis;
  labels: { earlier: string; later: string };
}) {
  const dA = loadDomain(earlier);
  const dB = loadDomain(later);
  const domain: [number, number] = [Math.min(dA[0], dB[0]), Math.max(dA[1], dB[1])];
  const xs = range(domain[0], domain[1], 1);
  const curve = (a: Analysis) =>
    a.fl.m != null && a.fl.b != null ? xs.map((L) => ({ load: L, ei: +((a.fl.m! * L + a.fl.b!) * L).toFixed(2) })) : [];
  const pts = (a: Analysis) => a.points.map((p) => ({ load: +p.load.toFixed(1), ei: +p.ei.toFixed(1) }));
  const line = later.probe.recruitLine;
  const lA = earlier.lstar;
  const lB = later.lstar;
  // Each L* label sits on its outer side so the two never overlap.
  const leftIsEarlier = lA != null && lB != null ? lA <= lB : true;
  return (
    <>
      <div
        className="chart-frame"
        role="img"
        aria-label={`Effective Intensity against load for both probes. L* was ${lA?.toFixed(1)}% and is now ${lB?.toFixed(1)}% of e1RM.`}
      >
        <ResponsiveContainer>
          <ComposedChart margin={margin}>
            <CartesianGrid stroke={C.rule} strokeDasharray="2 4" />
            {loadAxis(domain)}
            <YAxis type="number" domain={[60, "auto"]} tick={tick} tickLine={false} axisLine={{ stroke: C.rule }} width={48} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}% EI`} labelFormatter={(l: number) => `${l}% of e1RM`} />
            <ReferenceLine y={line} stroke={C.signal} strokeWidth={2.5} ifOverflow="extendDomain">
              <Label value={`Recruitment line, ${line}%`} position="insideTopRight" offset={8} style={{ ...axisLabel, fill: C.signal, fontWeight: 600 }} />
            </ReferenceLine>
            {lA != null && (
              <ReferenceLine x={+lA.toFixed(1)} stroke={C.steel} strokeDasharray="4 4" strokeWidth={1.5}>
                <Label value={`was ${lA.toFixed(1)}%`} position={leftIsEarlier ? "insideTopRight" : "insideTopLeft"} offset={8} style={{ ...axisLabel, fontWeight: 600 }} />
              </ReferenceLine>
            )}
            {lB != null && (
              <ReferenceLine x={+lB.toFixed(1)} stroke={C.signal} strokeDasharray="4 4" strokeWidth={1.5}>
                <Label value={`L* ${lB.toFixed(1)}%`} position={leftIsEarlier ? "insideTopLeft" : "insideTopRight"} offset={8} style={{ ...axisLabel, fill: C.signal, fontWeight: 600 }} />
              </ReferenceLine>
            )}
            <Line data={curve(earlier)} dataKey="ei" name={labels.earlier} stroke={C.steel} strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line data={curve(later)} dataKey="ei" name={labels.later} stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter data={pts(earlier)} dataKey="ei" name={labels.earlier} fill={C.surface} stroke={C.steel} strokeWidth={2} isAnimationActive={false} />
            <Scatter data={pts(later)} dataKey="ei" name={labels.later} fill={C.ink} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i className="swatch swatch-dot" /> {labels.later}</span>
        <span><i className="swatch swatch-ring" /> {labels.earlier}</span>
        <span><i className="swatch swatch-signal" /> Recruitment line</span>
      </div>
    </>
  );
}
