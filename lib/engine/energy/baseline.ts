import type {
  DoorMark,
  Layout,
  PlanRoom,
  PlotInput,
  Rect,
  WallSide,
  WindowMark,
} from "../types";
import {
  getRoadWalls,
  innerRect,
  toFeet,
  zoneOfRect,
} from "../vastuGrid";
import type { LayoutMode } from "../types";

/**
 * "Typical plan" model baseline.
 *
 * The same room programme is re-laid in a plain grid: no vastu search, no
 * energy objective, no overhangs, equal windows on every external wall and
 * one door per room with no cross-ventilation planning. This is a MODEL
 * BASELINE produced by the same engine — never a surveyed building.
 */

const EQUAL_WINDOW_WIDTH_FT = 3.5;
const WALL_TOUCH_EPS = 0.75;

function touchesBoundary(
  rect: Rect,
  wall: WallSide,
  lengthFt: number,
  widthFt: number,
): boolean {
  switch (wall) {
    case "W":
      return rect.x <= WALL_TOUCH_EPS;
    case "E":
      return lengthFt - (rect.x + rect.w) <= WALL_TOUCH_EPS;
    case "N":
      return rect.y <= WALL_TOUCH_EPS;
    case "S":
      return widthFt - (rect.y + rect.h) <= WALL_TOUCH_EPS;
  }
}

function wallSpan(rect: Rect, wall: WallSide): number {
  return wall === "N" || wall === "S" ? rect.w : rect.h;
}

function nearestCentreWall(
  rect: Rect,
  lengthFt: number,
  widthFt: number,
): WallSide {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const walls: { wall: WallSide; d: number }[] = [
    { wall: "N", d: Math.hypot(cx - lengthFt / 2, rect.y - widthFt / 2) },
    {
      wall: "S",
      d: Math.hypot(cx - lengthFt / 2, rect.y + rect.h - widthFt / 2),
    },
    { wall: "W", d: Math.hypot(rect.x - lengthFt / 2, cy - widthFt / 2) },
    {
      wall: "E",
      d: Math.hypot(rect.x + rect.w - lengthFt / 2, cy - widthFt / 2),
    },
  ];
  walls.sort((a, b) => a.d - b.d || a.wall.localeCompare(b.wall));
  return walls[0].wall;
}

export function buildBaselineLayout(
  plot: PlotInput,
  referenceLayout: Layout,
): Layout {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);
  const inner = innerRect(plot);
  const rooms = referenceLayout.rooms;
  const count = Math.max(1, rooms.length);
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cellW = inner.w / cols;
  const cellH = inner.h / rows;
  const roadWalls = getRoadWalls(plot.facing);

  const placed: PlanRoom[] = rooms.map((reference, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const rect: Rect = {
      x: inner.x + col * cellW,
      y: inner.y + row * cellH,
      w: cellW,
      h: cellH,
    };

    const windows: WindowMark[] = [];
    for (const wall of ["N", "E", "S", "W"] as WallSide[]) {
      if (!touchesBoundary(rect, wall, lengthFt, widthFt)) continue;
      const span = wallSpan(rect, wall);
      if (span < EQUAL_WINDOW_WIDTH_FT + 1) continue;
      const width = EQUAL_WINDOW_WIDTH_FT;
      windows.push({
        wall,
        at: Math.max(0.5, span / 2 - width / 2),
        width,
      });
    }

    const preferredRoad = roadWalls.find((wall) =>
      touchesBoundary(rect, wall, lengthFt, widthFt),
    );
    const doorWall =
      (reference.type === "parking" || reference.type === "verandah") &&
      preferredRoad
        ? preferredRoad
        : nearestCentreWall(rect, lengthFt, widthFt);
    const span = wallSpan(rect, doorWall);
    const doorWidth = Math.min(3, Math.max(2.4, span * 0.3));
    const doors: DoorMark[] = [
      {
        wall: doorWall,
        at: Math.max(0.5, span / 2 - doorWidth / 2),
        width: doorWidth,
      },
    ];

    return {
      id: reference.id,
      type: reference.type,
      label: reference.label,
      rect,
      zone: zoneOfRect(lengthFt, widthFt, rect),
      doors,
      windows,
    };
  });

  return {
    id: "balanced" as LayoutMode,
    name: "Model baseline (conventional grid)",
    mode: "balanced",
    rooms: placed,
    entrance: referenceLayout.entrance,
    notes: [
      "Model baseline — a plain conventional grid, not a surveyed or benchmarked building.",
      "Equal window width on every external wall; no overhangs; one door per room; no cross-ventilation planning.",
      "All baseline numbers come from the same simplified energy model as the generated layouts.",
    ],
  };
}
