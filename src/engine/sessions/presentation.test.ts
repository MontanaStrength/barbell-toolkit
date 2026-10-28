import { describe, expect, it } from "vitest";
import {
  effortInstruction,
  gymCardText,
  projectedEffortText,
  repsLabel,
  thenLabel,
  type GymCardOptions,
} from "./presentation";
import type { WorkspaceSet } from "./workspace";
import { LB_PER_KG } from "../../weights";

const set = (more: Partial<WorkspaceSet> = {}): WorkspaceSet => ({
  id: "one",
  n: 1,
  group: "Work",
  pct: 75,
  requestedPct: 75,
  loadLb: 275,
  reps: { kind: "fixed", n: 4 },
  rpe: 7,
  next: 180,
  recoverySeconds: 180,
  fresh: null,
  stopV: null,
  single: false,
  road: null,
  ...more,
});
const card = (more: Partial<GymCardOptions> = {}): GymCardOptions => ({
  name: "Custom session",
  liftName: "Bench press",
  e1rm: 365,
  unit: "lb",
  sets: [set()],
  rules: [],
  rulesLabel: "Execution rules:",
  warnings: [],
  summary: "4 planned reps",
  ...more,
});

describe("session presentation preserves the prescription", () => {
  it("distinguishes zero recovery from the final set", () => {
    expect(thenLabel(set({ next: 0 }), false)).toBe("No rest");
    expect(thenLabel(set({ next: 0, clock: true }), false)).toBe(
      "Start next immediately",
    );
    expect(thenLabel(set({ next: 180 }), true)).toBe("Finish");
    expect(thenLabel(set({ next: 180 }), false)).toBe("Rest 3:00");
    expect(thenLabel(set({ next: 90, clock: true }), false)).toBe(
      "Start every 1:30",
    );
    expect(thenLabel(set({ next: 20.5 }), false)).toBe("Rest 20.5s");
  });

  it("always states an effort stop without requiring measured speed", () => {
    expect(effortInstruction(set({ rpe: 8, ceiling: true }))).toBe(
      "RPE ceiling 8",
    );
    expect(
      effortInstruction(set({ rpe: 8, reps: { kind: "toStop", about: 10 } })),
    ).toBe("Stop at RPE 8");
    expect(
      effortInstruction(set({ rpe: 7.5, reps: { kind: "upTo", n: 4 } })),
    ).toBe("Stop at RPE 7.5");
    expect(effortInstruction(set({ rpe: 6.5 }))).toBe("RPE guide 6.5");
  });

  it("does not manufacture a complete effort range from partial values", () => {
    expect(projectedEffortText([])).toBeNull();
    expect(projectedEffortText([7, null])).toBeNull();
    expect(projectedEffortText([7, NaN])).toBeNull();
    expect(projectedEffortText([8.06, 8.14])).toBe("8.1");
    expect(projectedEffortText([8.1, 8.24])).toBe("8.1–8.2");
    expect(projectedEffortText([10.4])).toBe("10.4");
  });

  it("keeps rep ceilings, estimates, clusters and timed windows explicit", () => {
    expect(repsLabel({ kind: "upTo", n: 4 })).toBe("up to 4");
    expect(repsLabel({ kind: "toStop", about: 8 })).toContain("≈8");
    expect(
      repsLabel({ kind: "cluster", parts: [2, 2, 1], intraRest: 20 }),
    ).toBe("2 + 2 + 1 · 20s inside");
    expect(repsLabel({ kind: "timed", minutes: 12 })).toBe("12 min of work");
  });

  it("exports numeric stops, real row endings and provided rules/warnings verbatim", () => {
    const options = card({
      sets: [
        set({ rpe: 7.5, ceiling: true, next: 0 }),
        set({
          id: "two",
          n: 2,
          rpe: 8,
          reps: { kind: "toStop", about: 8 },
          next: 240,
        }),
      ],
      rules: ["Use the saved 0.42 m/s threshold."],
      rulesLabel: "Saved snapshot rules:",
      warnings: ["Set 1: fixed work exceeds the requested ceiling."],
    });
    const before = JSON.stringify(options);
    const text = gymCardText(options);
    expect(text).toContain("RPE ceiling 7.5. No rest.");
    expect(text).toContain("Stop at RPE 8. Finish.");
    expect(text).not.toContain("Velocity guide");
    expect(text).toContain(
      "Saved snapshot rules:\n• Use the saved 0.42 m/s threshold.",
    );
    expect(text).toContain(
      "• Set 1: fixed work exceeds the requested ceiling.",
    );
    expect(text).toContain("No rest is counted after the final set.");
    expect(JSON.stringify(options)).toBe(before);
  });

  it("exports physical loads at up to two decimals without plate rounding", () => {
    const weight = 123.45 * LB_PER_KG;
    expect(
      gymCardText(card({ unit: "kg", sets: [set({ loadLb: weight })] })),
    ).toContain("@ 123.45 kg");
    expect(gymCardText(card({ sets: [set({ loadLb: 275.25 })] }))).toContain(
      "@ 275.25 lb",
    );
    expect(
      gymCardText(card({ sets: [set({ single: true, stopV: 0.423 })] })),
    ).toContain("Velocity check 0.42 m/s.");
  });
});
