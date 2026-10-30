import { describe, expect, it } from "vitest";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import type { PlotInput } from "@/lib/engine/types";
import { toFeet } from "@/lib/engine/vastuGrid";
import { runStructural } from "./index";
import { designShearStrength, twoWayAlphaX } from "./checks";

const SAMPLE: PlotInput = {
  length: 40, // east-west extent (see the axis convention in vastuGrid.ts)
  width: 30, // north-south extent
  unit: "ft",
  facing: "E",
  city: "bhopal",
  buildingType: "residential",
  bedrooms: 3,
  poojaRoom: true,
  parking: true,
  elderlyGroundFloor: false,
};

const SMALL: PlotInput = { ...SAMPLE, length: 32, width: 22, bedrooms: 2 };

/** No column strictly inside the shrunken Brahmasthan cell (margin 0.5 ft). */
function assertNoCentralColumn(plot: PlotInput, cols: { xFt: number; yFt: number }[]): void {
  const L = toFeet(plot.length, plot.unit);
  const W = toFeet(plot.width, plot.unit);
  const margin = 0.5;
  for (const c of cols) {
    const insideX = c.xFt > L / 3 + margin && c.xFt < (2 * L) / 3 - margin;
    const insideY = c.yFt > W / 3 + margin && c.yFt < (2 * W) / 3 - margin;
    if (insideX || insideY) {
      // only the paired intersection matters: the strict cell needs BOTH
    }
    if (insideX && insideY) {
      throw new Error(
        `column (${c.xFt.toFixed(2)}, ${c.yFt.toFixed(2)}) lands inside the Brahmasthan cell`,
      );
    }
  }
}

describe("structural engine", () => {
  it("produces a complete result for all three layout modes", () => {
    const layouts = generateLayouts(SAMPLE);
    expect(layouts).toHaveLength(3);
    for (const layout of layouts) {
      const result = runStructural(SAMPLE, layout);
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.pass + result.summary.amber + result.summary.fail).toBe(
        result.summary.total,
      );
      expect(result.members.panels.length).toBeGreaterThan(0);
      expect(result.members.beams.length).toBeGreaterThan(0);
      expect(result.members.columns.length).toBeGreaterThan(0);
      expect(result.summary.fail).toBe(0);
      expect(result.plan.columns.length).toBe(result.members.columns.length);
    }
  });

  it("keeps columns out of the Brahmasthan for every layout", () => {
    const layouts = generateLayouts(SAMPLE);
    for (const layout of layouts) {
      const result = runStructural(SAMPLE, layout);
      assertNoCentralColumn(SAMPLE, result.plan.columns);
    }
  });

  it("a small safe plan passes without autofix conflicts", () => {
    const [layout] = generateLayouts(SMALL);
    const result = runStructural(SMALL, layout);
    expect(result.summary.fail).toBe(0);
    expect(result.ok).toBe(true);
  });

  it("artificially overloading one beam fails it, autofix restores it", () => {
    const [layout] = generateLayouts(SMALL);
    const baseline = runStructural(SMALL, layout);
    const target =
      baseline.plan.beams
        .map((b) => ({
          id: b.id,
          len: baseline.members.beams.find((m) => m.id === b.id)?.member
            .spanM ?? 0,
        }))
        .sort((a, b) => b.len - a.len)[0]?.id ?? "";
    expect(target).not.toBe("");

    const overloaded = runStructural(SMALL, layout, {
      overloadFactor: 6,
      overloadBeamId: target,
    });
    // failed before autofix…
    expect(overloaded.preFixStatus?.[target]).toBe("fail");
    // …and was brought back by the depth/bar ladder
    const fixed = overloaded.members.beams.find((b) => b.id === target);
    expect(fixed?.status).not.toBe("fail");
    expect(overloaded.autoFixLog.some((l) => l.member === target)).toBe(true);
    expect(overloaded.summary.fail).toBe(0);
  });

  it("is deterministic across repeated runs", () => {
    const [layout] = generateLayouts(SMALL);
    const a = JSON.stringify(runStructural(SMALL, layout));
    const b = JSON.stringify(runStructural(SMALL, layout));
    expect(a).toBe(b);
  });

  it("check helpers interpolate clause tables exactly at tabulated points", () => {
    // Table 19 (τc) M20 row: pt 1.0 → 0.62, pt 1.75 → 0.75 (verified table)
    expect(designShearStrength(1.0)).toBeCloseTo(0.62, 6);
    expect(designShearStrength(1.75)).toBeCloseTo(0.75, 6);
    expect(designShearStrength(0.15)).toBeCloseTo(0.28, 6);
    // Table 27 (αx): k = 1.0 → 0.062, k = 2.5 → 0.124 (verified)
    expect(twoWayAlphaX(1.0)).toBeCloseTo(0.062, 6);
    expect(twoWayAlphaX(2.5)).toBeCloseTo(0.124, 6);
  });
});
