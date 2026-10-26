# Barbell Toolkit

Free, self-serve force–velocity profiling for lifters with a velocity sensor.
Log a probe (ladder singles at 60/70/80/90% of e1RM, then one all-out set at
60%) and get a report: Force–Load line, drive compression, L* (the load where
Effective Intensity crosses the lift's recruitment line), within-set decay,
reliability across rounds, and session bands with velocity stops.

Everything runs in the browser. A probe is saved to `localStorage` and can be
exported and imported as probe-log CSV (the probe-log spreadsheet's own
headers import too).

## Engine

`src/engine/` is pure TypeScript with no dependencies. Design decisions:

1. Velocity stops scale by goal: `v_stop = (1 − f)·v_fresh + f·MVT`, with
   f = 0.2 power, 0.3 strength, 0.5 hypertrophy (provisional; see
   `STOP_FRACTION` in `constants.ts`).
2. The recruitment line is set per lift (`LIFTS` in `constants.ts`).
3. Loads are plotted as the bar actually lifted ÷ the current e1RM, not the
   planned percentage.

`engine.test.ts` pins a hand-validated reference report and the v4
probe-log spreadsheet's numbers (Force–Load fit, L*, decoupling), so a change
to the math can't drift silently.

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

`vercel.json` rewrites every path to `index.html`, so report sections have
their own URLs (`/report/l-star`, `/report/sessions`, …).
