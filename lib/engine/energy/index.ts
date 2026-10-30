import { getCityById } from "@/lib/data/cities";
import {
  CLIMATE_ENERGY_PROFILES,
  COOLING_CONFIG,
  ENERGY_ASSUMPTIONS,
  ROOM_DAYLIGHT_WEIGHTS,
  ROOM_ENERGY_WEIGHTS,
} from "@/lib/data/energy.config";
import type { Layout, PlotInput } from "../types";
import { rectArea } from "../vastuGrid";
import { analyzeCooling } from "./cooling";
import { analyzeRoomDaylight } from "./daylight";
import { buildRecommendations } from "./recommendations";
import { clamp, computeSunPath } from "./sunPath";
import { analyzeRoomVentilation } from "./ventilation";
import {
  analyzeWindows,
  dominantOrientation,
  windowsByRoom,
} from "./windows";
import type {
  EnergyAnalysis,
  EnergyOptions,
  RoomEnergy,
  VentilationArrow,
  WindowAnalysis,
} from "./types";

export type {
  DaylightCell,
  EnergyAnalysis,
  EnergyOptions,
  EnergyResult,
  EnergyScoreBreakdown,
  PassiveRecommendation,
  RainwaterEstimate,
  Season,
  SolarPotential,
  SunPathDay,
  SunPathResult,
  VentilationArrow,
  WindowAnalysis,
} from "./types";
export { buildBaselineLayout } from "./baseline";
export { scoreEnergy } from "./scoreEnergy";
export { computeSunPath, SEASON_DAYS, SEASONS } from "./sunPath";
export { analyzeWindows, windowAnalysisKey } from "./windows";
export { analyzeRoomVentilation } from "./ventilation";
export { analyzeRoomDaylight } from "./daylight";

/**
 * Core energy analysis for one layout. Deterministic, pure and independent
 * of the UI. All outputs are simplified ESTIMATES (see energy.config.ts).
 */
