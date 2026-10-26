import type { Probe, Rep } from "./analyze";
import raw from "../data/bench-v4.json";

// John's bench press probe, May 29 – June 25, 2026: rounds 1–3 of ladder
// singles and AMRAPs, logged with a Tendo. Workout sets from the same log are
// left out because they aren't part of the protocol.
export const EXAMPLE_REPS: Rep[] = (raw as Array<Record<string, unknown>>).map((r) => ({
  round: r.round as number,
  date: r.date as string,
  phase: r.phase as Rep["phase"],
  target: r.target as number,
  lb: r.lb as number,
  set: r.set as number,
  rep: r.rep as number,
  forceN: r.forceN as number,
  meanV: r.meanV as number,
  peakV: r.peakV as number,
}));

export const EXAMPLE_PROBE: Probe = {
  lift: "bench",
  e1rm: 365,
  mvt: 0.15,
  recruitLine: 85,
  reps: EXAMPLE_REPS,
};

export const EXAMPLE_LABEL = "John's bench press";
