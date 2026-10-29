import { useState } from "react";
import { Link } from "react-router-dom";
import { DESIGN_TEXT } from "../content/designs";
import type { Analysis } from "../engine/analyze";
import { LIFTS } from "../engine/constants";
import { buildCard, contextFor } from "../engine/sessions/card";
import { designByKey } from "../engine/sessions/designs";
import { fmt, type Unit } from "../format";
import { useStore } from "../store";
import { Field, Ledger, RT_WORDS, Tally, usePricing, type Basis } from "./EffectiveSets";
import QualCard from "./QualCard";

export default function EffectiveSetsSection({ a, unit }: { a: Analysis; unit: Unit }) {
  void unit;
  const { design: chosen } = useStore();
  const ctx = contextFor(a, a.probe.lift, a.probe.mvt);
  const design = designByKey(chosen.key)!;
  const blocked = (design.lifts && !design.lifts.includes(ctx.lift)) || design.unavailable?.(ctx);
  const card = blocked ? null : buildCard(design, ctx, chosen.inputs[chosen.key], chosen.edits[chosen.key]);
  const [basis, setBasis] = useState<Basis>("label");
  const pricing = usePricing(card?.sets ?? [], basis, ctx.lstar);
  const text = DESIGN_TEXT[chosen.key];
  const felt = (card?.sets ?? []).some((s) => s.felt != null);

  if (!card) {
    return (
      <div className="empty stack">
        <p style={{ margin: "0 auto" }}>
          {text.name} can't be built for this {LIFTS[ctx.lift].name.toLowerCase()} profile. <Link to="/report/sessions">Pick another design</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="lede">
        Each rep earns recruitment × tension. A set is its reps summed over a hard set at the same load. A session adds
        its sets through a curve that bends after the first full one.
      </p>

      <section className="panel stack rt-head" aria-label="This session's count">
        <div className="rt-headline">
          <div>
            <div className="reading-label">
              {text.name}, {LIFTS[ctx.lift].name.toLowerCase()}
            </div>
            <div className="reading-value">
              {fmt(pricing.credited, 2)} <span className="rt-unit">effective sets</span>
            </div>
            <div className="reading-note">
              {fmt(pricing.raw, 2)} before diminishing returns, over {pricing.sets.length} counted set
              {pricing.sets.length === 1 ? "" : "s"}. Secondary muscles, at half dose: {fmt(pricing.secondary, 2)}.
              {pricing.partial ? " Timed work isn't counted." : ""}
            </div>
          </div>
          <div className="stack-sm">
            <Link to="/report/sessions" className="btn btn-small btn-quiet">
              Change the session
            </Link>
            {felt && (
              <div className="segmented segmented-quiet" role="group" aria-label="Price each set at">
                <button type="button" aria-pressed={basis === "label"} onClick={() => setBasis("label")}>
                  Written RPE
                </button>
                <button type="button" aria-pressed={basis === "felt"} onClick={() => setBasis("felt")}>
                  Felt RPE
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="rt-field-h">
        <h2 id="rt-field-h" style={{ fontSize: 26 }}>
          1. What each rep earns
        </h2>
        <p>
          Darker is more stimulus. A set is a column: it starts high in reserve and descends toward failure, one dot a
          rep. Right of L*, the load recruits and every rep counts. Left of it, only the reps near the floor do.
          {ctx.lstar == null ? " This probe has no L*, so only the fatigue route prices." : ""}
        </p>
        <Field pricing={pricing} lstar={ctx.lstar} />
        <p className="small muted">{RT_WORDS.routes}</p>
      </section>

      <section className="stack" aria-labelledby="rt-ledger-h">
        <h2 id="rt-ledger-h" style={{ fontSize: 26 }}>
          2. Each set against a hard set
        </h2>
        <p>
          A set's reps are summed and divided by the same load taken to two reps in reserve. The red tick is the cap:
          short sets earn at most reps ÷ 5.
        </p>
        <Ledger pricing={pricing} />
        <p className="small muted">{RT_WORDS.cap}</p>
      </section>

      <section className="stack" aria-labelledby="rt-tally-h">
        <h2 id="rt-tally-h" style={{ fontSize: 26 }}>
          3. The tally
        </h2>
        <p>Grey is the sum of the credits. Dark is what the session is credited after each set, as later sets add less.</p>
        <Tally pricing={pricing} />
        <p className="small muted">{RT_WORDS.session}</p>
      </section>

      <QualCard id="effective-sets" />
    </>
  );
}
