import { VENTILATION_CONFIG, WIND_FROM_DEGREES } from "@/lib/data/energy.config";
import type {
  CityData,
  PlanRoom,
  Rect,
  WallSide,
} from "../types";
import { rectCenter } from "../vastuGrid";
import { WALL_AZIMUTH_DEG, clamp, norm360 } from "./sunPath";
import type {
  Orientation8,
  VentilationAlignment,
  VentilationArrow,
  VentilationArrowKind,
  VentilationDetail,
  WindowAnalysis,
} from "./types";

const DEG = Math.PI / 180;

export function parseOrientation(value: string): Orientation8 {
  const key = value.trim().toUpperCase();
  const valid: Orientation8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return (valid.find((v) => v === key) ?? "W") as Orientation8;
}

export function windowCenter(
  room: PlanRoom,
  window: { wall: WallSide; at: number; width: number },
): { x: number; y: number } {
  const r = room.rect;
  switch (window.wall) {
    case "N":
      return { x: r.x + window.at + window.width / 2, y: r.y };
    case "S":
      return { x: r.x + window.at + window.width / 2, y: r.y + r.h };
    case "E":
      return { x: r.x + r.w, y: r.y + window.at + window.width / 2 };
    case "W":
      return { x: r.x, y: r.y + window.at + window.width / 2 };
  }
}

function isOpposite(a: WallSide, b: WallSide): boolean {
  return (
    (a === "N" && b === "S") ||
    (a === "S" && b === "N") ||
    (a === "E" && b === "W") ||
    (a === "W" && b === "E")
  );
}

function dotFromWind(window: WindowAnalysis, windFromDeg: number): number {
  const normal = WALL_AZIMUTH_DEG[window.wall];
  return Math.cos(norm360(normal - windFromDeg) * DEG);
}

function flowAlignment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  windToDeg: number,
): { dot: number; label: VentilationAlignment } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { dot: 0, label: "opposed" };
  // Plan coordinates: x east, y south. Convert to compass (north-up).
  const flowDeg = norm360((Math.atan2(dx, -dy) * 180) / Math.PI);
  const dot = Math.cos(norm360(flowDeg - windToDeg) * DEG);
  if (dot >= VENTILATION_CONFIG.flowAlignedDot) {
    return { dot, label: "aligned" };
  }
  if (dot > 0) return { dot, label: "partial" };
  return { dot, label: "opposed" };
}

export interface RoomVentilationResult {
  detail: VentilationDetail;
  score: number;
  arrow: VentilationArrow | null;
}

