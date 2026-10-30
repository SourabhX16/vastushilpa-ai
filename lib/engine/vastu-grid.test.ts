import { describe, expect, it } from "vitest";
import { computeVastuGrid, zoneOfRect, roadAdjacentZones } from "./vastuGrid";
import type { PlotInput, Rect } from "./types";

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

describe("computeVastuGrid", () => {
  const grid = computeVastuGrid(SAMPLE);

  it("splits into the nine named zones row-major from NW", () => {
    expect(grid.cells.map((c) => c.zone)).toEqual([
      "NW", "N", "NE",
      "W", "C", "E",
      "SW", "S", "SE",
    ]);
  });

  it("uses exact cell rectangles over the full plot", () => {
    const cells = grid.cells;
    expect(cells[0].rect).toEqual({ x: 0, y: 0, w: 40 / 3, h: 10 });
    // North row: y from 0, NE ends at x = length.
    expect(cells[2].rect.x + cells[2].rect.w).toBeCloseTo(40, 6);
    // Centre cell = Brahmasthan spans [L/3, 2L/3] x [W/3, 2W/3].
    expect(cells[4].rect).toEqual({ x: 40 / 3, y: 10, w: 40 / 3, h: 10 });
    // South row ends at the plot edge.
    expect(cells[8].rect.y + cells[8].rect.h).toBeCloseTo(30, 6);
  });

  it("produces 81 pada rectangles (1x length/9 by width/9)", () => {
    expect(grid.padas).toHaveLength(81);
    const first = grid.padas[0];
    expect(first).toEqual({ x: 0, y: 0, w: 40 / 9, h: 30 / 9 });
  });

  it("zoneOfRect attributes a room by the largest-overlap zone", () => {
    const rect: Rect = { x: 30, y: 20, w: 8, h: 8 }; // SE side of the plot
    expect(zoneOfRect(40, 30, rect)).toBe("SE");
    expect(zoneOfRect(40, 30, { x: 0, y: 0, w: 10, h: 10 })).toBe("NW");
  });

  it("road-adjacent zones for East facing are NE/E/SE", () => {
    expect(roadAdjacentZones("E")).toEqual(["NE", "E", "SE"]);
    expect(roadAdjacentZones("N")).toEqual(["NW", "N", "NE"]);
  });
});
