import {
  CLIMATE_ENERGY_PROFILES,
  DAYLIGHT_CONFIG,
  WINDOW_CONFIG,
} from "@/lib/data/energy.config";
import type { CityData, PlanRoom } from "../types";
import { rectArea, rectCenter } from "../vastuGrid";
import { clamp } from "./sunPath";
import { windowCenter } from "./ventilation";
import type { DaylightCell, WindowAnalysis } from "./types";

/**
 * Simplified daylight index:
 *   45% WFR vs climate/orientation target
 *   25% orientation usefulness
 *   30% depth ratio vs the 2.5 × window-height rule of thumb
 * The room heatmap is a relative cosine-ish falloff from each window —
 * not a daylight-factor calculation.
 */

export interface RoomDaylightResult {
  score: number;
  heatmapValue: number;
  cells: DaylightCell[];
  effectiveDepthFt: number;
  depthRatio: number;
  wfrPct: number;
  targetWfrPct: number;
}

function oppositeWalls(room: PlanRoom): boolean {
  const walls = new Set(room.windows.map((w) => w.wall));
  return (
    (walls.has("N") && walls.has("S")) || (walls.has("E") && walls.has("W"))
  );
}

function adjacentWalls(room: PlanRoom): boolean {
  const walls = new Set(room.windows.map((w) => w.wall));
  return walls.size >= 2 && !oppositeWalls(room);
}

export function analyzeRoomDaylight(
  room: PlanRoom,
  windows: WindowAnalysis[],
  city: CityData,
): RoomDaylightResult {
  const profile = CLIMATE_ENERGY_PROFILES[city.climateZone];
  const floorArea = rectArea(room.rect);
  const windowArea = windows.reduce((sum, w) => sum + w.areaSqft, 0);
  const wfrPct = floorArea > 0 ? (windowArea / floorArea) * 100 : 0;

  const targetWfrPct =
    windowArea > 0
      ? windows.reduce((sum, w) => sum + w.targetWfrPct * w.areaSqft, 0) /
        windowArea
      : profile.wfrTargetPct;

  if (windows.length === 0) {
    return {
      score: 0,
      heatmapValue: 0,
      cells: buildHeatmap(room, windows, city, 0),
      effectiveDepthFt: 0,
      depthRatio: 0,
      wfrPct,
      targetWfrPct,
    };
  }

  const wfrScore = clamp(
    targetWfrPct > 0 ? (wfrPct / targetWfrPct) * 100 : 100,
    0,
    100,
  );

  const orientationScore = clamp(
    windows.reduce(
      (sum, w) =>
        sum + profile.daylightOrientationFactor[w.orientation] * w.areaSqft,
      0,
    ) / windowArea,
    0,
    1.1,
  ) * 100;

  let minDepth = Infinity;
  for (const w of windows) {
    const depth = w.wall === "N" || w.wall === "S" ? room.rect.h : room.rect.w;
    minDepth = Math.min(minDepth, depth);
  }
  if (!Number.isFinite(minDepth)) minDepth = 0;
  const crossLit = oppositeWalls(room) ? 0.55 : adjacentWalls(room) ? 0.8 : 1;
  const effectiveDepthFt = minDepth * crossLit;
  const depthRatio =
    WINDOW_CONFIG.heightFt > 0 ? effectiveDepthFt / WINDOW_CONFIG.heightFt : 0;
  const depthScore = clamp(
    100 *
      (1 -
        Math.max(0, depthRatio - DAYLIGHT_CONFIG.idealDepthRatio) /
          DAYLIGHT_CONFIG.depthPenaltySpan),
    0,
    100,
  );

  const score = Math.round(
    clamp(
      DAYLIGHT_CONFIG.wfrWeight * wfrScore +
        DAYLIGHT_CONFIG.orientationWeight * orientationScore +
        DAYLIGHT_CONFIG.depthWeight * depthScore,
      0,
      100,
    ),
  );

  const cells = buildHeatmap(room, windows, city, score);
  const heatmapValue =
    cells.length > 0
      ? Math.round(cells.reduce((sum, c) => sum + c.value, 0) / cells.length)
      : 0;

  return {
    score,
    heatmapValue,
    cells,
    effectiveDepthFt,
    depthRatio,
    wfrPct,
    targetWfrPct,
  };
}

function buildHeatmap(
  room: PlanRoom,
  windows: WindowAnalysis[],
  city: CityData,
  daylightScore: number,
): DaylightCell[] {
  const profile = CLIMATE_ENERGY_PROFILES[city.climateZone];
  const floorArea = rectArea(room.rect);
  if (floorArea <= 0) return [];

  const cols = Math.round(
    clamp(
      room.rect.w / DAYLIGHT_CONFIG.heatmapTargetCellFt,
      DAYLIGHT_CONFIG.heatmapMinCols,
      DAYLIGHT_CONFIG.heatmapMaxCols,
    ),
  );
  const rows = Math.round(
    clamp(
      room.rect.h / DAYLIGHT_CONFIG.heatmapTargetCellFt,
      DAYLIGHT_CONFIG.heatmapMinRows,
      DAYLIGHT_CONFIG.heatmapMaxRows,
    ),
  );
  const cw = room.rect.w / cols;
  const ch = room.rect.h / rows;
  const windowsWithCentres = windows.map((w) => ({
    analysis: w,
    centre: windowCenter(room, room.windows[w.index]),
  }));
  const raw: { rect: DaylightCell["rect"]; value: number }[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const rect = {
        x: room.rect.x + col * cw,
        y: room.rect.y + row * ch,
        w: cw,
        h: ch,
      };
      const centre = rectCenter(rect);
      let value = 0;
      for (const item of windowsWithCentres) {
        const d = Math.hypot(centre.x - item.centre.x, centre.y - item.centre.y);
        const decay = Math.max(
          1,
          DAYLIGHT_CONFIG.heatmapDecayWindowHeights * WINDOW_CONFIG.heightFt,
        );
        const orientation = profile.daylightOrientationFactor[
          item.analysis.orientation
        ];
        value +=
          orientation *
          (item.analysis.areaSqft / Math.max(1, floorArea)) *
          Math.exp(-d / decay);
      }
      raw.push({ rect, value });
    }
  }

  const maxRaw = Math.max(...raw.map((r) => r.value), 0);
  if (maxRaw <= 1e-12 || daylightScore <= 0) {
    return raw.map((r) => ({ rect: r.rect, value: 0 }));
  }
  const scale = 0.35 + 0.65 * (daylightScore / 100);
  return raw.map((r) => ({
    rect: r.rect,
    value: Math.round(clamp((r.value / maxRaw) * 100 * scale, 0, 100)),
  }));
}
