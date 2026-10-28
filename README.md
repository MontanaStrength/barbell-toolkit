# Barbell Toolkit

Free, self-serve force–velocity profiling for lifters with a velocity sensor.
Log a probe (ladder singles at 60/70/80/90% of e1RM, then one all-out set at
60%) and get a report: Force–Load line, drive compression, L* (the load where
Effective Intensity crosses the lift's recruitment line), within-set decay,
reliability across rounds, and an editable session workspace with velocity guides.

Everything runs in the browser. A probe is saved to `localStorage` and can be
exported and imported as probe-log CSV (the probe-log spreadsheet's own
headers import too).

## Engine

`src/engine/` is pure TypeScript with no dependencies. Design decisions:

1. Legacy report references use `v_stop = (1 − f)·v_fresh + f·MVT`, with
   fixed fractions in `STOP_FRACTION` in `constants.ts`. The session workspace
   uses recipe effort instructions and RPE-based velocity guides; these are
   coaching estimates, not exclusive outcome categories or validated stops.
2. The recruitment line is set per lift (`LIFTS` in `constants.ts`).
3. Loads are plotted as the bar actually lifted ÷ the current e1RM, not the
   planned percentage.

`engine.test.ts` pins a hand-validated reference report and the v4
probe-log spreadsheet's numbers (Force–Load fit, L*, decoupling), so a change
to the math can't drift silently.

## Session workspace

The Sessions report keeps all 26 named recipes in one searchable library with
overlapping structure filters. Recipe settings build a starting prescription;
the set editor changes actual weight, reps/mini-sets, effort guides or ceilings,
and recovery timing. Sets can be duplicated, reordered and removed with undo.
Conditional execution instructions are editable and included in the gym card.

Strength and hypertrophy are concurrent model readings. The evaluator uses a
pinned, pure slice of Strength Architect's chronological effort and
set/group/session accounting; see [source provenance and limits](src/engine/sa/PROVENANCE.md).
It evaluates the final rounded weight, never silently changes fixed work, and
withholds whole-session totals for unknown or infeasible work. A timed window,
rep ceiling or approximate stop-driven count is not treated as completed reps.
Probe-derived velocities remain separate from population model estimates.

Drafts and saved comparisons stay in localStorage, scoped to the exact probe.
Each recipe retains its own custom sets and rules. A comparison snapshots the
actual work and its instructions. Generated recipes use the selected unit's
plate increments; custom and saved physical weights survive unit changes.
Storage failures leave the current editor usable and show that the draft is
not persisted. Nothing is uploaded.

The model integration has independent upstream parity fixtures plus regression
coverage for timing, rounding, incomplete work, infeasibility, persistence and
gym instructions. These checks establish software behavior, not physiological
validation or equivalence to Strength Architect's full program generator.

## Content

The "Use it for / Breaks when" copy on every page lives in
`src/content/qualification.ts`. Edit it there.

## Develop

```sh
npm install
npm run dev            # local site
npm test               # engine tests
npm run build          # deployable site in dist/
npm run build:preview  # one self-contained HTML file in dist-preview/
```

## Hosting

Cloudflare, as a Worker that serves the static build (`wrangler.jsonc`).
There's no server code: every request is a file from `dist/`, and paths with
no file get `index.html`, so report sections keep their own URLs
(`/report/l-star`, `/report/sessions`, …).

Cloudflare's GitHub integration builds and deploys on push (build command
`npm run build`, deploy command `npx wrangler deploy`). To deploy by hand from
a machine logged in with `npx wrangler login`: `npm run deploy`.
