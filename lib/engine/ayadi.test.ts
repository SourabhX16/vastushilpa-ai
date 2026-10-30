import { describe, expect, it } from "vitest";
import { calculateAyadi, suggestNearestAuspicious } from "./ayadi";
import type { PlotInput } from "./types";

const SAMPLE: PlotInput = {
  length: 30,
  width: 20,
  unit: "ft",
  facing: "E",
  city: "bhopal",
  buildingType: "residential",
  bedrooms: 2,
  poojaRoom: true,
  parking: false,
  elderlyGroundFloor: false,
};

const SAMPLE_METRIC: PlotInput = { ...SAMPLE, length: 9, width: 6, unit: "m" };

describe("calculateAyadi — shape", () => {
  const result = calculateAyadi(SAMPLE);

  it("steps are non-empty with the required fields", () => {
    expect(result.steps.length).toBeGreaterThan(0);
    for (const step of result.steps) {
      expect(typeof step.label).toBe("string");
      expect(typeof step.formulaText).toBe("string");
      expect(typeof step.calculation).toBe("string");
      expect(typeof step.result).toBe("string");
      expect(typeof step.evaluated).toBe("boolean");
      expect(step.auspicious === null || typeof step.auspicious === "boolean").toBe(true);
      expect(typeof step.unverified).toBe("boolean");
    }
  });

  it("first step is the measure conversion", () => {
    expect(result.steps[0]?.label).toBe("Measure conversion");
  });

  it("perFormula covers all configured keys", () => {
    const keys = result.perFormula.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining(["aaya", "vyaya", "yoni", "nakshatra", "vara", "tithi"])
    );
  });

  it("overallAuspicious is a boolean; unverifiedCount matches unverified steps", () => {
    expect(typeof result.overallAuspicious).toBe("boolean");
    expect(result.unverifiedCount).toBe(
      result.steps.filter((s) => s.unverified).length
    );
    expect(result.unverifiedCount).toBeGreaterThan(0);
  });

  it("begins with the conversion; not-evaluated formulas are flagged", () => {
    const notEvaluated = result.perFormula.filter((f) => !f.evaluated);
    for (const f of notEvaluated) expect(f.auspicious).toBeNull();
  });
});

describe("calculateAyadi — determinism", () => {
  it("same input gives identical output", () => {
    expect(calculateAyadi(SAMPLE)).toEqual(calculateAyadi(SAMPLE));
  });

  it("metric input is deterministic", () => {
    expect(calculateAyadi(SAMPLE_METRIC)).toEqual(calculateAyadi(SAMPLE_METRIC));
  });

  it("metric vs imperial of the same site differ in conversion step text", () => {
    expect(
      calculateAyadi(SAMPLE).steps[0]?.calculation
    ).not.toEqual(calculateAyadi(SAMPLE_METRIC).steps[0]?.calculation);
  });
});

describe("suggestNearestAuspicious", () => {
  const input = suggestNearestAuspicious(SAMPLE);

  it("never suggests the input dimensions", () => {
    for (const item of input) {
      const sameDims =
        Math.abs(item.length - SAMPLE.length) < 1e-9 &&
        Math.abs(item.width - SAMPLE.width) < 1e-9;
      expect(sameDims).toBe(false);
    }
  });

  it("returns at most 3 suggestions, shape complete", () => {
    expect(input.length).toBeLessThanOrEqual(3);
    for (const item of input) {
      expect([item.length, item.width, item.unit]).toEqual([
        expect.any(Number),
        expect.any(Number),
        SAMPLE.unit,
      ]);
      expect(typeof item.deltaLengthFt).toBe("number");
      expect(typeof item.deltaWidthFt).toBe("number");
      expect(
        Math.abs(item.deltaLengthFt) + Math.abs(item.deltaWidthFt)
      ).toBeGreaterThan(0);
    }
  });

  it("is sorted by smallest total change", () => {
    const changes = input.map(
      (i) => Math.abs(i.deltaLengthFt) + Math.abs(i.deltaWidthFt)
    );
    expect(changes).toEqual([...changes].sort((a, b) => a - b));
  });

  it("every suggestion actually evaluates auspicious", () => {
    for (const item of input) {
      const cand: PlotInput = { ...SAMPLE, length: item.length, width: item.width };
      expect(calculateAyadi(cand).overallAuspicious).toBe(true);
    }
  });

  it("suggestions are deterministic", () => {
    expect(suggestNearestAuspicious(SAMPLE)).toEqual(
      suggestNearestAuspicious(SAMPLE)
    );
    expect(input).toEqual(suggestNearestAuspicious(SAMPLE));
  });

  it("never suggests the input dimensions (metric too)", () => {
    const metric = suggestNearestAuspicious(SAMPLE_METRIC);
    for (const item of metric) {
      const sameDims =
        Math.abs(item.length - SAMPLE_METRIC.length) < 1e-6 &&
        Math.abs(item.width - SAMPLE_METRIC.width) < 1e-6;
      expect(sameDims).toBe(false);
      expect(item.unit).toBe("m");
    }
  });
});
