import Drawing from "dxf-writer";
import type { PlotInput, Layout, VastuGridCell } from "@/lib/engine/types";
import type { StructuralResult } from "@/lib/engine/structural/types";
import { getProgrammeCoverage } from "./programmeCoverage";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const writerHandle = require("dxf-writer/src/Handle") as { seed: number };

export interface DxfExportInput {
  plot: PlotInput;
  layout: Layout;
  structural: StructuralResult;
  vastuGrid: VastuGridCell[];
  projectName: string;
  vastuScore: number;
  date: string;
}

const FT_TO_MM = 304.8;
const LAYERS: [string, number][] = [
  ["PLOT", 7], ["WALLS", 7], ["ROOMS", 3], ["DOORS_WINDOWS", 5],
  ["COLUMNS", 2], ["BEAMS", 8], ["VASTU_GRID", 8], ["DIMENSIONS", 6], ["TEXT", 7],
];

/**
 * Build a millimetre-based DXF drawing from a layout and its analyses.
 *
 * Use this when exporting the current plan for CAD review. Input plot and
 * layout geometry use feet (plot dimensions may also be provided in metres);
 * generator coordinates start at the north-west and y grows southward, while
 * the exported drawing flips that axis so north is up. Structural overlays
 * are only as reliable as the preliminary, assumption-based structural result
 * supplied to this function.
 */
export function buildDxf(input: DxfExportInput): string {
  // dxf-writer uses a process-wide handle counter. Reset and restore it so
  // repeated calls are deterministic and do not alter the caller's state.
  const previousHandleSeed = writerHandle.seed;
  writerHandle.seed = 0;
  try {
    return generateDxf(input);
  } finally {
    writerHandle.seed = previousHandleSeed;
  }
}

