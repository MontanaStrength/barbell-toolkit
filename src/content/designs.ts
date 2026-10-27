// Names and words for the session designs. The eighteen catalogue designs use
// John Hanley's copy from the Strength Architect scheme previews, trimmed only
// where a sentence described what that app's engine does. The eight added on
// Oct 24, 2026 use his catalogue cues; their summaries and explanations are
// DRAFTS assembled from his catalogue and brainstorm wording, for him to edit.

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
      "Percentage-based sets and reps from a lookup table calibrated to the peak-force model. Rest is long enough to clear phosphate and preserve cross-bridge quality. Every rep should look the same — if the last rep of set 5 looks different from the first rep of set 1, the prescription was too aggressive.",
  },
  sawtooth: {
    name: "Sawtooth",
    summary: "Alternating rep counts at one weight",
    explanation:
      "Alternating rep counts at the same weight. Every set stays under the peak-force threshold — this is quality work, not grinding. On Practice sets, slow down — brace your trunk, build full-body tension, work your cues. On Perform sets, trust your setup and just move the bar.",
  },
  topSetBackoff: {
    name: "Top Set + Back-off",
    summary: "One 1–5 rep top set, then a meaningful load drop",
    explanation:
      "One heavy top set provides specific skill practice, progressing from five reps toward a single as intensity rises through the block. The back-offs use a meaningful load drop to accumulate quality volume while the nervous system is still primed.",
  },
  pureCluster: {
    name: "Strength Cluster",
    summary: "Heavy clusters with short intra-set rest",
    explanation:
      "Cluster work breaks a heavy set into smaller high-quality efforts with very short rests inside the cluster. That preserves force output and technique, letting you accumulate more demanding reps than straight sets would usually tolerate at the same load.",
  },
  doublePyramid: {
    name: "Double Pyramid",
    summary: "Symmetric arc: ascend, peak at RPE 9, descend",
    explanation:
      "The full pyramid shape for strength phases. Sets 1–3 ascend intensity from RPE 7 to a peak RPE 9 exposure, then sets 4–5 descend at RPE-symmetric loads slightly under the mirrored ascent sets to honor accrued fatigue. The peak set gives a genuine near-max neural exposure; the back-offs capture potentiated volume while the nervous system is still primed. Intensification and realization phases only — too peaky for accumulation, too voluminous for meet week.",
  },
  singles: {
    name: "Singles",
    summary: "Single-rep skill, straight or on an EMOM clock",
    explanation:
      "Singles accumulate technically precise one-rep skill in two presentations: straight singles with full recovery or EMOM singles under a fixed clock. Every working set is exactly one rep. Ramping singles with follow-up doubles or triples are a separate design, Ramping Singles + Back-off Sets.",
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
      "Buy recruitment with fresh moderate sets and tension with heavy singles threaded into the rests, so each is bought in its cheapest state within one session. No single is ever a near-max.",
    cue: "Every single should move like a crisp first rep. Plan plates so the swap is one plate a side.",
    draft: true,
  },
  routeSwap: {
    name: "Route Swap",
    summary: "Heavy fresh doubles and a near-failure volume block, in either order",
    explanation:
      "A heavy fresh block and a moderate block taken two reps short, each cut by its own velocity rule. Heavy first is the default; running volume first shows whether the doubles hold their speed after fatigue.",
    cue: "Doubles crisp. The lighter sets stop two reps short, not at failure.",
    draft: true,
  },
  recruitmentCrossover: {
    name: "Recruitment Crossover",
    summary: "Heavy doubles, quality volume, one finisher below L*",
    explanation:
      "Heavy doubles anchor the session, moderate sets add quality volume, and one finisher below L* is taken two reps short: the fatigue route, after the load route has done its work.",
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
    summary: "Heavier lead sets, then lighter taper sets",
    explanation:
      "Lead sets use heavier loads to recruit high-threshold motor units. Taper sets drop the weight but keep those motor units engaged — accumulating metabolic stress where it matters most.",
  },
  ascendingPyramid: {
    name: "Ascending Pyramid",
    summary: "Reps fall while load rises set to set",
    explanation:
      "The early sets accumulate productive hypertrophy work without asking every set to be heavy. As reps fall, the load climbs into a stronger tension-biased top set. It gives compound lifts a classic pyramid feel while still respecting the session’s fatigue budget.",
  },
  reversePyramid: {
    name: "Reverse Pyramid",
    summary: "Heaviest first, progressive drops with rising reps",
    explanation:
      "The ascending pyramid in reverse. Your heaviest, highest-quality set comes first — when your nervous system is fresh and every rep can produce peak force. Subsequent sets drop the load and raise the reps, accumulating volume while the potentiation from the top set is still live. Distinct from drop sets: full rest between sets, wide load spread, and every set is its own committed effort rather than a shared fatigue cascade.",
  },
  volumePyramid: {
    name: "Volume Pyramid",
    summary: "Symmetric arc: ascend, peak at RPE 8, descend",
    explanation:
      "The full pyramid shape — ascend, peak, descend. Each set climbs a half-step in effort toward a single peak set at RPE 8, then two RPE-symmetric back-off sets capture potentiated volume as fatigue accrues. Load on the descent is slightly lighter than the mirrored ascent set to honor the fatigue curve.",
  },
  straightSets: {
    name: "Straight Sets",
    summary: "Classic fixed sets × reps",
    explanation:
      "The classic. Same weight, same reps, every set. The metabolic cost compounds across sets — set 4 at the same load is physiologically more expensive than set 1.",
  },
  dropSet: {
    name: "Drop Sets",
    summary: "Descending weight, minimal rest",
    explanation:
      "Descending intensity tiers with short rest. Each drop reduces the load while accrued fatigue carries across the sequence, extending time under tension and metabolite accumulation beyond what a single straight set could achieve.",
  },
  mechanicalTension: {
    name: "Mechanical Tension",
    summary: "Fewer reps, every rep at peak force",
    explanation:
      "Every rep produces near-maximal cross-bridge force. Reps are capped at the peak-force drop-off point so there is zero degraded work — the stimulus comes from high force output, not fatigue. RPE stays low because the sets end before chemistry shifts. This is hypertrophy through mechanical tension, not metabolic stress.",
  },
  eccentricAccentuated: {
    name: "Eccentric Accentuated",
    summary: "Extended 3–4 s eccentric on every rep",
    explanation:
      "Muscles produce 20–50% more force during lengthening contractions than shortening ones — and the eccentric phase is the primary driver of muscle damage, the third pillar of hypertrophy. This scheme biases the stimulus toward that phase with a deliberate 3–4 s controlled descent on every rep. Load stays moderate because the tempo is where the work happens, not the weight on the bar.",
  },
  forceMetabolic: {
    name: "Force/Metabolic Interleave",
    summary: "Force and metabolic sets interleaved at one load",
    explanation:
      "Two stimulus types in one session. Force sets (low rep, heavier) drive mechanical tension and motor unit recruitment. Metabolic sets (higher rep, lighter) exploit that recruitment for metabolite accumulation. Interleaving them prevents neural fatigue from compounding on either block.",
  },
  hypertrophyCluster: {
    name: "Hypertrophy Cluster",
    summary: "Moderate-load clusters with short intra-set rest",
    explanation:
      "True cluster sets — distinct from the Force/Metabolic Interleave hybrid. Each working set is broken into 2–3 mini-sets with 10–20 s intra-set rest, letting you accumulate more reps at a harder load than straight sets can sustain. Sits between straight sets (same weight, fatigue drift) and drop sets (descending load, cross-tier fatigue) by keeping load constant but buying back force quality with short rests.",
  },
  densitySet: {
    name: "Density Block",
    summary: "Timed AMRAP at a fixed load",
    explanation:
      "Time replaces set structure. You work for a fixed duration at a moderate load, self-regulating rest as fatigue accumulates. Blocked for barbell squat and bench patterns for safety — you should never AMRAP under a barbell without a spotter.",
  },
  clockedSets: {
    name: "Ceiling Walk",
    summary: "Many short sets just above L*, on a clock",
    explanation:
      "Many short sets at one load just above L* on a fixed start-to-start clock: fully recruited reps at the lowest load, and the most productive work per minute. No rep comes near failure. The first-rep floor, not the set count, says when fresh has ended.",
    cue: "Same bar speed every set. When the first rep slows, rest one extra interval; if it is still slow, stop.",
    draft: true,
  },
  restPauseHarvest: {
    name: "Rest-Pause Harvest",
    summary: "An activation set, then short mini-sets one rep short",
    explanation:
      "Buys reps close to failure at a moderate load in the most time-efficient structure, gated by velocity so no rep is a failure or a grind. The highest peripheral cost in the catalogue.",
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
      "Blocks of three doubles with short rests between them and long rests between blocks: fully recruited volume in small groups, at the lowest peripheral cost of any grouped structure.",
    cue: "Every pair looks like the first. If the long rest doesn't bring the speed back, you're done.",
    draft: true,
  },
};
