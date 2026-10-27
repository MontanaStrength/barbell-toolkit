import { describe, expect, it } from "vitest";
import { force, fromUnit, suggestBarLb, toUnit, wt, wtRange } from "./format";

describe("units", () => {
  it("round-trips kilograms through pounds", () => {
    expect(toUnit(fromUnit(140, "kg"), "kg")).toBeCloseTo(140, 9);
  });
  it("shows whole pounds and kilograms to 0.1", () => {
    expect(wt(232.4, "lb")).toBe("232 lb");
    expect(wt(232.4, "kg")).toBe("105.4 kg");
    expect(wtRange(232, 261, "kg")).toBe("105.2–118.4 kg");
  });
  it("suggests bars on the plates of the chosen unit", () => {
    expect(suggestBarLb(365, 60, "lb")).toBe(220);
    expect(toUnit(suggestBarLb(fromUnit(140, "kg"), 60, "kg"), "kg")).toBeCloseTo(85, 9);
  });
  it("pairs force units with weight units", () => {
    expect(force(254.71, "lb")).toBe("255 lbf");
    expect(force(254.71, "kg")).toBe("1133 N");
  });
});
