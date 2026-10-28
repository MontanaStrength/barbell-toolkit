# Strength Architect evaluation core

Pinned upstream: [`Barbell-Hacks/StrengthArchitect-` at `f6fc5ac220c54e553f3433052d6ab9a9ebfaafb1`](https://github.com/Barbell-Hacks/StrengthArchitect-/tree/f6fc5ac220c54e553f3433052d6ab9a9ebfaafb1/src/engine). This was verified GitHub main on 2026-10-27. It is source provenance, not a claim about the deployed Strength Architect app. `provenance.json` records SHA-256 of the upstream files before import-only packaging changes.

The 18 pure source modules retain their equations, coefficients, references, guards, and model versions. Packaging changes are limited to relative imports and replacing broad barrels with the same named exports from their defining modules. `powerSuitability.ts` retains its logic and imports a narrower structural exercise type. There is no upstream weekly planner, readiness/illness policy, account state, or optimizer selection in this package.

## Narrow catalog boundary

The unchanged recruitment, benefit, power, and session-domain functions need exercise metadata. `exercises/exerciseLibrary.ts` provides only the relevant fields of the three supported upstream catalog entries:

| Toolkit lift | SA ID | Catalog source | Primary muscles | Secondary muscles |
|---|---|---|---|---|
| bench | bench_press | exercises/library/horizontalPush.ts | Chest | Triceps, Shoulders |
| squat | back_squat | exercises/library/squat.ts | Quads, Glutes | Hamstrings, Core |
| deadlift | conventional_deadlift | exercises/library/hinge.ts | Hamstrings, Glutes, Back | Quads, Core, Forearms, Traps |

The exact movement patterns, null power-category/accommodating metadata, and compound flags are retained. The exact secondary-muscle allocation constant is 0.5 from `modeling/volume/plannedVolume.ts`. The `PowerExerciseCategory` union and two numeric scale maxima are exact extracts; unrelated type dependencies and policies are omitted. Adding another lift requires a reviewed metadata mapping and parity coverage.

## Toolkit adapter contract

`../sessions/evaluation.ts` accepts actual rounded load percentages in card order, without changing inputs. It expands explicit cluster parts into individual work bouts, projects effort through work/recovery chronologically, evaluates the real segments, maps bench/squat/deadlift domains, then applies canonical session diminishing returns. The final set has no after-rest. Start-to-start clocks use interval remainder after Toolkit's explicit work-time estimate (4 seconds per rep plus slow-eccentric time and internal cluster rests), with a visible warning that this is estimated.

The supplied RPE of a fixed row is not automatically realized effort. Fresh effort comes from actual load/reps. Explicit ceiling rows use the canonical quality-ceiling check. The adapter does not turn a ceiling into a target, rewrite work to satisfy it, or claim generator admission. Unknown prior work prevents inference of later effort. Work exceeding fresh capacity or projected RPE 10 remains visible but receives no attainable-session totals.

Actual clusters compose once per cluster. Authored Recovery Islands and Rest-Pause Harvest use only contiguous explicit `Block N` labels; moving rows across an intervening block separates their groups. Generic phase labels (`Tier`, `Lead`, `Taper`, `Top set`, `Back-off`, etc.) are not group IDs. These labels do not justify compound-set tail discounts. The existing Toolkit drop-set recipe contains independently rested tier sets, so the adapter evaluates the delivered structure. If editing introduces compound structures beyond this contract, add explicit stable structure/group metadata instead of inferring from a recipe's name.

Group inputs use `segment_specific` projected effort, preventing a second application of RPE drift. The separate canonical group-depletion state still affects segment adaptation. `sessionEventsForSetGroup` supplies the credited costs, including the central-tail rule, once; the group is not added again as another session event.

`upTo`, `toStop/about`, and timed work remain unpriced. Their numeric ceilings, rough estimates, or minutes never become completed reps. A known prefix retains effort diagnostics, but whole-session benefit/cost is null and status is partial (unavailable when no work can be projected). This is deliberately stricter than SA's optional synthetic density forecast. No such forecast is imported.

Tempo is marked `tempo_constrained` as in SA's planned-session mapping. The source model does not provide an additional slow-eccentric hypertrophy/recovery multiplier. No explosive intent is invented from an ordinary concentric prescription. Zero modeled power credit does not mean zero real-world power adaptation.

## Units and evidence

- `rawBenefits`: sum of per-set/real-segment credit before session diminishing returns; not raw native force dose.
- `benefits`: canonical session-adjusted credit across the actual muscle/movement domains. Hypertrophy uses hard-set-equivalent units. Strength uses its own reference: 3 exact-movement upper-press reps at 85%, RPE 7, zero entering depletion. Power and local-endurance credits have their own source references.
- `costs.peripheral`: local-muscular model points. 100-point anchor: 11 reps at 70%, RPE 10.
- `costs.central`: lasting-central model points. 100-point anchor: 5 upper-press reps at 80%, RPE 8.

The axes are not percentages of a whole and are never summed into a benefit score. Costs are not recovery minutes or measured fatigue. Population coefficients and model confidence are not physiological validation, and a personal velocity probe is not silently inserted into unrelated coefficients. The public receipt includes source SHA and model versions.

## Validation

`fixtures/ordinary.json` was generated independently against the exact archived upstream source before extraction: six finite bench examples with actual load percentages, including the top/back-off card and matched-rep/rest comparisons. `fixtures/grouped.json` was generated against the same original source using two clusters and two recovery-island groups, canonical chronological projection, group composition, domain mapping, and session composition. Golden assertions check all axes/costs and effort at numerical precision. Adapter tests additionally cover clock recovery, edits/reordering, unknown reps/time, ceilings, infeasibility, immutability, invalid input, and all 26 catalog defaults.

To validate this integration:

```sh
npx vitest run src/engine/sessions/evaluation.test.ts
npm run typecheck
```

Updating the pin requires recopying the reviewed pure modules, regenerating independent upstream fixtures, reviewing catalog/type extracts, updating the manifest, and reconciling changed model behavior. Passing fixtures establishes numerical parity for those inputs, not universal model validity or compatibility of all SA generator policies.
