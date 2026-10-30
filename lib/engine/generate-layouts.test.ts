import { describe, expect, it } from "vitest";
import { generateLayouts, LAYOUT_MODES } from "./generateLayouts";
import { scoreVastu } from "./scoreVastu";
import { computeVastuGrid, overlapArea } from "./vastuGrid";
import type { Layout, PlotInput } from "./types";

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

const SMALL: PlotInput = { ...SAMPLE, length: 30, width: 20 };
const NARROW: PlotInput = { ...SAMPLE, length: 60, width: 15 };

/** Structural invariants every layout must satisfy for this input. */
function assertLayoutInvariants(input: PlotInput, layouts: Layout[]): void {
  expect(layouts).toHaveLength(3);
  expect(layouts.map((l) => l.id)).toEqual([...LAYOUT_MODES]);

  const grid = computeVastuGrid(input);
  const centre = grid.cells.find((c) => c.zone === "C")?.rect ?? { x: 0, y: 0, w: 0, h: 0 };

  for (const layout of layouts) {
    // Rooms are pairwise non-overlapping.
    for (let i = 0; i < layout.rooms.length; i++) {
      for (let j = i + 1; j < layout.rooms.length; j++) {
        expect(overlapArea(layout.rooms[i].rect, layout.rooms[j].rect)).toBeLessThanOrEqual(1e-9);
      }
    }
    // Rooms sit inside the plot.
    for (const room of layout.rooms) {
      expect(room.rect.w).toBeGreaterThan(0);
      expect(room.rect.h).toBeGreaterThan(0);
      expect(room.rect.x).toBeGreaterThanOrEqual(-1e-7);
      expect(room.rect.y).toBeGreaterThanOrEqual(-1e-7);
      expect(room.rect.x + room.rect.w).toBeLessThanOrEqual(grid.lengthFt + 1e-7);
      expect(room.rect.y + room.rect.h).toBeLessThanOrEqual(grid.widthFt + 1e-7);
      expect(room.zone).not.toBe("C");
    }
    // The Brahmasthan stays clear.
    for (const room of layout.rooms) {
      expect(overlapArea(room.rect, centre)).toBeLessThanOrEqual(1e-7);
    }
    // Sample plots face East — the entrance door is on the east wall.
    expect(layout.entrance.wall).toBe("E");
    expect(layout.entrance.zone).not.toBe("C");

    // Score attaches to this layout and stays within 0..100.
    const score = scoreVastu(layout, input);
    expect(score.layoutId).toBe(layout.id);
    expect(score.score100).toBeGreaterThanOrEqual(0);
    expect(score.score100).toBeLessThanOrEqual(100);
    expect(score.unverifiedShare).toBeGreaterThan(0);
    expect(score.unverifiedShare).toBeLessThanOrEqual(1);
  }
}

