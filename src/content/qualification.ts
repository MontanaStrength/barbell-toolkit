// Qualification copy: what each reading is for, and when it breaks.
// Edit freely; nothing else depends on the wording.

export interface Qualification {
  useFor: string[];
  breaksWhen: string[];
}

export const QUAL: Record<string, Qualification> = {
  rep: {
    useFor: [
      "Whether one rep cleared the lift's recruitment line.",
      "Comparing reps at one load: a higher Multiple is more force in reserve.",
    ],
    breaksWhen: [
      "The e1RM is stale. EI scales with it one for one.",
      "The rep wasn't max intent. A lazy rep reads as low force.",
      "The bar is at or above the line's own percentage. EI clears it on bar weight alone.",
    ],
  },
  "force-load": {
    useFor: [
      "Force in reserve at each load, and how fast it shrinks.",
      "Your slope against the population line for the lift.",
    ],
    breaksWhen: [
      "A ladder single wasn't fresh and fast. It pulls its point down and tilts the line.",
      "Fewer than three loads. Two points always fit a line.",
      "The profile is curved. R² stays high and L* still moves; check the residuals.",
    ],
  },
  "l-star": {
    useFor: [
      "Dividing the load axis: above L*, the load recruits on a fresh rep; below it, only the last reps of a hard set do.",
      "The floor of a strength block, in pounds.",
    ],
    breaksWhen: [
      "The e1RM is off. L* moves with it; the sensitivity slider shows by how much.",
      "It's read as a fiber count. L* is inferred from force, with wide error bars.",
      "The recruitment line is wrong for the lift. 85 for presses, 90 for squat and deadlift, by convention; set your own on the probe page.",
    ],
  },
  decay: {
    useFor: [
      "Which velocity tracks force loss, and which is steadier rep to rep.",
      "How many reps hold near fresh force before drive fades.",
    ],
    breaksWhen: [
      "One AMRAP is the only sample. A single misgrooved rep can swing the correlation.",
      "Sets at different loads are pooled.",
    ],
  },
  reliability: {
    useFor: [
      "Which points are confirmed on separate days, and how far apart the days landed.",
      "Where the next probe session is worth spending: loads with one round.",
    ],
    breaksWhen: [
      "Rounds differ in warm-up, time of day or fatigue. The spread then measures the day.",
      "A load has one round. It has no error bar yet.",
    ],
  },
  sessions: {
    useFor: [
      "A starting prescription: loads, reps, sets and a stop velocity for each set.",
      "L* as concrete bar weights for a block.",
    ],
    breaksWhen: [
      "Stop fractions are taken as exact. They are coaching starting points (power 0.2, strength 0.3, hypertrophy 0.6 below L* and 0.4 above), not measured from you.",
      "A design's RPE is read as a stop through a fixed map (6.5 → 0.2, 7.5 → 0.3, 8 → 0.4, 9 → 0.6 of the way to MVT). Your own sets will show where it's off.",
      "Reps and loads are read as personal. They come from a population curve (Nuzzo 2023), not your data.",
      "Set counts are followed past recovery. Neural-dose targets are ranges, not limits.",
    ],
  },
  "effective-sets": {
    useFor: [
      "Seeing why a session counts as the effective sets it does: which reps recruit, through which route, and where the count saturates.",
      "Comparing two designs at the same volume by what they buy, not by reps.",
    ],
    breaksWhen: [
      "The credit is read as muscle gained. It is the pricing model's estimate of stimulus, calibrated by coaching judgement, not measured growth.",
      "A strength session is read as a poor one. It prices growth stimulus; a session of hard singles is meant to score low here and high on neural dose.",
      "The seeds are taken as settled. The L* band, decay rates, the 5-rep cap and the session curve are coaching assumptions marked for calibration.",
      "Sets are priced at their written reps and RPE. At the stop you may get fewer reps, and a shorter set earns less; a set that runs harder than written earns more, which the felt basis estimates.",
      "The reference counts whole reps, so a set's credit steps where a hard set at its load loses a rep, around 73, 76 and 79% on the population curve.",
      "L* is the lifter's own here. The pricing model's reference form uses a population L* per lift class, so its figure for the same session can differ.",
    ],
  },
  compare: {
    useFor: [
      "Whether a block moved the profile enough to re-set the bands.",
      "A bigger max against a changed profile: L* in pounds can rise while L* in percent holds.",
      "Force and bar speed at the same bar weight, which don't depend on the max entered.",
    ],
    breaksWhen: [
      "Different sensors, setups or rep styles. The change may be the instrument.",
      "Either probe was run tired. Every fresh point reads low.",
      "Stale e1RM entries. Every percentage moves with them; force and speed at a fixed bar don't.",
      "No load was repeated on a second day. The noise band then comes from within one session, and day-to-day noise is usually larger.",
    ],
  },
};
