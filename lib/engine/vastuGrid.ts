import { ROAD_WALLS } from "../data/vastu.config";
import type {
  PlotFacing,
  PlotInput,
  Rect,
  VastuGrid,
  VastuGridCell,
  VastuZoneId,
  WallSide,
} from "./types";

/**
 * Vastu grid geometry — the shared coordinate system of the whole engine
 * and every plan view in the UI.
 *
 * AXIS CONVENTION (identical to the plot preview, see it in
 * components/wizard/plot-preview.tsx):
 *   - The plot is drawn NORTH-UP.
 *   - x runs WEST → EAST. It carries `PlotInput.length`, the plot's
 *     EAST-WEST extent (the horizontal axis of the preview).
 *   - y runs NORTH → SOUTH. It carries `PlotInput.width`, the plot's
 *     NORTH-SOUTH extent (the vertical axis of the preview; y grows
 *     downward, matching screen/SVG space).
 *   - Origin (0,0) is the NORTH-WEST corner. East-facing plots put the
 *     road on the x = length edge.
 *   - Neither dimension is required to be the longer one.
 * All engine geometry is in feet (metric input is converted).
 */

const METRES_PER_FOOT = 0.3048;

export function toFeet(value: number, unit: PlotInput["unit"]): number {
  return unit === "ft" ? value : value / METRES_PER_FOOT;
}

/**
 * Half of the assumed 9" (0.75 ft) perimeter wall: rooms live inside this
 * inset so drawn walls straddle the room boundary. Interior walls are
 * drawn by the renderer, not assumed by the engine.
 */
export const WALL_HALF_FT = 0.375;

/** Zone names row-major from the NW corner. Row 0 is the north row. */
export const ZONES_3X3: VastuZoneId[][] = [
  ["NW", "N", "NE"],
  ["W", "C", "E"],
  ["SW", "S", "SE"],
];

export const ALL_ZONES: VastuZoneId[] = ZONES_3X3.flat();

export function isCentre(zone: VastuZoneId): boolean {
  return zone === "C";
}

/** Inset "usable" area of the plot (inside the perimeter walls), feet. */
export function innerRect(plot: PlotInput): Rect {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);
  return {
    x: WALL_HALF_FT,
    y: WALL_HALF_FT,
    w: Math.max(0, lengthFt - 2 * WALL_HALF_FT),
    h: Math.max(0, widthFt - 2 * WALL_HALF_FT),
  };
}

/**
 * The exact 3x3 zone grid over the FULL plot plus a 9x9 pada grid for
 * display only. Three-way splits use exact floating thirds — the middle
 * column/row is always [L/3, 2L/3] x [W/3, 2W/3] (the Brahmasthan).
 */
export function computeVastuGrid(plot: PlotInput): VastuGrid {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);

  const cells: VastuGridCell[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        zone: ZONES_3X3[row][col],
        rect: {
          x: (col * lengthFt) / 3,
          y: (row * widthFt) / 3,
          w: lengthFt / 3,
          h: widthFt / 3,
        },
      });
    }
  }

  const padas: Rect[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      padas.push({
        x: (col * lengthFt) / 9,
        y: (row * widthFt) / 9,
        w: lengthFt / 9,
        h: widthFt / 9,
      });
    }
  }

  return { lengthFt, widthFt, cells, padas };
}

export function cellRectForZone(
  grid: VastuGrid,
  zone: VastuZoneId,
): Rect {
  const cell = grid.cells.find((c) => c.zone === zone);
  if (!cell) throw new Error(`Unknown zone ${zone}`);
  return cell.rect;
}

/** Zone a point falls into (points on shared edges fall to the E/S cell). */
export function zoneOfPoint(
  lengthFt: number,
  widthFt: number,
  px: number,
  py: number,
): VastuZoneId {
  const cl = Math.min(2, Math.max(0, Math.floor((px * 3) / lengthFt)));
  const clampedX = px >= lengthFt ? 2 : cl;
  const row = Math.min(2, Math.max(0, Math.floor((py * 3) / widthFt)));
  const clampedY = py >= widthFt ? 2 : row;
  return ZONES_3X3[clampedY][clampedX];
}

/**
 * The primary zone of a rectangle: the zone with the largest overlap area
 * (ties broken by the fixed row-major zone order, keeping output
 * deterministic).
 */