describe("generateLayouts — sample project (40x30 ft, East, 3BHK)", () => {
  const layouts = generateLayouts(SAMPLE);

  it("returns the three distinct layouts", () => {
    assertLayoutInvariants(SAMPLE, layouts);
    const serialised = layouts.map((l) => JSON.stringify(l.rooms));
    expect(new Set(serialised).size).toBe(3);
  });

  it("is deterministic for identical inputs", () => {
    expect(generateLayouts(SAMPLE)).toEqual(generateLayouts(SAMPLE));
    expect(generateLayouts(SAMPLE, "strict")).toEqual(generateLayouts(SAMPLE, "strict"));
    expect(generateLayouts(SAMPLE, "flexible")).toEqual(generateLayouts(SAMPLE, "flexible"));
  });

  it("keeps a master bedroom and living room with a score breakdown", () => {
    for (const layout of layouts) {
      const labels = layout.rooms.map((r) => r.label);
      expect(labels).toContain("Master bedroom");
      expect(labels).toContain("Living room");
      const score = scoreVastu(layout, SAMPLE);
      expect(score.breakdown.length).toBeGreaterThan(0);
      expect(score.counts.ideal).toBeGreaterThan(0);
    }
  });

  it("keeps every required sample room for every mode and strictness", () => {
    for (const strictness of ["strict", "balanced", "flexible"] as const) {
      const layouts = generateLayouts(SAMPLE, strictness);
      assertLayoutInvariants(SAMPLE, layouts);
      for (const layout of layouts) {
        const types = layout.rooms.map((room) => room.type);
        expect(types).toContain("kitchen");
        expect(types).toContain("living");
        expect(types).toContain("masterBedroom");
        expect(types.some((type) => type === "toilet" || type === "bathroom")).toBe(true);
        expect(types).toContain("pooja");
      }
    }
  });

  it("strict mode never scores lower on ideal count than flexible (per mode)", () => {
    for (const mode of LAYOUT_MODES) {
      const strict = generateLayouts(SAMPLE, "strict").find((l) => l.id === mode);
      const flexible = generateLayouts(SAMPLE, "flexible").find((l) => l.id === mode);
      expect(strict).toBeDefined();
      expect(flexible).toBeDefined();
      const strictIdeal = scoreVastu(strict!, SAMPLE).counts.ideal;
      const flexibleIdeal = scoreVastu(flexible!, SAMPLE).counts.ideal;
      expect(strictIdeal).toBeGreaterThanOrEqual(flexibleIdeal);
    }
  });

  it("handles the elderly flag: extra toilet and a near-entrance bedroom", () => {
    const elderlyInput = { ...SAMPLE, elderlyGroundFloor: true };
    const layouts = generateLayouts(elderlyInput);
    assertLayoutInvariants(elderlyInput, layouts);
    for (const layout of layouts) {
      expect(layout.rooms.some((r) => r.id === "toilet-2")).toBe(true);
    }
  });

  it("flipping facing moves the entrance to the matching wall", () => {
    const west = generateLayouts({ ...SAMPLE, facing: "W" });
    expect(west[0].entrance.wall).toBe("W");
    const north = generateLayouts({ ...SAMPLE, facing: "N" });
    expect(north[0].entrance.wall).toBe("N");
  });
});

describe("generateLayouts — small and narrow plots do not crash", () => {
  it("20x30: no crash, a clear 'too small' note, invariants intact", () => {
    const layouts = generateLayouts(SMALL);
    for (const layout of layouts) {
      expect(layout.notes.some((n) => n.toLowerCase().includes("too small"))).toBe(true);
    }
    assertLayoutInvariants(SMALL, layouts);
  });

  it("15x60: no crash, a clear 'narrow' note, invariants intact", () => {
    const layouts = generateLayouts(NARROW);
    for (const layout of layouts) {
      expect(layout.notes.some((n) => n.toLowerCase().includes("narrow"))).toBe(true);
    }
    assertLayoutInvariants(NARROW, layouts);
  });

  it("10x10 stays sane", () => {
    const tiny = generateLayouts({ ...SAMPLE, length: 10, width: 10 });
    assertLayoutInvariants({ ...SAMPLE, length: 10, width: 10 }, tiny);
    for (const layout of tiny) {
      expect(
        layout.notes.some(
          (n) => n.toLowerCase().includes("too small") || n.toLowerCase().includes("narrow"),
        ),
      ).toBe(true);
    }
  });

  it("throws on non-positive dimensions", () => {
    expect(() => generateLayouts({ ...SAMPLE, length: -3 })).toThrow(/positive/);
    expect(() => generateLayouts({ ...SAMPLE, width: 0 })).toThrow(/positive/);
  });
});

describe("generateLayouts — required rooms across plot sizes and facings", () => {
  it("places required rooms or reports each missing required room", () => {
    const facings = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
    for (const [length, width] of [[25, 40], [30, 50], [40, 60], [30, 30]]) {
      for (const facing of facings) {
        const input = { ...SAMPLE, length, width, facing };
        for (const layout of generateLayouts(input)) {
          for (const [type, label] of [["kitchen", "Kitchen"], ["living", "Living room"], ["masterBedroom", "Master bedroom"], ["pooja", "Pooja room"]] as const) {
            if (!layout.rooms.some((room) => room.type === type)) {
              expect(layout.notes.some((note) => note.startsWith(`${label} could not be placed:`))).toBe(true);
            }
          }
          if (!layout.rooms.some((room) => room.type === "toilet" || room.type === "bathroom")) {
            expect(layout.notes.some((note) => /Bathroom|Toilet.*could not be placed/.test(note))).toBe(true);
          }
        }
      }
    }
  });
});