function generateDxf(input: DxfExportInput): string {
  const { plot, layout, structural, vastuGrid } = input;
  const lengthFt = plot.unit === "ft" ? plot.length : plot.length / 0.3048;
  const widthFt = plot.unit === "ft" ? plot.width : plot.width / 0.3048;
  // Generator coordinates start at NW and y increases south. DXF coordinates
  // flip around the north-south plot extent so north is up in the CAD drawing.
  const xy = (xFt: number, yFt: number): [number, number] => [xFt * FT_TO_MM, (widthFt - yFt) * FT_TO_MM];
  const d = new Drawing();
  d.addLineType("DASHED", "Dashed __ __ __", [300, -150]);
  d.setUnits("Millimeters");
  d.header("$INSUNITS", [[70, 4]]);
  for (const [name, color] of LAYERS) d.addLayer(name, color, name === "BEAMS" ? "DASHED" : "CONTINUOUS");
  const poly = (layer: string, pts: [number, number][]) => {
    d.setActiveLayer(layer).drawPolyline(pts, true);
  };
  const line = (layer: string, a: [number, number], b: [number, number]) => {
    d.setActiveLayer(layer).drawLine(a[0], a[1], b[0], b[1]);
  };
  const text = (layer: string, x: number, y: number, height: number, value: string, align: "left" | "center" = "left") => {
    d.setActiveLayer(layer).drawText(x, y, height, 0, value, align, "middle");
  };
  const rectPoints = (x: number, y: number, w: number, h: number): [number, number][] => [
    xy(x, y), xy(x + w, y), xy(x + w, y + h), xy(x, y + h),
  ];
  poly("PLOT", rectPoints(0, 0, lengthFt, widthFt));
  // dxf-writer does not expose entity or layer lineweight; this outer line
  // gives the plot boundary a clear, heavier presentation at 150 mm offset.
  poly("WALLS", rectPoints(-150 / FT_TO_MM, -150 / FT_TO_MM, lengthFt + 300 / FT_TO_MM, widthFt + 300 / FT_TO_MM));

  for (const room of layout.rooms ?? []) {
    const r = room.rect;
    if (!r) continue;
    poly("WALLS", rectPoints(r.x, r.y, r.w, r.h));
    const cx = (r.x + r.w / 2) * FT_TO_MM;
    const cy = (widthFt - (r.y + r.h / 2)) * FT_TO_MM;
    const areaLine = `${(r.w * r.h).toFixed(1)} sq ft`;
    const shortName: Record<string, string> = {
      "Master bedroom": "MBR",
      "Toilet (elderly)/Entrance side)": "Toilet",
      "Staircase (to first floor)": "Stair",
      "Verandah / foyer": "Foyer",
    };
    const nameLine = shortName[room.label] ?? room.label;
    const fits = (value: string, height: number) => value.length * 0.6 * height <= r.w * FT_TO_MM * 0.9;
    const height = [200, 150, 120, 90].find((candidate) =>
      fits(nameLine, candidate) && fits(areaLine, candidate) && candidate * 2 <= r.h * FT_TO_MM
    );
    const labelHeight = height ?? 90;
    const showArea = height !== undefined;
    text("ROOMS", cx, cy + (showArea ? labelHeight / 2 : 0), labelHeight, nameLine, "center");
    if (showArea) text("ROOMS", cx, cy - labelHeight / 2, labelHeight, areaLine, "center");
    for (const mark of room.windows ?? []) {
      const a = wallMark(room, mark.wall, mark.at, widthFt);
      const b = wallMark(room, mark.wall, mark.at + mark.width, widthFt);
      line("DOORS_WINDOWS", a, b);
    }
    for (const mark of room.doors ?? []) {
      line("DOORS_WINDOWS", wallMark(room, mark.wall, mark.at, widthFt), wallMark(room, mark.wall, mark.at + mark.width, widthFt));
    }
  }
  if (layout.entrance) {
    const e = layout.entrance;
    const end = wallMark({ rect: { x: 0, y: 0, w: lengthFt, h: widthFt } }, e.wall, e.at + e.width / 2, widthFt);
    const start = e.arrowFrom ? xy(e.arrowFrom.x, e.arrowFrom.y) : end;
    line("DOORS_WINDOWS", start, end);
    const ang = Math.atan2(end[1] - start[1], end[0] - start[0]);
    for (const a of [ang + 2.55, ang - 2.55]) line("DOORS_WINDOWS", end, [end[0] + 450 * Math.cos(a), end[1] + 450 * Math.sin(a)]);
    text("DOORS_WINDOWS", end[0] + 250, end[1] + 250, 180, "ENTRANCE");
  }
  for (const col of structural.members.columns ?? []) {
    const m = col.member;
    const halfX = m.sizeMm[0] / 2;
    const halfY = m.sizeMm[1] / 2;
    const [cx, cy] = xy(m.xFt, m.yFt);
    poly("COLUMNS", [[cx-halfX, cy-halfY], [cx+halfX, cy-halfY], [cx+halfX, cy+halfY], [cx-halfX, cy+halfY]]);
  }
  for (const beam of structural.plan?.beams ?? []) {
    const a = beam.axis === "x" ? xy(beam.startFt, beam.lineFt) : xy(beam.lineFt, beam.startFt);
    const b = beam.axis === "x" ? xy(beam.endFt, beam.lineFt) : xy(beam.lineFt, beam.endFt);
    line("BEAMS", a, b);
  }
  const centerCell = vastuGrid.find((cell) => cell.zone === "C");
  for (const cell of vastuGrid) {
    const r = cell.rect;
    poly("VASTU_GRID", rectPoints(r.x, r.y, r.w, r.h));
    const p = xy(r.x, r.y);
    text("VASTU_GRID", p[0], p[1], 100, cell.zone);
  }
  if (centerCell) poly("VASTU_GRID", rectPoints(centerCell.rect.x, centerCell.rect.y, centerCell.rect.w, centerCell.rect.h));

  const plotW = lengthFt * FT_TO_MM;
  const plotH = widthFt * FT_TO_MM;
  const dimY = -700;
  const dimX = plotW + 700;
  line("DIMENSIONS", [0, dimY], [plotW, dimY]);
  line("DIMENSIONS", [0, dimY - 180], [0, dimY + 180]);
  line("DIMENSIONS", [plotW, dimY - 180], [plotW, dimY + 180]);
  text("DIMENSIONS", plotW / 2, dimY - 250, 170, `${lengthFt} ft (${plotW.toFixed(0)} mm)`, "center");
  line("DIMENSIONS", [dimX, 0], [dimX, plotH]);
  line("DIMENSIONS", [dimX - 180, 0], [dimX + 180, 0]);
  line("DIMENSIONS", [dimX - 180, plotH], [dimX + 180, plotH]);
  text("DIMENSIONS", dimX + 250, plotH / 2, 170, `${widthFt} ft (${plotH.toFixed(0)} mm)`);

  const northX = plotW + 1700;
  line("TEXT", [northX, plotH - 1000], [northX, plotH - 100]);
  line("TEXT", [northX, plotH - 100], [northX - 180, plotH - 400]);
  line("TEXT", [northX, plotH - 100], [northX + 180, plotH - 400]);
  text("TEXT", northX, plotH - 20, 180, "N", "center");
  const bottom = -1700;
  text("TEXT", 0, bottom, 300, input.projectName);
  text("TEXT", 0, bottom - 360, 200, `Layout: ${layout.name}`);
  const unplaced = getProgrammeCoverage(plot, layout).unplaced;
  if (unplaced.length > 0) {
    text("TEXT", 0, bottom - 500, 200, `Not placed on ground floor: ${unplaced.map((space) => space.label).join(", ")}`);
  }
  text("TEXT", 0, bottom - 620, 200, `Vastu score: ${input.vastuScore}`);
  text("TEXT", 0, bottom - 880, 180, "Preliminary design. Must be verified by a licensed structural engineer.");
  text("TEXT", 0, bottom - 1120, 180, `Date: ${input.date}`);
  text("TEXT", 0, bottom - 1360, 180, "Units: mm");
  return d.toDxfString();
}

function wallMark(room: { rect: { x: number; y: number; w: number; h: number } }, wall: string, at: number, width: number): [number, number] {
  const r = room.rect;
  if (wall === "N") return [(r.x + at) * FT_TO_MM, width * FT_TO_MM - r.y * FT_TO_MM];
  if (wall === "S") return [(r.x + at) * FT_TO_MM, width * FT_TO_MM - (r.y + r.h) * FT_TO_MM];
  if (wall === "W") return [r.x * FT_TO_MM, (width - (r.y + at)) * FT_TO_MM];
  return [(r.x + r.w) * FT_TO_MM, (width - (r.y + at)) * FT_TO_MM];
}