export function analyzeRoomVentilation(
  room: PlanRoom,
  windows: WindowAnalysis[],
  city: CityData,
): RoomVentilationResult {
  const windFrom = parseOrientation(city.prevailingWind);
  const windFromDeg = WIND_FROM_DEGREES[windFrom];
  const windToDeg = norm360(windFromDeg + 180);
  const openingWalls = Array.from(
    new Set(windows.map((w) => w.wall)),
  ) as WallSide[];
  const windowCount = windows.length;
  const windAligned =
    windows.length > 0 &&
    windows.some(
      (w) =>
        dotFromWind(w, windFromDeg) >=
        Math.cos(VENTILATION_CONFIG.windToleranceDeg * DEG),
    );

  let opposite = false;
  let adjacent = false;
  for (let i = 0; i < openingWalls.length; i++) {
    for (let j = i + 1; j < openingWalls.length; j++) {
      if (isOpposite(openingWalls[i], openingWalls[j])) opposite = true;
      else adjacent = true;
    }
  }
  const singleSided = openingWalls.length <= 1;

  let bestPair: {
    a: number;
    b: number;
    score: number;
    dot: number;
  } | null = null;

  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (windows[i].wall === windows[j].wall) continue;
      const opp = isOpposite(windows[i].wall, windows[j].wall);
      let score = opp
        ? VENTILATION_CONFIG.oppositeScore
        : VENTILATION_CONFIG.adjacentScore;
      if (windAligned) score += VENTILATION_CONFIG.windAlignedBonus;
      const centerA = windowCenter(room, room.windows[windows[i].index]);
      const centerB = windowCenter(room, room.windows[windows[j].index]);
      const flowDot = flowAlignment(centerA, centerB, windToDeg).dot;
      if (flowDot >= VENTILATION_CONFIG.flowAlignedDot) {
        score += VENTILATION_CONFIG.flowAlignedBonus;
      }
      if (!bestPair || score > bestPair.score + 1e-9) {
        bestPair = { a: i, b: j, score, dot: flowDot };
      }
    }
  }

  let score = 0;
  let arrow: VentilationArrow | null = null;
  let flowAligned = false;

  if (windows.length === 0) {
    score = 0;
  } else if (!bestPair) {
    score = VENTILATION_CONFIG.singleSidedScore;
    if (windAligned) score += VENTILATION_CONFIG.windAlignedBonus;
    score = clamp(score, 0, 100);

    const window = windows[0];
    const from = windowCenter(room, room.windows[window.index]);
    const centre = rectCenter(room.rect);
    const to =
      Math.abs(from.x - centre.x) + Math.abs(from.y - centre.y) < 1e-9
        ? interiorPoint(room.rect, window.wall)
        : centre;
    flowAligned =
      flowAlignment(from, to, windToDeg).dot >=
      VENTILATION_CONFIG.flowAlignedDot;
    arrow = {
      roomId: room.id,
      roomLabel: room.label,
      from,
      to,
      kind: "single-sided" as VentilationArrowKind,
      alignment: flowAlignment(from, to, windToDeg).label,
    };
  } else {
    score = bestPair.score;
    if (windAligned) score = Math.max(score, VENTILATION_CONFIG.adjacentScore + 5);
    score = clamp(score, 0, 100);

    const first = windows[bestPair.a];
    const second = windows[bestPair.b];
    const firstWind = dotFromWind(first, windFromDeg);
    const secondWind = dotFromWind(second, windFromDeg);
    const inlet = firstWind >= secondWind ? first : second;
    const outlet = inlet === first ? second : first;
    const from = windowCenter(room, room.windows[inlet.index]);
    const to = windowCenter(room, room.windows[outlet.index]);
    const alignment = flowAlignment(from, to, windToDeg);
    flowAligned = alignment.label === "aligned";
    arrow = {
      roomId: room.id,
      roomLabel: room.label,
      from,
      to,
      kind: "cross",
      alignment: alignment.label,
    };
  }

  const notes = buildNotes({
    windowCount,
    openingWalls,
    singleSided,
    opposite,
    adjacent,
    windAligned,
    flowAligned,
    wind: windFrom,
    baseline: false,
  });

  return {
    detail: {
      openingWalls,
      windowCount,
      crossVentilated: !singleSided,
      opposite,
      adjacent,
      singleSided,
      windAligned,
      flowAligned,
      notes,
    },
    score,
    arrow,
  };
}

function interiorPoint(rect: Rect, wall: WallSide): { x: number; y: number } {
  switch (wall) {
    case "N":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.35 };
    case "S":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.65 };
    case "E":
      return { x: rect.x + rect.w * 0.65, y: rect.y + rect.h / 2 };
    case "W":
      return { x: rect.x + rect.w * 0.35, y: rect.y + rect.h / 2 };
  }
}

function buildNotes(input: {
  windowCount: number;
  openingWalls: WallSide[];
  singleSided: boolean;
  opposite: boolean;
  adjacent: boolean;
  windAligned: boolean;
  flowAligned: boolean;
  wind: Orientation8;
  baseline: boolean;
}): string {
  if (input.windowCount === 0) {
    return "No window openings in the model — no cross-ventilation is possible.";
  }
  if (input.singleSided) {
    return `Single-sided ventilation: all modelled windows are on the ${input.openingWalls.join("/")} wall. No through-draught is represented.`;
  }
  const pair = input.opposite
    ? "opposite walls"
    : input.adjacent
      ? "adjacent walls"
      : "different walls";
  const wind = input.windAligned
    ? `an opening faces the ${input.wind} prevailing wind`
    : `no opening squarely faces the ${input.wind} prevailing wind`;
  const flow = input.flowAligned
    ? "the inlet→outlet path follows the wind flow"
    : "the inlet→outlet path does not follow the wind flow";
  return `Cross-ventilated across ${pair}; ${wind} and ${flow}.`;
}

export type { VentilationDetail };
