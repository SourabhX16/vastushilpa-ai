import { describe, expect, it } from "vitest";
import { generateLayouts } from "./generateLayouts";
import { scoreVastu } from "./scoreVastu";
import type { PlotInput } from "./types";

const SAMPLE: PlotInput = {
  length: 40,
  width: 30,
  unit: "ft",
  facing: "E",
  city: "bhopal",
  buildingType: "residential",
  bedrooms: 3,
  poojaRoom: true,
  parking: true,
  elderlyGroundFloor: false,
};

describe("scoreVastu", () => {
  const layouts = generateLayouts(SAMPLE);

  it("produces a /100 score with a per-room breakdown", () => {
    for (const layout of layouts) {
      const result = scoreVastu(layout, SAMPLE);
      expect(result.score100).toBeGreaterThanOrEqual(0);
      expect(result.score100).toBeLessThanOrEqual(100);
      expect(result.breakdown.length).toBe(layout.rooms.length);
      for (const check of result.breakdown) {
        expect(check.status).toMatch(/^(ideal|acceptable|poor)$/);
        expect(check.points).toBeGreaterThanOrEqual(0);
        expect(check.points).toBeLessThanOrEqual(check.maxPoints);
        expect(typeof check.reason).toBe("string");
        expect(typeof check.why).toBe("string");
        if (check.status !== "ideal") {
          expect(check.remedy).toBeTruthy();
        }
        // Every rule is an unverified data row with a source string.
        expect(check.source).toContain("TODO");
        expect(check.verified).toBe(false);
      }
    }
  });

  it("includes entrance, Brahmasthan and symmetry checks", () => {
    const result = scoreVastu(layouts[0], SAMPLE);
    expect(result.entrance.label).toBe("Main entrance");
    expect(result.entrance.zone).not.toBe("C");
    expect(result.brahmasthan.label).toBe("Brahmasthan open");
    expect(result.brahmasthan.status).toBe("ideal"); // layouts never breach the centre
    expect(result.symmetry.maxPoints).toBeGreaterThan(0);
    expect(result.symmetry.points).toBeGreaterThanOrEqual(0);
    expect(result.symmetry.points).toBeLessThanOrEqual(10);
  });

  it("counts match the breakdown statuses", () => {
    const result = scoreVastu(layouts[0], SAMPLE);
    const counts = result.breakdown.reduce(
      (acc, c) => {
        acc[c.status] += 1;
        return acc;
      },
      { ideal: 0, acceptable: 0, poor: 0 },
    );
    expect(result.counts).toEqual(counts);
  });

  it("unverifiedShare is a 0..1 fraction, 1 while all rules are unverified", () => {
    const result = scoreVastu(layouts[0], SAMPLE);
    expect(result.unverifiedShare).toBeCloseTo(1, 6);
  });

  it("scores deterministically", () => {
    expect(scoreVastu(layouts[0], SAMPLE)).toEqual(scoreVastu(layouts[0], SAMPLE));
  });

  it("any-layout score in the middle of the scale for the sample", () => {
    // Sanity for a real-world-ish heuristic: none of the three layouts
    // should be a degenerate 0 or perfect 100 on the sample plot.
    for (const layout of layouts) {
      const score = scoreVastu(layout, SAMPLE).score100;
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(100);
    }
  });
});