export function analyzeEnergy(
  plot: PlotInput,
  layout: Layout,
  options: EnergyOptions = {},
): EnergyAnalysis {
  const baseline = options.baseline === true;
  const city = getCityById(plot.city);
  if (!city) {
    throw new Error(`Unknown city "${plot.city}" — energy analysis needs a recognised city.`);
  }
  const profile = CLIMATE_ENERGY_PROFILES[city.climateZone];
  const sunPath = computeSunPath(city.latitude);
  const windows = analyzeWindows({ city, layout, sunPath, baseline });
  const byRoomWindows = windowsByRoom(windows);
  const coolingModel = analyzeCooling({
    plot,
    layout,
    city,
    windows,
    sunPath,
    baseline,
  });

  const arrows: VentilationArrow[] = [];
  const rooms: RoomEnergy[] = layout.rooms.map((room) => {
    const roomWindows = byRoomWindows.get(room.id) ?? [];
    const daylight = analyzeRoomDaylight(room, roomWindows, city);
    const ventilation = analyzeRoomVentilation(room, roomWindows, city);
    if (ventilation.arrow) arrows.push(ventilation.arrow);

    const summerWindowExposure = roomWindows.reduce(
      (sum, w) => sum + w.summerExposure,
      0,
    );
    const winterWindowExposure = roomWindows.reduce(
      (sum, w) => sum + w.winterExposure,
      0,
    );
    const westSouthExposure = roomWindows
      .filter((w) => w.wall === "W" || w.wall === "S")
      .reduce((sum, w) => sum + w.summerExposure, 0);
    const westSouthExposureShare =
      summerWindowExposure > 0 ? westSouthExposure / summerWindowExposure : 0;
    const floorAreaSqft = rectArea(room.rect);
    const cooling =
      coolingModel.byRoom.get(room.id) ?? {
        thermalKWhYear: 0,
        wallKWh: 0,
        windowConductionKWh: 0,
        windowSolarKWh: 0,
        internalKWh: 0,
        thermalKWhPerM2: 0,
      };

    return {
      roomId: room.id,
      roomLabel: room.label,
      roomType: room.type,
      zone: room.zone,
      floorAreaSqft,
      windowCount: roomWindows.length,
      windowAreaSqft: roomWindows.reduce((sum, w) => sum + w.areaSqft, 0),
      wfrPct: daylight.wfrPct,
      targetWfrPct: daylight.targetWfrPct,
      dominantOrientation: dominantOrientation(roomWindows),
      daylightScore: daylight.score,
      heatmapValue: daylight.heatmapValue,
      daylightHeatmap: daylight.cells,
      effectiveDepthFt: daylight.effectiveDepthFt,
      depthRatio: daylight.depthRatio,
      windowHeightFt: roomWindows[0]?.heightFt ?? 0,
      ventilationScore: ventilation.score,
      ventilation: ventilation.detail,
      cooling,
      summerWindowExposure,
      winterWindowExposure,
      westSouthExposureShare,
      heavyWestExposure:
        summerWindowExposure > 0.5 && westSouthExposureShare >= 0.5,
    };
  });

  const floorAreaSqft = rooms.reduce((sum, r) => sum + r.floorAreaSqft, 0);
  const daylightScore = weightedScore(
    rooms,
    (r) => r.daylightScore,
    (r) => ROOM_DAYLIGHT_WEIGHTS[r.roomType] * Math.max(1, r.floorAreaSqft),
  );
  const ventilationScore = weightedScore(
    rooms,
    (r) => r.ventilationScore,
    (r) => ROOM_ENERGY_WEIGHTS[r.roomType] * Math.max(1, r.floorAreaSqft),
  );
  const heatScore = clamp(
    100 *
      ((COOLING_CONFIG.coolingWorstKWhPerSqft - coolingModel.cooling.kWhPerSqft) /
        (COOLING_CONFIG.coolingWorstKWhPerSqft -
          COOLING_CONFIG.coolingTargetKWhPerSqft)),
    0,
    100,
  );
  const shadingScore = weightedWindowScore(
    windows,
    (w) => w.overhangReductionPct,
  );

  const notes: string[] = [];
  if (baseline) {
    notes.push(
      "MODEL BASELINE — a conventional grid generated by this engine, not a surveyed building.",
    );
    notes.push(
      "No overhangs are assumed and equal windows sit on every external wall; the same simplified formulas are applied as for the generated layouts.",
    );
  } else {
    notes.push(
      "All energy numbers are simplified ESTIMATES from sun-path geometry and placeholder climate coefficients — not an energy simulation.",
    );
    notes.push(
      "The cooling estimate assumes the computed minimum overhangs are built. Omitting them gives back the unshaded solar load.",
    );
  }
  const noWindowRooms = rooms.filter((r) => r.windowCount === 0);
  if (noWindowRooms.length > 0) {
    notes.push(
      `${noWindowRooms.length} room(s) have no modelled window: ${noWindowRooms
        .map((r) => r.roomLabel)
        .join(", ")}.`,
    );
  }

  const recommendations = buildRecommendations({
    plot,
    layout,
    city,
    rooms,
    windows,
    daylightScore,
    ventilationScore,
    heatScore,
    cooling: coolingModel.cooling,
    baseline,
  });

  return {
    layoutId: layout.id,
    layoutName: layout.name,
    isBaseline: baseline,
    estimated: true,
    city,
    climate: {
      zone: profile.zone,
      label: profile.label,
      wfrTargetPct: profile.wfrTargetPct,
      coolingDegreeHoursK: profile.coolingDegreeHoursK,
      coolingDays: profile.coolingDays,
      heatGainFactor: profile.heatGainFactor,
    },
    sunPath,
    windows,
    rooms,
    arrows,
    cooling: coolingModel.cooling,
    daylightScore: Math.round(daylightScore),
    ventilationScore: Math.round(ventilationScore),
    heatScore: Math.round(heatScore),
    shadingScore: Math.round(shadingScore),
    floorAreaSqft,
    recommendations,
    assumptions: ENERGY_ASSUMPTIONS,
    notes,
  };
}

function weightedScore(
  rooms: RoomEnergy[],
  value: (r: RoomEnergy) => number,
  weight: (r: RoomEnergy) => number,
): number {
  const total = rooms.reduce((sum, r) => sum + weight(r), 0);
  if (total <= 0) return 0;
  return rooms.reduce((sum, r) => sum + value(r) * weight(r), 0) / total;
}

function weightedWindowScore(
  windows: WindowAnalysis[],
  value: (w: WindowAnalysis) => number,
): number {
  const total = windows.reduce((sum, w) => sum + w.areaSqft, 0);
  if (total <= 0) return 0;
  return windows.reduce((sum, w) => sum + value(w) * w.areaSqft, 0) / total;
}
