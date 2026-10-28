// Pure unit and plate helpers shared by the editor and the prescription model.
// Stored weights are always pounds; changing the display unit does not convert
// an already authored workout into a different workout.
export type Unit = "lb" | "kg";
export const LB_PER_KG = 2.20462;
export const toUnit = (lb: number, unit: Unit) =>
  unit === "kg" ? lb / LB_PER_KG : lb;
export const fromUnit = (value: number, unit: Unit) =>
  unit === "kg" ? value * LB_PER_KG : value;
export const plateStep = (unit: Unit) => (unit === "kg" ? 2.5 : 5);
export const plateRound = (value: number, step = 5) =>
  Math.round(value / step) * step;
export const suggestBarLb = (e1rmLb: number, pct: number, unit: Unit) =>
  fromUnit(
    plateRound(toUnit((e1rmLb * pct) / 100, unit), plateStep(unit)),
    unit,
  );
