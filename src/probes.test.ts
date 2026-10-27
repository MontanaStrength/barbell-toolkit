import { describe, expect, it } from "vitest";
import { EXAMPLE_PROBE } from "./engine/example";
import { fmtSpan, signed } from "./format";
import { addProbe, byDateDesc, parseBook, probeWhen, removeProbe, updateCurrent } from "./probes";

describe("probe history", () => {
  it("migrates the old single probe, dated by its first rep", () => {
    const b = parseBook(null, JSON.stringify(EXAMPLE_PROBE));
    expect(b.probes).toHaveLength(1);
    expect(b.current).toBe(b.probes[0].id);
    expect(b.probes[0].created).toBe("2026-05-29");
    expect(b.probes[0].probe.reps).toHaveLength(EXAMPLE_PROBE.reps.length);
    expect(probeWhen(b.probes[0])).toBe("May 29 – Jun 22, 2026");
  });

  it("prefers the new format, and repairs a missing current probe", () => {
    const raw = JSON.stringify({ current: "gone", probes: [{ id: "a", created: "2026-10-01", probe: EXAMPLE_PROBE }] });
    const b = parseBook(raw, JSON.stringify({ ...EXAMPLE_PROBE, e1rm: 1 }));
    expect(b.current).toBe("a");
    expect(b.probes[0].probe.e1rm).toBe(365);
  });

  it("starts empty on corrupt storage", () => {
    const b = parseBook("{not json", "also not json");
    expect(b.probes).toHaveLength(1);
    expect(b.probes[0].probe.reps).toHaveLength(0);
  });

  it("starts a new probe with the same lift and settings, keeping the old one", () => {
    const b0 = parseBook(null, JSON.stringify(EXAMPLE_PROBE));
    const b1 = addProbe(b0);
    expect(b1.probes).toHaveLength(2);
    expect(b1.current).not.toBe(b0.current);
    const fresh = b1.probes.find((s) => s.id === b1.current)!.probe;
    expect(fresh).toMatchObject({ lift: "bench", e1rm: 365, mvt: 0.15, recruitLine: 85, reps: [] });
    // Logging goes to the new probe only.
    const b2 = updateCurrent(b1, (p) => ({ ...p, e1rm: 380 }));
    expect(b2.probes.find((s) => s.id === b0.current)!.probe.e1rm).toBe(365);
  });

  it("falls back to the newest remaining probe when the current one is deleted", () => {
    const b1 = addProbe(parseBook(null, JSON.stringify(EXAMPLE_PROBE)));
    const b2 = removeProbe(b1, b1.current);
    expect(b2.probes).toHaveLength(1);
    expect(b2.current).toBe(b2.probes[0].id);
    const b3 = removeProbe(b2, b2.current);
    expect(b3.probes).toHaveLength(1);
    expect(b3.probes[0].probe.reps).toHaveLength(0);
  });

  it("orders probes newest first by their last logged day", () => {
    const old = { id: "o", created: "2026-01-01", probe: EXAMPLE_PROBE };
    const fresh = { id: "n", created: "2026-10-20", probe: { ...EXAMPLE_PROBE, reps: [] } };
    expect([old, fresh].sort(byDateDesc).map((s) => s.id)).toEqual(["n", "o"]);
  });
});

describe("dates and signs", () => {
  it("writes date ranges as short as they can be", () => {
    expect(fmtSpan("2026-06-06", "2026-06-06")).toBe("Jun 6, 2026");
    expect(fmtSpan("2026-06-06", "2026-06-22")).toBe("Jun 6–22, 2026");
    expect(fmtSpan("2026-05-29", "2026-06-25")).toBe("May 29 – Jun 25, 2026");
    expect(fmtSpan("2025-12-28", "2026-01-03")).toBe("Dec 28, 2025 – Jan 3, 2026");
  });
  it("signs changes with a true minus and drops the sign at zero", () => {
    expect(signed(2.44)).toBe("+2.4");
    expect(signed(-0.0123, 3)).toBe("−0.012");
    expect(signed(0.004)).toBe("0.0");
  });
});
