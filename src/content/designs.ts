// Names and words for the session designs. The eighteen catalogue designs use
// John Hanley's copy from the Strength Architect scheme previews, trimmed only
// where a sentence described what that app's engine does. On Oct 27, 2026 the
// designs moved from those previews to SA's solvers, so six explanations were
// brought in line with what the solvers build: Tapered (one weight, not a
// lighter taper; SA's own scheme details say the same), Sawtooth (the perform
// set runs past the peak-force drop), Double and Volume Pyramid (whole RPE
// steps, peaks by rep count), Eccentric Accentuated (3–5 s) and
// Force/Metabolic (one weight). The eight added on Oct 24, 2026 use his
// catalogue cues; their summaries and explanations are DRAFTS assembled from
// his catalogue and brainstorm wording, for him to edit.

export interface DesignText {
  name: string;
  summary: string;
  explanation: string;
  cue?: string;
  draft?: boolean;
}

export const DESIGN_TEXT: Record<string, DesignText> = {
  // ----- strength -----
  strengthPrescriptionTable: {
    name: "Strength Table",
    summary: "Percentage-based sets × reps",
    explanation:
      "Percentage-based sets and reps, with the rep cap taken from the peak-force model and generous rests between sets. Aim for consistent reps: if the last rep of set 5 looks different from the first rep of set 1, adjust the prescription.",
  },
  sawtooth: {
    name: "Sawtooth",
    summary: "Alternating rep counts at one weight",
    explanation:
      "Alternating rep counts at the same weight. Perform sets run about three reps short of failure; the shorter Practice sets between them leave more room to rehearse your setup. On Practice sets, take time to brace your trunk, build full-body tension and work your cues. On Perform sets, trust your setup and move the bar.",
  },
  topSetBackoff: {
    name: "Top Set + Back-off",
    summary: "One 1–5 rep top set, then a meaningful load drop",
    explanation:
      "One heavy top set provides specific skill practice, from five reps down to a single. The back-offs use a meaningful load drop to add volume. Adjust the top set and back-offs together to change the session's blend of heavy practice and repeated work.",
  },
  pureCluster: {
    name: "Strength Cluster",
    summary: "Heavy clusters with short intra-set rest",
    explanation:
      "Cluster work breaks a heavy set into small efforts with short rests inside the cluster and longer rests between clusters. The aim is to sustain rep quality while distributing the work differently from straight sets.",
  },
  doublePyramid: {
    name: "Double Pyramid",
    summary: "Symmetric arc: ascend, peak at up to RPE 9, descend",
    explanation:
      "Sets 1–3 ascend a point of RPE at a time to a peak of up to RPE 9, then sets 4–5 descend at slightly lighter loads than the mirrored ascent sets. The peak adds a heavier exposure; the surrounding sets add volume. Choose the rep count and peak effort to suit the session.",
  },
  singles: {
    name: "Singles",
    summary: "Single-rep skill, straight or on an EMOM clock",
    explanation:
      "Singles accumulate one-rep practice in two presentations: straight singles with longer rests or EMOM singles under a fixed clock. Every working set is exactly one rep. Ramping singles with follow-up doubles or triples are a separate design, Ramping Singles + Back-off Sets.",
  },
  rampingSingles: {
    name: "Ramping Singles + Back-off Sets",
    summary: "Ascending singles, then limited back-off doubles or triples",
    explanation:
      "Ascending singles build toward one technically precise top exposure. Limited back-off doubles or triples then add productive volume at a lighter load. This is distinct from Singles, where every working set is exactly one rep, and from Top Set + Back-off, which can begin with a 1–5-rep skill set and carries more of the session’s volume in the back-offs.",
  },
  threadedSingles: {
    name: "Threaded Singles",
    summary: "Moderate sets with a heavy single threaded into each rest",
    explanation:
      "Moderate sets alternate with heavy singles, combining repeated work and heavier practice in one session. Keep the singles crisp and use the rests to judge whether the next effort is ready.",
    cue: "Every single should move like a crisp first rep. Plan plates so the swap is one plate a side.",
    draft: true,
  },
  routeSwap: {
    name: "Route Swap",
    summary: "Heavy doubles and a higher-effort volume block, in either order",
    explanation:
      "A heavy block and a moderate block taken two reps short, each cut by its own velocity rule. Heavy first is the default; running volume first lets you compare how well the doubles hold their speed afterward.",
    cue: "Doubles crisp. The lighter sets stop two reps short, not at failure.",
    draft: true,
  },
  recruitmentCrossover: {
    name: "Recruitment Crossover",
    summary: "Heavy doubles, moderate volume, one lighter finisher",
    explanation:
      "Heavy doubles anchor the session, moderate sets add volume, and one lighter finisher is taken two reps short. Read each load against your own L*; the finisher's position relative to it depends on your profile.",
    cue: "Three jobs: heavy practice, quality volume, one honest finisher two reps short.",
    draft: true,
  },
  boundedDescent: {
    name: "Bounded Descent",
    summary: "Two short descending waves",
    explanation:
      "Two descending waves: a double near the top of the band, a triple below it, then a few reps lower still. The second wave's double is judged against the first.",
    cue: "Short stages, down the ladder, then back up once. Judge the second wave's double against the first.",
    draft: true,
  },

  // ----- hypertrophy -----
  tapered: {
    name: "Tapered Sets",
    summary: "Lead sets, then shorter taper sets at the same weight",
    explanation:
      "Lead sets do more reps, followed by shorter taper sets at the same load. The taper reduces the rep demand while adding work after the lead sets. It drops the reps, not the weight; use the effort and stop rules to judge the later sets.",
  },
  ascendingPyramid: {
    name: "Ascending Pyramid",
    summary: "Reps fall while load rises set to set",
    explanation:
      "The early sets use lighter loads and more reps. As reps fall, the load climbs toward a heavier top set. This gives compound lifts a classic pyramid structure and combines repeated work with progressively heavier practice.",
  },
  reversePyramid: {
    name: "Reverse Pyramid",
    summary: "Heaviest first, progressive drops with rising reps",
    explanation:
      "The ascending pyramid in reverse: your heaviest set comes first, then the load drops and the reps rise. Rest between sets and treat each as its own effort. The wider load spread combines a heavier opening set with lighter volume afterward.",
  },
  volumePyramid: {
    name: "Volume Pyramid",
    summary: "Build to a peak, then descend at fixed reps",
    explanation:
      "The full pyramid shape — ascend, peak, descend — with a fixed rep count. Each set climbs a point of RPE toward a peak at RPE 8 (7.5 for sets of six or more), then two back-off sets add volume. The descent uses slightly lighter loads than the mirrored ascent sets.",
  },
  straightSets: {
    name: "Straight Sets",
    summary: "Classic fixed sets × reps",
    explanation:
      "The classic: same weight, same reps, every set. Later sets may feel harder as work accumulates. Adjust load, set count and rest while watching the session's modeled contributions and your actual rep quality.",
  },
  dropSet: {
    name: "Drop Sets",
    summary: "Descending weight across repeated tiers",
    explanation:
      "Descending load tiers with repeated sets at each weight. Each drop lowers the bar weight while earlier work still influences how the next set feels. Follow the listed rests and effort rules throughout the sequence.",
  },
  mechanicalTension: {
    name: "Mechanical Tension",
    summary: "Short sets capped by the peak-force model",
    explanation:
      "Reps are capped at the model's peak-force drop-off estimate, leaving a short set at each load. The intent is consistent high-force work with room in reserve. Load, rep count and rest determine how much repeated work and heavier practice the session contains.",
  },
  eccentricAccentuated: {
    name: "Eccentric Accentuated",
    summary: "Extended 3–5 s eccentric on every rep",
    explanation:
      "Use a deliberate 3–5 s controlled descent on every rep, then drive the bar up. Moderate loads leave room for the longer eccentric. Keep the prescribed tempo consistent so the sets remain comparable.",
  },
  forceMetabolic: {
    name: "Force/Metabolic Interleave",
    summary: "Force and metabolic sets interleaved at one load",
    explanation:
      "Alternate short, crisp sets with longer sets at the same weight. The shorter sets emphasize rep quality; the longer sets add repeated work. Adjust their mix and rests while comparing both modeled contributions across the whole session.",
  },
  hypertrophyCluster: {
    name: "Hypertrophy Cluster",
    summary: "Moderate-load clusters with short intra-set rest",
    explanation:
      "Each working set is broken into 2–3 mini-sets with 10–20 s rests inside the cluster. The load stays constant while the short pauses distribute the effort. Compare the mini-set size and rests with straight sets at the same load and total reps.",
  },
  densitySet: {
    name: "Density Block",
    summary: "Timed AMRAP at a fixed load",
    explanation:
      "Time replaces set structure. You work for a fixed duration at a moderate load, self-regulating rest as fatigue accumulates. Blocked for barbell squat and bench patterns for safety — you should never AMRAP under a barbell without a spotter.",
  },
  clockedSets: {
    name: "Ceiling Walk",
    summary: "Many short sets at one load, on a clock",
    explanation:
      "Many short sets at one load on a fixed start-to-start clock. Use L* as context for the load, and the effort ceiling to keep each set short. The first-rep rule can end the session before the planned set count.",
    cue: "Same bar speed every set. When the first rep slows, rest one extra interval; if it is still slow, stop.",
    draft: true,
  },
  restPauseHarvest: {
    name: "Rest-Pause Harvest",
    summary: "An activation set, then short mini-sets one rep short",
    explanation:
      "An activation set is followed by short mini-sets at the same moderate load. Brief rests make this a compact way to add work close to failure. Use the effort ceilings and first-rep rule to end the block when the next mini-set is already too hard.",
    cue: "The activation set stops two reps short. Each mini-set stops one short. No rep is a grind.",
    draft: true,
  },
  shrinkingSets: {
    name: "Shrinking Sets",
    summary: "Bouts of up to four on a clock; the taper is observed",
    explanation:
      "Up to eight bouts of up to four reps at one load, on a clock. When a bout ends early, the next one's ceiling drops: the taper is observed, not prescribed.",
    cue: "Four reps is a ceiling. End the bout when a rep slows, and start the next one lower.",
    draft: true,
  },
  recoveryIslands: {
    name: "Recovery Islands",
    summary: "Small groups of doubles with short rests inside",
    explanation:
      "Blocks of three doubles with short rests between them and longer rests between blocks. The pauses group the volume into small efforts. Check whether each long rest restores rep speed before starting another block.",
    cue: "Every pair looks like the first. If the long rest doesn't bring the speed back, you're done.",
    draft: true,
  },
};