export function zoneOfRect(
  lengthFt: number,
  widthFt: number,
  rect: Rect,
): VastuZoneId {
  const cells = ZONES_3X3.flatMap((rowZones, row) =>
    rowZones.map((zone, col) => ({
      zone,
      rect: {
        x: (col * lengthFt) / 3,
        y: (row * widthFt) / 3,
        w: lengthFt / 3,
        h: widthFt / 3,
      },
    })),
  );
  let best: VastuZoneId = "C";
  let bestOverlap = -1;
  for (const cell of cells) {
    const overlap = overlapArea(rect, cell.rect);
    if (overlap > bestOverlap + 1e-9) {
      bestOverlap = overlap;
      best = cell.zone;
    }
  }
  return best;
}

/* ----------------------------- rect helpers ----------------------------- */

export function rectArea(r: Rect): number {
  return r.w * r.h;
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - 1e-9 &&
    b.x < a.x + a.w - 1e-9 &&
    a.y < b.y + b.h - 1e-9 &&
    b.y < a.y + a.h - 1e-9
  );
}

export function overlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export function rectInside(inner: Rect, candidate: Rect): boolean {
  return (
    candidate.x >= inner.x - 1e-9 &&
    candidate.y >= inner.y - 1e-9 &&
    candidate.x + candidate.w <= inner.x + inner.w + 1e-9 &&
    candidate.y + candidate.h <= inner.y + inner.h + 1e-9
  );
}

/**
 * Intersect `base` with `cut`: returns up to 4 leftover rectangles that
 * partition base minus cut (empty list when cut swallows base).
 */
export function subtractRect(base: Rect, cut: Rect): Rect[] {
  const parts: Rect[] = [];
  const x2 = Math.max(base.x, cut.x);
  const x1end = Math.min(base.x + base.w, cut.x + cut.w);
  const y2 = Math.max(base.y, cut.y);
  const y1end = Math.min(base.y + base.h, cut.y + cut.h);
  // No overlap → base survives whole.
  if (x2 >= x1end || y2 >= y1end) return [base];
  // Top strip
  if (cut.y > base.y + 1e-9) {
    parts.push({ x: base.x, y: base.y, w: base.w, h: cut.y - base.y });
  }
  // Bottom strip
  if (base.y + base.h > cut.y + cut.h + 1e-9) {
    parts.push({
      x: base.x,
      y: cut.y + cut.h,
      w: base.w,
      h: base.y + base.h - (cut.y + cut.h),
    });
  }
  // Left strip (between top and bottom strips)
  if (cut.x > base.x + 1e-9) {
    parts.push({
      x: base.x,
      y: y2,
      w: cut.x - base.x,
      h: y1end - y2,
    });
  }
  // Right strip
  if (base.x + base.w > cut.x + cut.w + 1e-9) {
    parts.push({
      x: cut.x + cut.w,
      y: y2,
      w: base.x + base.w - (cut.x + cut.w),
      h: y1end - y2,
    });
  }
  return parts.filter((p) => p.w > 1e-9 && p.h > 1e-9);
}

/** Subtract every cut from base (used to track free rectangles per zone). */
export function subtractAll(base: Rect, cuts: Rect[]): Rect[] {
  let free: Rect[] = [base];
  for (const cut of cuts) {
    const next: Rect[] = [];
    for (const piece of free) next.push(...subtractRect(piece, cut));
    free = next;
    if (free.length === 0) return free;
  }
  return free;
}

/* --------------------------- facing helpers --------------------------- */

/** Perimeter walls that touch the road for a facing. */
export function getRoadWalls(facing: PlotFacing): WallSide[] {
  return ROAD_WALLS[facing];
}

/** The 3x3 zones adjacent to any road-facing wall for the facing. */
export function roadAdjacentZones(facing: PlotFacing): VastuZoneId[] {
  const walls = getRoadWalls(facing);
  const result: VastuZoneId[] = [];
  for (const zone of ALL_ZONES) {
    const col = zoneCol(zone);
    const row = Math.floor(ALL_ZONES.indexOf(zone) / 3);
    const touches = walls.some(
      (wall) =>
        (wall === "N" && row === 0) ||
        (wall === "S" && row === 2) ||
        (wall === "E" && col === 2) ||
        (wall === "W" && col === 0),
    );
    if (touches) result.push(zone);
  }
  return result;
}

export function zoneCol(zone: VastuZoneId): number {
  return ALL_ZONES.indexOf(zone) % 3;
}
