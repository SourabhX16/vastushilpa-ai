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
  endPoint?: { x: number; y: number };
  textHeight?: number;
  lineType?: string;
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
      expect(walls).toHaveLength(layout.rooms.length + 1);
      const boxes: { left: number; right: number; bottom: number; top: number }[] = [];
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
        const shortName: Record<string, string> = { "Master bedroom": "MBR", "Toilet (elderly)/Entrance side)": "Toilet", "Staircase (to first floor)": "Stair", "Verandah / foyer": "Foyer" };
        const name = shortName[room.label] ?? room.label;
        const area = `${(room.rect.w * room.rect.h).toFixed(1)} sq ft`;
        const centerX = (room.rect.x + room.rect.w / 2) * 304.8;
        const centerY = (30 - room.rect.y - room.rect.h / 2) * 304.8;
        const position = (e: ParsedEntity) => e.endPoint ?? e.startPoint!;
        const closest = (value: string) => roomTexts.filter((e) => e.text === value)
          .sort((a, b) => Math.hypot(position(a).x - centerX, position(a).y - centerY) - Math.hypot(position(b).x - centerX, position(b).y - centerY))[0];
        const nameText = closest(name);
        const possibleArea = closest(area);
        const areaText = possibleArea && Math.hypot(position(possibleArea).x - centerX, position(possibleArea).y - centerY) < Math.min(room.rect.w, room.rect.h) * 304.8 / 2 ? possibleArea : undefined;
        expect(nameText).toBeTruthy();
        const rect = { left: room.rect.x * 304.8, right: (room.rect.x + room.rect.w) * 304.8, bottom: (30 - room.rect.y - room.rect.h) * 304.8, top: (30 - room.rect.y) * 304.8 };
        for (const entity of [nameText!, ...(areaText ? [areaText] : [])]) {
          const p = position(entity), h = entity.textHeight!, half = (entity.text ?? "").length * 0.6 * h / 2;
          expect(p.x - half).toBeGreaterThanOrEqual(rect.left - 0.01);
          expect(p.x + half).toBeLessThanOrEqual(rect.right + 0.01);
          expect(p.y - h / 2).toBeGreaterThanOrEqual(rect.bottom - 0.01);
          expect(p.y + h / 2).toBeLessThanOrEqual(rect.top + 0.01);
          boxes.push({ left: p.x - half, right: p.x + half, bottom: p.y - h / 2, top: p.y + h / 2 });
        }
      }
      expect(roomTexts.length).toBe(boxes.length);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.right <= b.left || b.right <= a.left || a.top <= b.bottom || b.top <= a.bottom).toBe(true);
      }
      expect((dxf.tables.layer.layers.BEAMS as unknown as { lineType: string }).lineType).toBe("DASHED");
      const columns = polylines.filter((e) => e.layer === "COLUMNS");
      expect(columns).toHaveLength(structural.members.columns.length);
      expect(columns.every((e) => e.shape && e.vertices?.length === 4)).toBe(true);

      // Verify north-up using the north edge of the plot and the most northern room label.
      expect(Math.max(...ys)).toBeCloseTo(9144, 0);
      const northRoom = [...layout.rooms].sort((a, b) => a.rect.y - b.rect.y)[0];
      const southRoom = [...layout.rooms].sort((a, b) => b.rect.y - a.rect.y)[0];
      const northLabel = roomTexts.find((e) => e.text === (northRoom.label === "Master bedroom" ? "MBR" : northRoom.label));
      const southLabel = roomTexts.find((e) => e.text === (southRoom.label === "Master bedroom" ? "MBR" : southRoom.label));
      expect((northLabel!.endPoint ?? northLabel!.startPoint)!.y).toBeGreaterThan((southLabel!.endPoint ?? southLabel!.startPoint)!.y);

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
