import { describe, expect, it } from "vitest";
import { analyze, type Probe } from "./analyze";
import { compareProbes, noiseBasis, pointNoise, READOUT_KEYS } from "./compare";
import { EXAMPLE_PROBE } from "./example";

const scaled = (p: Probe, k: number): Probe => ({ ...p, reps: p.reps.map((r) => ({ ...r, forceN: r.forceN * k })) });

describe("noise per load", () => {
  const a = analyze(EXAMPLE_PROBE);
  const n = pointNoise(EXAMPLE_PROBE, a.loadPoints);

  it("sizes every load of the example from its own repeats", () => {
    expect(n).toHaveLength(4);
    expect(n.every((p) => p.seMult != null && p.seMult > 0)).toBe(true);
    expect(noiseBasis(n).borrowed + noiseBasis(n).none).toBe(0);
  });

  it("takes the larger spread at 80%, where two days agree exactly but the singles don't", () => {
    // Rounds 2 and 3 both topped out at a 1.236 Multiple, so the day-to-day
    // spread is zero; the within-session spread of the singles is not.
    const p80 = n.find((p) => p.key === "t80")!;
    expect(p80.rounds).toBe(2);
    expect(p80.source).toBe("session");
    expect(p80.sdMult!).toBeGreaterThan(0.01);
    expect(p80.seMult!).toBeCloseTo(p80.sdMult! / Math.SQRT2, 12);
  });

  it("has no noise to give when every load is a single rep", () => {
    const ladder = EXAMPLE_PROBE.reps.filter((r) => r.phase === "ladder" && r.round === 2);
    const probe: Probe = { ...EXAMPLE_PROBE, reps: [...new Map(ladder.map((r) => [r.target, r])).values()] };
    expect(probe.reps).toHaveLength(4);
    const noise = pointNoise(probe, analyze(probe).loadPoints);
    expect(noise.every((p) => p.seMult == null && p.source == null)).toBe(true);
    const c = compareProbes(probe, scaled(probe, 1.06));
    expect(c.changes.forceAt.verdict).toBe("unknown");
  });
});

describe("comparing two probes", () => {
  it("finds nothing when a probe is compared with itself", () => {
    const c = compareProbes(EXAMPLE_PROBE, EXAMPLE_PROBE);
    for (const k of READOUT_KEYS) {
      const ch = c.changes[k];
      if (ch.delta == null) continue;
      expect(ch.delta).toBeCloseTo(0, 12);
      if (ch.band != null) expect(ch.verdict).toBe("noise");
    }
    expect(c.changes.lstar.band).not.toBeNull();
    expect(c.changes.lstar.band!).toBeGreaterThan(0);
  });

  it("calls a 6% gain in force real, and moves L* lighter", () => {
    const c = compareProbes(EXAMPLE_PROBE, scaled(EXAMPLE_PROBE, 1.06));
    expect(c.changes.forceAt.delta! / c.changes.forceAt.before!).toBeCloseTo(0.06, 6);
    expect(c.changes.forceAt.verdict).toBe("real");
    expect(c.changes.lstar.delta!).toBeLessThan(0);
  });

  it("leaves force and speed at a fixed bar alone when only the entered max changes", () => {
    const c = compareProbes(EXAMPLE_PROBE, { ...EXAMPLE_PROBE, e1rm: 380 });
    expect(c.changes.forceAt.delta!).toBeCloseTo(0, 9);
    expect(c.changes.vAt.delta!).toBeCloseTo(0, 9);
    // The recruitment line is a share of the max, so a bigger max lifts L* as a bar weight.
    expect(c.changes.lstarLb.delta!).toBeGreaterThan(0);
    expect(c.e1rm.delta).toBe(15);
  });

  it("reads the earlier probe against the later probe's line and MVT", () => {
    const c = compareProbes({ ...EXAMPLE_PROBE, recruitLine: 80, mvt: 0.2 }, EXAMPLE_PROBE);
    expect(c.lineChanged).toBe(true);
    expect(c.mvtChanged).toBe(true);
    expect(c.earlier.probe.recruitLine).toBe(85);
    expect(c.changes.lstar.before).toBeCloseTo(analyze(EXAMPLE_PROBE).lstar!, 12);
    expect(c.changes.lstar.delta).toBeCloseTo(0, 12);
  });

  it("reads force and speed at a bar both probes lifted", () => {
    const c = compareProbes(EXAMPLE_PROBE, { ...EXAMPLE_PROBE, e1rm: 380 });
    expect(c.barLb).not.toBeNull();
    expect(c.barLb!).toBeGreaterThanOrEqual(210);
    expect(c.barLb!).toBeLessThanOrEqual(315);
  });

  it("gives the same noise bands every time", () => {
    const a = compareProbes(EXAMPLE_PROBE, scaled(EXAMPLE_PROBE, 1.02));
    const b = compareProbes(EXAMPLE_PROBE, scaled(EXAMPLE_PROBE, 1.02));
    expect(a.changes.lstar.band).toBe(b.changes.lstar.band);
    expect(a.changes.forceAt.band).toBe(b.changes.forceAt.band);
  });

  it("matches bands by name across probes", () => {
    const c = compareProbes(EXAMPLE_PROBE, scaled(EXAMPLE_PROBE, 1.06));
    expect(c.bands.map((b) => b.label)).toEqual(["Speed", "Entry strength", "Primary strength", "Heavy strength", "Max strength"]);
    expect(c.bands.every((b) => b.before && b.after)).toBe(true);
  });
});
