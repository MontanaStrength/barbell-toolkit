import { useEffect, useState } from "react";
import { fromUnit, toUnit, type Unit } from "../format";

/** A weight field that shows the display unit and reports pounds. */
export default function WeightInput({
  id,
  valueLb,
  unit,
  onChangeLb,
  placeholder,
}: {
  id: string;
  valueLb: number | null;
  unit: Unit;
  onChangeLb: (lb: number | null) => void;
  placeholder?: string;
}) {
  const show = (lb: number | null) => (lb == null || !(lb > 0) ? "" : String(Math.round(toUnit(lb, unit) * 10) / 10));
  const [text, setText] = useState(() => show(valueLb));

  // Re-sync when the value changes elsewhere or the unit switches, but not
  // while the typed text already means the same weight (so "102." survives).
  useEffect(() => {
    const n = parseFloat(text);
    const typedLb = Number.isFinite(n) ? fromUnit(n, unit) : null;
    const same =
      (typedLb == null && (valueLb == null || !(valueLb > 0))) ||
      (typedLb != null && valueLb != null && Math.abs(typedLb - valueLb) < 0.05);
    if (!same) setText(show(valueLb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueLb, unit]);

  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        onChangeLb(Number.isFinite(n) && n > 0 ? fromUnit(n, unit) : null);
      }}
    />
  );
}
