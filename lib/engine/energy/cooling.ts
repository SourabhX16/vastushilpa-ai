import {
  CLIMATE_ENERGY_PROFILES,
  COOLING_CONFIG,
  WINDOW_CONFIG,
} from "@/lib/data/energy.config";
import type { CityData, Layout, PlanRoom, PlotInput, WallSide } from "../types";
import { rectArea, toFeet } from "../vastuGrid";
import { WALL_AZIMUTH_DEG, wallExposure } from "./sunPath";
import type {
  CoolingEstimate,
  RoomCoolingBreakdown,
  SunPathResult,
  WindowAnalysis,
} from "./types";

const SQFT_TO_M2 = 0.09290304;
const EPS = 1e-6;

const WALLS: WallSide[] = ["N", "E", "S", "W"];

function touchesPlotBoundary(
  room: PlanRoom,
  wall: WallSide,
  lengthFt: number,
  widthFt: number,
): boolean {
  switch (wall) {
    case "W":
      return room.rect.x <= 0.75 + EPS;
    case "E":
      return lengthFt - (room.rect.x + room.rect.w) <= 0.75 + EPS;
    case "N":
      return room.rect.y <= 0.75 + EPS;
    case "S":
      return widthFt - (room.rect.y + room.rect.h) <= 0.75 + EPS;
  }
}

function wallSpan(room: PlanRoom, wall: WallSide): number {
  return wall === "N" || wall === "S" ? room.rect.w : room.rect.h;
}

export interface CoolingModelInput {
  plot: PlotInput;
  layout: Layout;
  city: CityData;
  windows: WindowAnalysis[];
  sunPath: SunPathResult;
  baseline: boolean;
}

export interface CoolingModelResult {
  cooling: CoolingEstimate;
  byRoom: Map<string, RoomCoolingBreakdown>;
}

export function analyzeCooling(
  input: CoolingModelInput,
): CoolingModelResult {
  const { plot, layout, city, windows, sunPath, baseline } = input;
  const profile = CLIMATE_ENERGY_PROFILES[city.climateZone];
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);

  const exposuresByWall = new Map<WallSide, number>();
  for (const wall of WALLS) {
    const exposure = wallExposure(
      sunPath.days.summer,
      WALL_AZIMUTH_DEG[wall],
      0,
      WINDOW_CONFIG.heightFt,
    ).exposure;
    exposuresByWall.set(wall, exposure);
  }
  const maxExposure = Math.max(...Array.from(exposuresByWall.values()), EPS);

  const windowsByRoom = new Map<string, WindowAnalysis[]>();
  for (const window of windows) {
    const list = windowsByRoom.get(window.roomId) ?? [];
    list.push(window);
    windowsByRoom.set(window.roomId, list);
  }

  const byRoom = new Map<string, RoomCoolingBreakdown>();
  let totalWall = 0;
  let totalWindowConduction = 0;
  let totalWindowSolar = 0;
  let totalInternal = 0;
  let totalFloorSqft = 0;

  for (const room of layout.rooms) {
    const roomWindows = windowsByRoom.get(room.id) ?? [];
    const floorSqft = rectArea(room.rect);
    const floorM2 = floorSqft * SQFT_TO_M2;
    totalFloorSqft += floorSqft;

    let wallKWh = 0;
    for (const wall of WALLS) {
      if (!touchesPlotBoundary(room, wall, lengthFt, widthFt)) continue;
      const glazed = roomWindows
        .filter((w) => w.wall === wall)
        .reduce((sum, w) => sum + w.areaSqft, 0);
      const opaqueSqft = Math.max(0, wallSpan(room, wall) * WINDOW_CONFIG.wallHeightFt - glazed);
      const opaqueM2 = opaqueSqft * SQFT_TO_M2;
      const normalisedExposure =
        (exposuresByWall.get(wall) ?? 0) / Math.max(EPS, maxExposure);
      const orientationFactor =
        COOLING_CONFIG.wallExposureBase +
        COOLING_CONFIG.wallExposureMultiplier * normalisedExposure;
      wallKWh +=
        (opaqueM2 * profile.wallU * profile.coolingDegreeHoursK * orientationFactor) /
        1000;
    }

    let windowConductionKWh = 0;
    let windowSolarKWh = 0;
    for (const window of roomWindows) {
      const areaM2 = window.areaSqft * SQFT_TO_M2;
      windowConductionKWh +=
        (areaM2 * profile.windowU * profile.coolingDegreeHoursK) / 1000;
      const shadingFactor = baseline
        ? 1
        : Math.max(
            0,
            1 -
              WINDOW_CONFIG.overhangEffectiveness *
                (window.overhangReductionPct / 100),
          );
      const dailySolarKWhM2 =
        window.summerExposure * WINDOW_CONFIG.peakDirectKWm2;
      windowSolarKWh +=
        areaM2 *
        profile.shgc *
        dailySolarKWhM2 *
        profile.coolingDays *
        shadingFactor;
    }

    const internalKWh = floorM2 * profile.internalGainKWhM2Year;
    const climateFactor = profile.heatGainFactor;
    wallKWh *= climateFactor;
    windowConductionKWh *= climateFactor;
    windowSolarKWh *= climateFactor;
    const internalKWhAdjusted = internalKWh * climateFactor;
    const thermalKWhYear =
      wallKWh + windowConductionKWh + windowSolarKWh + internalKWhAdjusted;

    totalWall += wallKWh;
    totalWindowConduction += windowConductionKWh;
    totalWindowSolar += windowSolarKWh;
    totalInternal += internalKWhAdjusted;

    byRoom.set(room.id, {
      thermalKWhYear: round(thermalKWhYear, 1),
      wallKWh: round(wallKWh, 1),
      windowConductionKWh: round(windowConductionKWh, 1),
      windowSolarKWh: round(windowSolarKWh, 1),
      internalKWh: round(internalKWhAdjusted, 1),
      thermalKWhPerM2:
        floorM2 > 0 ? round(thermalKWhYear / floorM2, 1) : 0,
    });
  }

  const annualThermalKWh =
    totalWall + totalWindowConduction + totalWindowSolar + totalInternal;
  const annualCoolingKWh = annualThermalKWh / profile.cop;

  return {
    cooling: {
      annualCoolingKWh: round(annualCoolingKWh, 1),
      annualThermalKWh: round(annualThermalKWh, 1),
      kWhPerSqft:
        totalFloorSqft > 0
          ? round(annualCoolingKWh / totalFloorSqft, 2)
          : 0,
      wallKWh: round(totalWall, 1),
      windowConductionKWh: round(totalWindowConduction, 1),
      windowSolarKWh: round(totalWindowSolar, 1),
      internalKWh: round(totalInternal, 1),
      climateFactor: profile.heatGainFactor,
      cop: profile.cop,
      floorAreaSqft: round(totalFloorSqft, 1),
      formula:
        "E_cooling = [Σ(A_wall·U_wall·CDH·(0.7+0.6·S/Smax)) + Σ(A_win·U_win·CDH) + Σ(A_win·SHGC·S_win·I_peak·D_cool·f_shade) + A_floor·G_internal] × f_climate / COP / 1000",
    },
    byRoom,
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
