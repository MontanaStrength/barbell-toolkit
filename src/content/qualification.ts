// Qualification copy: what each reading is good for, and when it breaks.
// Edit freely; nothing else depends on the wording.

export interface Qualification {
  useFor: string[];
  breaksWhen: string[];
}

export const QUAL: Record<string, Qualification> = {
  rep: {
    useFor: [
      "Checking whether a single rep produced enough force to clear your lift's recruitment line.",
      "Comparing reps at the same load: a higher Multiple is more force in reserve.",
    ],
    breaksWhen: [
      "Your e1RM is stale. Effective Intensity scales with it one for one, so a max that's 5% off moves EI by about 5 points.",
      "The rep wasn't a max-intent effort. A lazy rep reads as low force, not as low capability.",
      "The bar is above about 85% of your max. There EI clears the line on load alone, so it tells you nothing new.",
    ],
  },
  "force-load": {
    useFor: [
      "Seeing how much force you have in reserve at each load, and how fast it shrinks as the bar gets heavier.",
      "Comparing your profile against a population line for the same lift.",
    ],
    breaksWhen: [
      "The ladder singles weren't fresh and fast. Fatigue or a soft rep pulls a point down and tilts the line.",
      "Fewer than three loads are tested. Two points always make a perfect line.",
      "The profile is curved. A straight line through a curve looks fine on R² and still misplaces L*; check the residuals.",
    ],
  },
  drive: {
    useFor: [
      "Typing a lifter: how quickly explosive headroom collapses as load rises.",
      "Comparing the same lifter across training blocks.",
    ],
    breaksWhen: [
      "α is read as a real ceiling. It's the curve projected below the tested range: modeled, not measured.",
      "A load shows zero or negative surplus. It drops out of the fit, which then rests on fewer points.",
    ],
  },
  "l-star": {
    useFor: [
      "Dividing the load axis: below L*, light work only counts if it's fast or taken deep; above L*, the load does the recruiting.",
      "Setting the floor of a strength block in pounds rather than in a borrowed percentage.",
    ],
    breaksWhen: [
      "The e1RM is off. L* moves with it (use the slider on this page to see by how much).",
      "It's read as a fiber count. L* is inferred from force, a band divider with wide error bars, not a measurement of muscle.",
      "The recruitment line is wrong for the lift. The line is a convention: 85 for presses, 90 for squat and deadlift. You can set your own on the probe page.",
    ],
  },
  decay: {
    useFor: [
      "Choosing which velocity to stop a set on: the one that tracks force loss best.",
      "Seeing how many reps hold near your fresh force before drive fades.",
    ],
    breaksWhen: [
      "A single AMRAP is the only sample. One misgrooved rep, where mean velocity craters but force doesn't, can swing the correlation.",
      "Sets at different loads are pooled. The pooled number mixes how decay behaves at each load.",
    ],
  },
  reliability: {
    useFor: [
      "Knowing which points are confirmed across separate days, and how far apart the days landed.",
      "Deciding where to spend the next probe session: on the loads with one round.",
    ],
    breaksWhen: [
      "Rounds differ in warm-up, time of day, or fatigue. Then the spread measures the day, not the lifter.",
      "A load has one round. It has no error bar yet, however tidy it looks.",
    ],
  },
  sessions: {
    useFor: [
      "Building one session and comparing its modeled strength and hypertrophy contributions together.",
      "Turning a recipe into loadable weights, rep and effort rules, rest intervals and profile-based velocity references.",
    ],
    breaksWhen: [
      "Modeled benefits are read as measured adaptations. The scores compare prescriptions; they do not predict how much strength or muscle you will gain.",
      "The effort estimates are read as personal. Reps, load and RPE use a population curve; your probe supplies the force and velocity profile, not a calibrated fatigue response.",
      "A stop velocity is treated as exact. Its fresh-speed reference comes from your profile, but the RPE-to-stop mapping is a coaching starting point to check against your own sets.",
      "L* is treated as a boundary between strength and hypertrophy. It is an inferred load reference, and both modeled contributions can occur in the same set.",
    ],
  },
  compare: {
    useFor: [
      "Deciding whether a training block moved your profile enough to re-set your session bands.",
      "Telling a bigger max apart from a changed profile: L* in pounds can rise while L* as a percentage stays put.",
      "Checking force and bar speed at the same bar weight, the readings that don't depend on the max you entered.",
    ],
    breaksWhen: [
      "The probes used different sensors, setups or rep styles. The change may be the instrument, not you.",
      "Either probe was run tired. Fatigue lowers every fresh point and reads as lost force.",
      "Your e1RM entries are stale. Every percentage moves with them, L* included; force and speed at a fixed bar don't.",
      "No load was repeated on a second day. The noise band then comes from singles within one session, and day-to-day noise is usually larger, so treat a narrow call as provisional.",
    ],
  },
};
