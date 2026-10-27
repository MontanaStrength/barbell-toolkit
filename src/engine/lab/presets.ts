// The 26 session designs rebuilt as blocks of the six shapes, with how close
// each lands. Loads and reps are the toolkit's solver-based defaults; the
// effort on every set now comes from the one shared fatigue model.

import { blankBlock, type Block, type ShapeKey, type Values } from "./sessionLab";

export type Fidelity = "exact" | "close" | "approximate";
export interface Preset {
  key: string;
  name: string;
  /** The family the catalogue filed it under, for reference only. */
  was: "strength" | "hypertrophy";
  blocks: Block[];
  fidelity: Fidelity;
  note: string;
}

const B = (shape: ShapeKey, v: Values): Block => ({ shape, v: { ...blankBlock(shape).v, ...v } });
const rpe = (r: number, cap = 0) => ({ kind: 0, rpe: r, cap });
const drop = { kind: 1 };
const reps = (n: number) => ({ kind: 2, reps: n });
const A = (prefix: "a" | "b", s: Values) => Object.fromEntries(Object.entries(s).map(([k, x]) => [`${prefix}${k[0].toUpperCase()}${k.slice(1)}`, x]));

export const PRESETS: Preset[] = [
  // ----- filed under strength -----
  { key: "strengthPrescriptionTable", name: "Strength Table", was: "strength", fidelity: "exact", note: "Constant load, every set stops at the drop rep.",
    blocks: [B("constant", { load: 82, sets: 5, ...drop, rest: 240 })] },
  { key: "sawtooth", name: "Sawtooth", was: "strength", fidelity: "exact", note: "Interleaved at one load: a practice single, then a perform triple.",
    blocks: [B("interleaved", { pairs: 3, aLoad: 85, ...A("a", reps(1)), aRest: 240, bLoad: 85, ...A("b", reps(3)), bRest: 240 })] },
  { key: "topSetBackoff", name: "Top Set + Back-off", was: "strength", fidelity: "exact", note: "Two constant blocks: one top set, then back-offs 7.5% lighter.",
    blocks: [B("constant", { load: 88, sets: 1, ...reps(3), after: 270 }), B("constant", { load: 81, sets: 3, ...reps(5), rest: 210 })] },
  { key: "pureCluster", name: "Strength Cluster", was: "strength", fidelity: "exact", note: "Clustered singles.",
    blocks: [B("clustered", { load: 87, clusters: 4, minis: 3, ...reps(1), intra: 15, rest: 240 })] },
  { key: "doublePyramid", name: "Double Pyramid", was: "strength", fidelity: "close", note: "An arc on mirrored loads. The solver takes 1.5 points off the way down; here the fatigue model raises the descent's RPE instead.",
    blocks: [B("arc", { low: 84, peak: 90, sets: 5, ...reps(3), rest: 180 })] },
  { key: "singles", name: "Singles", was: "strength", fidelity: "close", note: "Constant singles. The solver's point either side of the load, for feel, is left out; EMOM is the same block on a 1-minute rest.",
    blocks: [B("constant", { load: 88, sets: 5, ...reps(1), rest: 240 })] },
  { key: "rampingSingles", name: "Ramping Singles + Back-off", was: "strength", fidelity: "exact", note: "A rising block of singles, then a constant block of triples.",
    blocks: [B("rising", { from: 75, to: 90, sets: 4, ...reps(1), rest: 120, after: 150 }), B("constant", { load: 78, sets: 3, ...reps(3), rest: 150 })] },
  { key: "threadedSingles", name: "Threaded Singles", was: "strength", fidelity: "exact", note: "Interleaved: moderate fours with a heavy single in each rest.",
    blocks: [B("interleaved", { pairs: 5, aLoad: 77, ...A("a", reps(4)), aRest: 90, bLoad: 88, ...A("b", reps(1)), bRest: 120 })] },
  { key: "routeSwap", name: "Route Swap", was: "strength", fidelity: "exact", note: "Two constant blocks; swap their order for volume first.",
    blocks: [B("constant", { load: 87, sets: 4, ...reps(2), rest: 180, after: 300 }), B("constant", { load: 70, sets: 2, ...rpe(8), rest: 240 })] },
  { key: "recruitmentCrossover", name: "Recruitment Crossover", was: "strength", fidelity: "exact", note: "Three constant blocks: doubles, fours, one finisher to RPE 8.",
    blocks: [B("constant", { load: 83, sets: 2, ...reps(2), rest: 150, after: 150 }), B("constant", { load: 70, sets: 3, ...reps(4), rest: 90, after: 180 }), B("constant", { load: 58, sets: 1, ...rpe(8) })] },
  { key: "boundedDescent", name: "Bounded Descent", was: "strength", fidelity: "approximate", note: "A falling block run twice. One stop rule per block, so the wave's double, triple and low reps become an RPE 7.5 stop capped at three.",
    blocks: [B("falling", { from: 83, to: 70, loads: 3, per: 1, ...rpe(7.5, 3), rest: 90, rounds: 2, after: 180 })] },

  // ----- filed under hypertrophy -----
  { key: "tapered", name: "Tapered Sets", was: "hypertrophy", fidelity: "exact", note: "Two constant blocks at one load. The taper's RPE comes from the shared fatigue model, not a separate 75% rule.",
    blocks: [B("constant", { load: 66, sets: 2, ...reps(10), rest: 90, after: 90 }), B("constant", { load: 66, sets: 3, ...reps(7), rest: 90 })] },
  { key: "ascendingPyramid", name: "Ascending Pyramid", was: "hypertrophy", fidelity: "close", note: "A rising block with effort building to RPE 7.5. Reps follow from load and effort, so they land near 12/10/8/6 rather than on it.",
    blocks: [B("rising", { from: 60, to: 77, sets: 4, ...rpe(7.5), step: 0.5, rest: 120 })] },
  { key: "reversePyramid", name: "Reverse Pyramid", was: "hypertrophy", fidelity: "close", note: "A falling block, heaviest first; reps follow from load and effort.",
    blocks: [B("falling", { from: 77, to: 65, loads: 3, per: 1, ...rpe(7.5), step: 0.25, rest: 150 })] },
  { key: "volumePyramid", name: "Volume Pyramid", was: "hypertrophy", fidelity: "close", note: "An arc of fives on mirrored loads; the descent's RPE comes from fatigue.",
    blocks: [B("arc", { low: 75, peak: 81, sets: 5, ...reps(5), rest: 150 })] },
  { key: "straightSets", name: "Straight Sets", was: "hypertrophy", fidelity: "exact", note: "Constant load and reps; RPE climbs set to set.",
    blocks: [B("constant", { load: 65, sets: 4, ...reps(10), rest: 120 })] },
  { key: "dropSet", name: "Drop Sets", was: "hypertrophy", fidelity: "approximate", note: "A falling block, two sets a load, all to RPE 8. The solver eases the first tier to RPE 7; one stop rule per block can't.",
    blocks: [B("falling", { from: 74, to: 66, loads: 3, per: 2, ...rpe(8), rest: 90 })] },
  { key: "mechanicalTension", name: "Mechanical Tension", was: "hypertrophy", fidelity: "exact", note: "The Strength Table's block at a lighter load. Filed under the other family; same structure.",
    blocks: [B("constant", { load: 72, sets: 6, ...drop, rest: 150 })] },
  { key: "eccentricAccentuated", name: "Eccentric Accentuated", was: "hypertrophy", fidelity: "close", note: "Constant fives with a 4 s eccentric. The tempo lengthens the session here but doesn't yet add fatigue.",
    blocks: [B("constant", { load: 72, sets: 4, ...reps(5), rest: 180, ecc: 4 })] },
  { key: "forceMetabolic", name: "Force/Metabolic Interleave", was: "hypertrophy", fidelity: "exact", note: "Interleaved at one load: drop-rep sets, then eights.",
    blocks: [B("interleaved", { pairs: 3, aLoad: 70, ...A("a", drop), aRest: 150, bLoad: 70, ...A("b", reps(8)), bRest: 90 })] },
  { key: "hypertrophyCluster", name: "Hypertrophy Cluster", was: "hypertrophy", fidelity: "exact", note: "The Strength Cluster's block with fives at a lighter load.",
    blocks: [B("clustered", { load: 74, clusters: 3, minis: 3, ...reps(5), intra: 15, rest: 150 })] },
  { key: "densitySet", name: "Density Block", was: "hypertrophy", fidelity: "approximate", note: "A timed block isn't one of the six shapes. Shown as eight sets to RPE 7 on a minute's rest, roughly what 15 minutes holds.",
    blocks: [B("constant", { load: 65, sets: 8, ...rpe(7), rest: 60 })] },
  { key: "clockedSets", name: "Ceiling Walk", was: "hypertrophy", fidelity: "close", note: "Constant fours. The start-to-start clock is shown as the rest it leaves.",
    blocks: [B("constant", { load: 72, sets: 10, ...reps(4), rest: 90 })] },
  { key: "restPauseHarvest", name: "Rest-Pause Harvest", was: "hypertrophy", fidelity: "exact", note: "An activation set to RPE 8, then a cluster of up-to-three mini-sets to RPE 9; twice.",
    blocks: [B("constant", { load: 75, sets: 1, ...rpe(8), after: 20 }), B("clustered", { load: 75, clusters: 1, minis: 3, ...rpe(9, 3), intra: 20, after: 360 }), B("constant", { load: 75, sets: 1, ...rpe(8), after: 20 }), B("clustered", { load: 75, clusters: 1, minis: 3, ...rpe(9, 3), intra: 20 })] },
  { key: "shrinkingSets", name: "Shrinking Sets", was: "hypertrophy", fidelity: "exact", note: "Constant sets to RPE 7, capped at four. At 71% on 75 s the model never gets near RPE 7, so no bout shrinks; try a heavier load or a shorter clock.",
    blocks: [B("constant", { load: 71, sets: 8, ...rpe(7, 4), rest: 75 })] },
  { key: "recoveryIslands", name: "Recovery Islands", was: "hypertrophy", fidelity: "exact", note: "Clustered doubles: three to a block, 45 s inside, 3 min between.",
    blocks: [B("clustered", { load: 72, clusters: 4, minis: 3, ...reps(2), intra: 45, rest: 180 })] },
];

export const presetByKey = (k: string) => PRESETS.find((p) => p.key === k) ?? null;
