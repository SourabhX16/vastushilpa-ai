import { describe, expect, it } from "vitest";
import DxfParser from "dxf-parser";
import { buildDxf } from "./dxf";
import { generateLayouts } from "@/lib/engine/generateLayouts";
import { computeVastuGrid } from "@/lib/engine/vastuGrid";
import { runStructural } from "@/lib/engine/structural";
import { scoreVastu } from "@/lib/engine/scoreVastu";
import { getProgrammeCoverage } from "./programmeCoverage";
import type { PlotInput } from "@/lib/engine/types";

const SAMPLE: PlotInput = {
  length: 40, width: 30, unit: "ft", facing: "E", city: "bhopal",
  buildingType: "residential", bedrooms: 3, poojaRoom: true, parking: true, elderlyGroundFloor: false,
};
const parser = new DxfParser();
const layers = ["PLOT", "WALLS", "ROOMS", "DOORS_WINDOWS", "COLUMNS", "BEAMS", "VASTU_GRID", "DIMENSIONS", "TEXT"];
interface ParsedEntity {
  type: string;
  layer?: string;
  vertices?: { x: number; y: number }[];
  shape?: boolean;
  text?: string;
  startPoint?: { x: number; y: number };
}
const isPolyline = (e: ParsedEntity) => e.type === "POLYLINE" || e.type === "LWPOLYLINE";

describe("DXF export", () => {
  for (const layout of generateLayouts(SAMPLE, "balanced")) {
    it(`exports ${layout.id} deterministically with validated geometry`, () => {
      const structural = runStructural(SAMPLE, layout);
      const score = scoreVastu(layout, SAMPLE).score100;
      const input = {
        plot: SAMPLE,
        layout,
        structural,
        vastuGrid: computeVastuGrid(SAMPLE).cells,
        projectName: "Sample 3BHK Bhopal",
        vastuScore: score,
        date: "2026-10-30",
      };
      const output = buildDxf(input);
      expect(output).toBe(buildDxf(input));
      const dxf = parser.parseSync(output);
      expect(dxf).toBeTruthy();
      if (!dxf) throw new Error("DXF parser returned no document");
      expect(dxf.header.$INSUNITS).toBe(4);
      for (const name of layers) expect(dxf.tables.layer.layers[name]).toBeTruthy();

      const entities = dxf.entities as unknown as ParsedEntity[];
      const polylines = entities.filter(isPolyline);
      const plot = polylines.find((e) => e.layer === "PLOT");
      expect(plot).toBeTruthy();
      expect(plot!.shape).toBe(true);
      expect(plot!.vertices).toHaveLength(4);
      const xs = plot!.vertices!.map((v) => v.x);
      const ys = plot!.vertices!.map((v) => v.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12192, 0);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(9144, 0);

      const walls = polylines.filter((e) => e.layer === "WALLS");
      const roomTexts = entities.filter((e) => e.type === "TEXT" && e.layer === "ROOMS");
      expect(walls).toHaveLength(layout.rooms.length);
      expect(roomTexts).toHaveLength(layout.rooms.length);
      for (const room of layout.rooms) {
        const wall = walls.find((e) => {
          if (!e.vertices) return false;
          const vx = e.vertices.map((v) => v.x);
          const vy = e.vertices.map((v) => v.y);
          return Math.abs(Math.min(...vx) - room.rect.x * 304.8) < 1 &&
            Math.abs(Math.max(...vx) - (room.rect.x + room.rect.w) * 304.8) < 1 &&
            Math.abs(Math.max(...vy) - (30 - room.rect.y) * 304.8) < 1 &&
            Math.abs(Math.min(...vy) - (30 - room.rect.y - room.rect.h) * 304.8) < 1;
        });
        expect(wall).toBeTruthy();
        expect(wall!.shape).toBe(true);
        const label = roomTexts.find((e) => e.text?.includes(room.label));
        expect(label).toBeTruthy();
        expect(label!.text).toContain("sq ft");
      }
      const columns = polylines.filter((e) => e.layer === "COLUMNS");
      expect(columns).toHaveLength(structural.members.columns.length);
      expect(columns.every((e) => e.shape && e.vertices?.length === 4)).toBe(true);

      // Verify north-up using the north edge of the plot and the most northern room label.
      expect(Math.max(...ys)).toBeCloseTo(9144, 0);
      const northRoom = [...layout.rooms].sort((a, b) => a.rect.y - b.rect.y)[0];
      const southRoom = [...layout.rooms].sort((a, b) => b.rect.y - a.rect.y)[0];
      const northLabel = roomTexts.find((e) => e.text?.includes(northRoom.label));
      const southLabel = roomTexts.find((e) => e.text?.includes(southRoom.label));
      expect(northLabel!.startPoint!.y).toBeGreaterThan(southLabel!.startPoint!.y);

      const allNumbers: number[] = [];
      const collect = (value: unknown): void => {
        if (typeof value === "number") allNumbers.push(value);
        else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
      };
      collect(entities);
      expect(allNumbers.every(Number.isFinite)).toBe(true);
      const textLayer = entities.filter((e) => e.type === "TEXT" && e.layer === "TEXT").map((e) => e.text ?? "");
      expect(textLayer.some((value) => value.includes(`Vastu score: ${score}`))).toBe(true);
      const missing = getProgrammeCoverage(SAMPLE, layout).unplaced.map((space) => space.label).join(", ");
      expect(textLayer).toContain(`Not placed on ground floor: ${missing}`);
      expect(textLayer.some((value) => value.includes("Preliminary design. Must be verified by a licensed structural engineer."))).toBe(true);
    });
  }

  it("omits the title-block omission line when all requested spaces fit", () => {
    const plot: PlotInput = { ...SAMPLE, length: 40, width: 60 };
    const layout = generateLayouts(plot, "balanced").find((item) => item.id === "balanced")!;
    const output = buildDxf({
      plot,
      layout,
      structural: runStructural(plot, layout),
      vastuGrid: computeVastuGrid(plot).cells,
      projectName: "Large plot",
      vastuScore: scoreVastu(layout, plot).score100,
      date: "2026-10-30",
    });
    const dxf = parser.parseSync(output);
    expect(dxf).toBeTruthy();
    const textLayer = (dxf!.entities as unknown as ParsedEntity[])
      .filter((entity) => entity.type === "TEXT" && entity.layer === "TEXT")
      .map((entity) => entity.text ?? "");
    expect(textLayer.some((value) => value.startsWith("Not placed on ground floor:"))).toBe(false);
  });
});
