import { describe, expect, it } from "vitest";
import { analyze, buildLoadPoints } from "./analyze";
import { STOP_FRACTION } from "./constants";
import { fromCsv, toCsv } from "./csv";
import { EXAMPLE_PROBE } from "./example";
import { neuralLoad, readRep, stopVelocity } from "./metrics";
import { computeProfile } from "./profile";
import { solveLstar } from "./stats";

// 1. Reference report: bench ladder at a 350 lb e1RM. These numbers were
//    validated by hand before the toolkit existed; the math must keep them.
describe("reference report", () => {
  const ref = computeProfile({
    e1rm: 350,
    mvt: 0.15,
    recruitLine: 85,
    points: [
      { load: 60, mult: 1.4, v: 0.65 },
      { load: 70, mult: 1.281, v: 0.51 },
      { load: 80, mult: 1.216, v: 0.39 },
      { load: 90, mult: 1.161, v: 0.26 },
    ],
  });

  it("reproduces the Force–Load fit", () => {
    expect(ref.fl.m!).toBeCloseTo(-0.00782, 4);
    expect(ref.fl.b!).toBeCloseTo(1.851, 2);
    expect(ref.fl.r2!).toBeCloseTo(0.964, 2);
    expect(ref.cleanSlope!).toBeCloseTo(-0.0119, 3);
  });

  it("reproduces L* and EI", () => {
    expect(Math.abs(ref.lstar! - 62.3)).toBeLessThan(0.3);
    expect(Math.abs(ref.lstarLb! - 218)).toBeLessThan(2);
    expect(Math.abs(ref.eiTop! - 104.5)).toBeLessThan(0.2);
  });

  it("keeps the Hanley neural dose and lands every band in its target", () => {
    expect(neuralLoad(3, 7, 80)).toBeCloseTo(525, 0);
    expect(neuralLoad(3, 10, 80)).toBeCloseTo(750, 0);
    for (const b of ref.bands.filter((b) => b.neural != null)) {
      expect(b.neural!).toBeGreaterThanOrEqual(450);
      expect(b.neural!).toBeLessThanOrEqual(600);
    }
    for (const b of ref.hypBands) {
      expect(b.neural!).toBeGreaterThanOrEqual(350);
      expect(b.neural!).toBeLessThanOrEqual(600);
    }
  });
});

// 2. Parity with the v4 probe-log spreadsheet (Models / Replicates tabs).
describe("v4 spreadsheet parity", () => {
  it("matches the sheet's fresh Multiples on its labelled load axis", () => {
    const pts = buildLoadPoints(EXAMPLE_PROBE, "target");
    expect(pts.map((p) => p.load)).toEqual([60, 70, 80, 90]);
    const want = [1.400245143, 1.280958204, 1.236053554, 1.135468921];
    pts.forEach((p, i) => expect(p.mult).toBeCloseTo(want[i], 6));
  });

  it("matches the sheet's Force–Load fit and L*", () => {
    const a = analyze(EXAMPLE_PROBE, { axis: "target" });
    expect(a.fl.m!).toBeCloseTo(-0.008392333172, 8);
    expect(a.fl.b!).toBeCloseTo(1.892606443, 6);
    expect(a.fl.r2!).toBeCloseTo(0.9741830528, 6);
    expect(a.lstar!).toBeCloseTo(61.90446214, 4);
  });

  it("matches the sheet's decoupling correlations", () => {
    const a = analyze(EXAMPLE_PROBE);
    expect(a.decoupling.corrMean!).toBeCloseTo(0.7444939747, 4);
    expect(a.decoupling.corrPeak!).toBeCloseTo(0.8721566094, 4);
  });

  it("matches the sheet's population L*", () => {
    expect(Math.round(solveLstar(-0.0114, 2.09, 85)!)).toBe(61);
  });
});

