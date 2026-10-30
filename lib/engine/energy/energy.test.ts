import { describe, expect, it } from "vitest";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import type {
  EntranceMark,
  Layout,
  PlanRoom,
  PlotInput,
  WallSide,
  WindowMark,
} from "@/lib/engine/types";
import {
  analyzeEnergy,
  buildBaselineLayout,
  computeSunPath,
  scoreEnergy,
} from "./index";

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

const AHMEDABAD: PlotInput = { ...SAMPLE, city: "ahmedabad" };

function entrance(): EntranceMark {
  return {
    wall: "E",
    at: 5,
    width: 3,
    zone: "E",
    label: "Main door — E facing",
    ruleLabel: "test",
    arrowFrom: { x: 41.4, y: 6.5 },
    source: "test",
    verified: false,
  };
}

function room(
  id: string,
  windows: WindowMark[],
  rect = { x: 10, y: 8, w: 15, h: 12 },
): PlanRoom {
  return {
    id,
    type: "living",
    label: id,
    rect,
    zone: "E",
    doors: [],
    windows,
  };
}

function layout(id: string, rooms: PlanRoom[]): Layout {
  return {
    id: "balanced",
    name: id,
    mode: "balanced",
    rooms,
    entrance: entrance(),
    notes: [],
  };
}

function window(wall: WallSide, at: number, width = 4): WindowMark {
  return { wall, at, width };
}

describe("sun path", () => {
  it("matches the known noon-altitude identity at both solstices", () => {
    const path = computeSunPath(23.26);
    for (const season of ["summer", "winter"] as const) {
      const day = path.days[season];
      const noon = day.points.find((p) => p.hour === 12);
      expect(noon).toBeTruthy();
      const expected = 90 - Math.abs(23.26 - day.declinationDeg);
      expect(noon!.altitudeDeg).toBeCloseTo(expected, 6);
    }
    const equinoxNoon = path.days.equinox.points.find((p) => p.hour === 12)!;
    expect(equinoxNoon.altitudeDeg).toBeCloseTo(
      90 - Math.abs(23.26 - path.days.equinox.declinationDeg),
      6,
    );
  });

  it("has a longer summer day and a lower winter sun", () => {
    const path = computeSunPath(23.26);
    const summer = path.days.summer;
    const winter = path.days.winter;
    expect(summer.sunriseHour!).toBeLessThan(winter.sunriseHour!);
    expect(summer.sunsetHour!).toBeGreaterThan(winter.sunsetHour!);
    expect(summer.maxAltitudeDeg).toBeGreaterThan(winter.maxAltitudeDeg);
  });

  it("is deterministic", () => {
    expect(computeSunPath(23.26)).toEqual(computeSunPath(23.26));
  });
});

describe("window and shading model", () => {
  it("N/E-heavy windows daylight better than W-heavy windows in a hot climate", () => {
    const northEast = analyzeEnergy(
      AHMEDABAD,
      layout("ne", [
        room("ne-room", [window("N", 3), window("E", 4)]),
      ]),
    );
    const west = analyzeEnergy(
      AHMEDABAD,
      layout("west", [
        room("west-room", [window("W", 2), window("W", 7)]),
      ]),
    );
    expect(northEast.rooms[0].daylightScore).toBeGreaterThan(
      west.rooms[0].daylightScore,
    );
  });

  it("an overhang reduces the summer direct-sun exposure", () => {
    const analysis = analyzeEnergy(
      SAMPLE,
      layout("west-shaded", [room("west-shaded-room", [window("W", 4)])]),
    );
    const w = analysis.windows[0];
    expect(w.requiredOverhangFt).toBeGreaterThan(0);
    expect(w.summerWithOverhangExposure).toBeLessThan(w.summerExposure);
    expect(w.overhangReductionPct).toBeGreaterThan(0);
  });

  it("flags single-sided ventilation and accepts an opposite pair", () => {
    const single = analyzeEnergy(
      SAMPLE,
      layout("single", [room("single-room", [window("N", 4)])]),
    );
    expect(single.rooms[0].ventilation.singleSided).toBe(true);
    expect(single.arrows).toHaveLength(1);
    expect(single.arrows[0].kind).toBe("single-sided");

    const cross = analyzeEnergy(
      SAMPLE,
      layout("cross", [
        room("cross-room", [window("N", 3), window("S", 6)]),
      ]),
    );
    expect(cross.rooms[0].ventilation.singleSided).toBe(false);
    expect(cross.rooms[0].ventilation.opposite).toBe(true);
    expect(cross.arrows[0].kind).toBe("cross");
  });
});

describe("energy scoring and baseline", () => {
  const layouts = generateLayouts(SAMPLE);
  const reference = layouts.find((l) => l.id === "balanced") ?? layouts[0];
  const baselineLayout = buildBaselineLayout(SAMPLE, reference);
  const baselineAnalysis = analyzeEnergy(SAMPLE, baselineLayout, {
    baseline: true,
  });

  it("baseline is labelled and assumes no overhangs", () => {
    expect(baselineAnalysis.isBaseline).toBe(true);
    expect(baselineAnalysis.notes[0]).toContain("MODEL BASELINE");
    for (const w of baselineAnalysis.windows) {
      expect(w.requiredOverhangFt).toBe(0);
      expect(w.overhangReductionPct).toBe(0);
    }
  });

  it("returns valid scores for all three layouts and the baseline", () => {
    const baselineResult = scoreEnergy(baselineAnalysis, baselineAnalysis);
    expect(baselineResult.score100).toBeGreaterThanOrEqual(0);
    expect(baselineResult.score100).toBeLessThanOrEqual(100);
    expect(baselineResult.coolingReductionPctVsBaseline).toBe(0);

    for (const layout of layouts) {
      const analysis = analyzeEnergy(SAMPLE, layout);
      const result = scoreEnergy(analysis, baselineAnalysis);
      expect(result.score100).toBeGreaterThanOrEqual(0);
      expect(result.score100).toBeLessThanOrEqual(100);
      expect(result.breakdown).toHaveLength(4);
      expect(result.cooling.annualCoolingKWh).toBeGreaterThan(0);
      expect(Number.isFinite(result.coolingReductionPctVsBaseline)).toBe(true);
      expect(result.solar.annualKWh).toBeGreaterThan(0);
      expect(result.rainwater.annualLitres).toBeGreaterThan(0);
      expect(result.rooms.length).toBe(layout.rooms.length);
    }
  });

  it("is deterministic across repeated runs", () => {
    const first = analyzeEnergy(SAMPLE, reference);
    const second = analyzeEnergy(SAMPLE, reference);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
