import { useState } from "react";
import { Link } from "react-router-dom";
import { DESIGN_TEXT } from "../content/designs";
import type { Analysis } from "../engine/analyze";
import { LIFTS } from "../engine/constants";
import { buildCard, contextFor } from "../engine/sessions/card";
import { designByKey } from "../engine/sessions/designs";
import { fmt, suggestBarLb, wt, type Unit } from "../format";
import { useStore } from "../store";
import { Ledger, RT_WORDS, rulesOfThumb, Tally, usePricing, type Basis } from "./EffectiveSets";
import QualCard from "./QualCard";

/** Sets at this effort or harder count as "hard" in the usual tally. */
const HARD_RPE = 7;

export default function EffectiveSetsSection({ a, unit }: { a: Analysis; unit: Unit }) {
  const { design: chosen } = useStore();
  const ctx = contextFor(a, a.probe.lift, a.probe.mvt);
  const design = designByKey(chosen.key)!;
  const blocked = (design.lifts && !design.lifts.includes(ctx.lift)) || design.unavailable?.(ctx);
  const card = blocked ? null : buildCard(design, ctx, chosen.inputs[chosen.key], chosen.edits[chosen.key]);
  const [basis, setBasis] = useState<Basis>("label");
  const pricing = usePricing(card?.sets ?? [], basis, ctx.lstar);
  const text = DESIGN_TEXT[chosen.key];
  const felt = (card?.sets ?? []).some((s) => s.felt != null);
  const lift = LIFTS[ctx.lift].name.toLowerCase();
  const bar = (pct: number) => wt(suggestBarLb(a.probe.e1rm, pct, unit), unit);

  if (!card) {
    return (
      <div className="empty stack">
        <p style={{ margin: "0 auto" }}>
          {text.name} can't be built for this {lift} profile. <Link to="/report/sessions">Pick another design</Link>.
        </p>
      </div>
    );
  }

  const lede = (
    <p className="lede">
      Effective sets price what a session buys toward growth, the way Strength Architect does. Each rep earns
      recruitment × tension; a set's reps are summed and divided by what the same load taken to two reps in reserve
      would sum to; a session adds its sets through a curve that bends after the first full one. The card's neural
      dose is the strength tally; this is the hypertrophy one.
    </p>
  );

  if (pricing.sets.length === 0) {
    return (
      <>
        {lede}
        <div className="empty stack">
          <p style={{ margin: "0 auto" }}>
            {text.name} is timed work: the reps are whatever clean work fits in the block, so there is no set to price.{" "}
            <Link to="/report/sessions">Pick another design</Link>.
          </p>
        </div>
      </>
    );
  }

  // The usual tally, for the gap this page explains.
  const usual = {
    sets: card.sets.length,
    hard: card.sets.filter((s) => s.rpe >= HARD_RPE).length,
    reps: card.totals.reps,
  };

  return (
    <>
      {lede}

      <section className="panel stack rt-head" aria-label="This session's count">
        <div className="rt-headline">
          <div>
            <div className="reading-label">
              {text.name}, {lift}
            </div>
            <div className="reading-value">
              {fmt(pricing.credited, 2)} <span className="rt-unit">effective sets</span>
            </div>
            <div className="reading-note">
              Counted the usual way: {usual.sets} set{usual.sets === 1 ? "" : "s"}, {usual.hard} at RPE {HARD_RPE} or harder
              {usual.reps != null ? `, ${card.totals.approximate ? "up to " : ""}${usual.reps} reps` : ""}.
            </div>
            <div className="reading-note">
              Here: {fmt(pricing.raw, 2)} before diminishing returns, over {pricing.sets.length} counted set
              {pricing.sets.length === 1 ? "" : "s"}
              {pricing.partial ? " (timed work isn't counted)" : ""}. Muscles the lift works only in part get half the dose:{" "}
              {fmt(pricing.secondary, 2)}.
            </div>
          </div>
          <div className="stack-sm">
            <Link to="/report/sessions" className="btn btn-small btn-quiet">
              Change the session
            </Link>
            {felt && (
              <>
                <div className="segmented segmented-quiet" role="group" aria-label="Price each set at">
                  <button type="button" aria-pressed={basis === "label"} onClick={() => setBasis("label")}>
                    Written RPE
                  </button>
                  <button type="button" aria-pressed={basis === "felt"} onClick={() => setBasis("felt")}>
                    Felt RPE
                  </button>
                </div>
                <p className="small muted rt-basis-note">
                  Felt prices the written reps done anyway as the session wears on. At your velocity stops, fatigue shows up as
                  fewer reps at the written RPE instead, which earns less.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="panel stack rt-rules" aria-labelledby="rt-rules-h">
        <h2 id="rt-rules-h" style={{ fontSize: 20 }}>
          Where this count parts from the usual one
        </h2>
        <ol className="rules">
          {rulesOfThumb(ctx.lstar).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      <section className="stack" aria-labelledby="rt-ledger-h">
        <h2 id="rt-ledger-h" style={{ fontSize: 26 }}>
          1. Each set against a hard set
        </h2>
        <p>
          Each strip is a set, one cell a rep from first to last, darker the more it earns. Above L* the load recruits
          and every rep earns; below it only the last few do. A set's reps are summed and divided by the same load taken
          to two reps in reserve. The red tick is the cap: short sets earn at most reps ÷ 5. Each row says what would
          make it a full set.
          {ctx.lstar == null ? " This probe has no L*, so only the fatigue route prices." : ""}
        </p>
        <Ledger pricing={pricing} bar={bar} lstar={ctx.lstar} />
        <p className="small muted">{RT_WORDS.rep}</p>
      </section>

      <section className="stack" aria-labelledby="rt-tally-h">
        <h2 id="rt-tally-h" style={{ fontSize: 26 }}>
          2. The tally
        </h2>
        <p>Grey is the sum of the credits. Dark is what the session is credited after each set, as later sets add less.</p>
        <Tally pricing={pricing} />
        <p className="small muted">{RT_WORDS.session}</p>
      </section>

      <QualCard id="effective-sets" />
    </>
  );
}