// 3. The toolkit's own choices.
describe("toolkit behavior", () => {
  it("plots bar weight as a % of the current e1RM", () => {
    const pts = buildLoadPoints(EXAMPLE_PROBE);
    expect(pts.map((p) => +p.load.toFixed(1))).toEqual([57.5, 67.1, 76.7, 86.3]);
    const a = analyze(EXAMPLE_PROBE);
    expect(a.lstar!).toBeGreaterThan(63);
    expect(a.lstar!).toBeLessThan(64.5);
  });

  it("moves L* with the recruitment line", () => {
    const at85 = analyze(EXAMPLE_PROBE).lstar!;
    const at90 = analyze({ ...EXAMPLE_PROBE, recruitLine: 90 }).lstar!;
    expect(at90).toBeGreaterThan(at85);
  });

  it("scales velocity stops by goal", () => {
    expect(stopVelocity(0.65, 0.15, STOP_FRACTION.power)).toBeCloseTo(0.55, 6);
    expect(stopVelocity(0.65, 0.15, STOP_FRACTION.strength)).toBeCloseTo(0.5, 6);
    expect(stopVelocity(0.65, 0.15, STOP_FRACTION.hypertrophyBelowLstar)).toBeCloseTo(0.35, 6);
    expect(stopVelocity(0.65, 0.15, STOP_FRACTION.hypertrophyAboveLstar)).toBeCloseTo(0.45, 6);
    const a = analyze(EXAMPLE_PROBE);
    const pt = a.stopsAtTested[0];
    expect(pt.power!).toBeGreaterThan(pt.strength!);
    expect(pt.strength!).toBeGreaterThan(pt.hypertrophy!);
  });

  it("takes hypertrophy sets deeper below L* than above it", () => {
    const a = analyze(EXAMPLE_PROBE);
    const [below, above] = a.stopsAtTested; // 57.5% and 67.1%, either side of L* 63.6%
    expect(below.load).toBeLessThan(a.lstar!);
    expect(above.load).toBeGreaterThan(a.lstar!);
    expect(below.hypertrophy!).toBeCloseTo(0.4 * 0.65 + 0.6 * 0.15, 6);
    expect(above.hypertrophy!).toBeCloseTo(0.6 * 0.51 + 0.4 * 0.15, 6);
    const light = a.hypBands[0];
    expect((light.lo + light.hi) / 2).toBeLessThan(a.lstar!);
    expect(light.stop!).toBeCloseTo(0.4 * a.vAt(light.hi)! + 0.6 * 0.15, 6);
  });

  it("reads a single rep", () => {
    const r = readRep(210, 1133, 365)!;
    expect(r.forceLbf).toBeCloseTo(254.71, 2);
    expect(r.multiple).toBeCloseTo(1.2129, 4);
    expect(r.ei!).toBeCloseTo(69.78, 2);
    expect(r.ei!).toBeCloseTo(r.multiple * r.loadPct!, 6);
  });

  it("defaults to the longest AMRAP in the latest round", () => {
    const a = analyze(EXAMPLE_PROBE);
    const s = a.decaySets.find((d) => d.id === a.decayDefault)!;
    expect(s.round).toBe(2);
    expect(s.lb).toBe(210);
    expect(s.reps.length).toBe(15);
  });

  it("round-trips the probe-log CSV", () => {
    const back = fromCsv(toCsv(EXAMPLE_PROBE.reps));
    expect(back.skipped).toBe(0);
    expect(back.reps).toEqual(EXAMPLE_PROBE.reps);
  });

  it("imports the spreadsheet's own column names", () => {
    const csv = "Round,Date,Phase,Load %,Load (lb),Set,Rep,Peak Force (N),Mean Vel,Peak Vel\n2,2026-06-06,ladder,60,210,1,1,1220,0.57,0.71\n2,2026-06-06,workout,60,210,1,1,1220,0.57,0.71\n";
    const r = fromCsv(csv);
    expect(r.reps.length).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.reps[0].lb).toBe(210);
  });
});

describe("which velocity is steadier", () => {
  it("measures rep-to-rep noise of each reading across repeated singles", async () => {
    const { velocityNoise } = await import("./analyze");
    const { EXAMPLE_PROBE } = await import("./example");
    const n = velocityNoise(EXAMPLE_PROBE.reps)!;
    expect(n.loads).toBe(5);
    // On the example probe peak velocity is the steadier reading, by a wide margin.
    expect(n.peak).toBeLessThan(n.mean / 2);
    expect(velocityNoise([])).toBeNull();
  });
});
