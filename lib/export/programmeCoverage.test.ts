import { describe, expect, it } from "vitest";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import type { PlotInput } from "@/lib/engine/types";
import { formatProgrammeCoverage, getProgrammeCoverage } from "./programmeCoverage";

const SAMPLE: PlotInput = {
  length: 40, width: 30, unit: "ft", facing: "E", city: "bhopal",
  buildingType: "residential", bedrooms: 3, poojaRoom: true, parking: true,
  elderlyGroundFloor: false,
};

describe("programme coverage", () => {
  it("derives missing spaces and recorded reasons for all sample layouts", () => {
    const [vastu, energy, balanced] = generateLayouts(SAMPLE, "balanced");
    expect(getProgrammeCoverage(SAMPLE, vastu)).toEqual({
      placed: 9,
      requested: 12,
      unplaced: [
        { label: "Parking bay", reason: "the ground-floor footprint is too full or too small" },
        { label: "Bedroom 2", reason: "moved to the notional first floor (ground footprint is full)" },
        { label: "Bedroom 3", reason: "moved to the notional first floor (ground footprint is full)" },
      ],
    });
    expect(getProgrammeCoverage(SAMPLE, energy).unplaced.map((space) => space.label)).toEqual(["Parking bay", "Bedroom 3"]);
    expect(getProgrammeCoverage(SAMPLE, balanced).unplaced.map((space) => space.label)).toEqual(["Parking bay", "Bedroom 2", "Bedroom 3"]);
    expect(formatProgrammeCoverage(getProgrammeCoverage(SAMPLE, balanced))).toBe(
      "Placed: 9 of 12 requested spaces. Not placed: Parking bay (the ground-floor footprint is too full or too small), Bedroom 2 (moved to the notional first floor (ground footprint is full)), Bedroom 3 (moved to the notional first floor (ground footprint is full))",
    );
  });

  it("reports complete coverage when the 40×60 plot fits the programme", () => {
    const large: PlotInput = { ...SAMPLE, length: 40, width: 60 };
    const layout = generateLayouts(large, "balanced").find((item) => item.id === "balanced")!;
    const coverage = getProgrammeCoverage(large, layout);
    expect(coverage.unplaced).toEqual([]);
    expect(coverage.placed).toBe(coverage.requested);
    expect(formatProgrammeCoverage(coverage)).toBe("All requested spaces placed");
  });
});
