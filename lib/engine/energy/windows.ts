import {
  CLIMATE_ENERGY_PROFILES,
  WINDOW_CONFIG,
  orientationFromWall,
} from "@/lib/data/energy.config";
import type { CityData, Layout, PlanRoom, WallSide } from "../types";
import { rectArea } from "../vastuGrid";
import {
  WALL_AZIMUTH_DEG,
  clamp,
  wallExposure,
  type ExposureHour,
} from "./sunPath";
import type {
  Orientation8,
  Season,
  SunPathResult,
  WindowAnalysis,
} from "./types";

/**
 * Window model: area, climate/orientation WFR target, direct-sun exposure
 * (summer vs winter) and the minimum overhang for full summer shade.
 *
 * The overhang formula is the simplified vertical-plane geometry:
 *   depth = windowHeight / tan(altitude at the critical summer hour)
 * clamped to a domestic range. It ignores reveal depth, wall thickness and
 * off-axis sun; E/W windows additionally need vertical fins.
 */

export function windowAnalysisKey(
  roomId: string,
  windowIndex: number,
): string {
  return `${roomId}:${windowIndex}`;
}

function orientationOf(wall: WallSide): Orientation8 {
  return orientationFromWall(wall);
}

/** Critical hour = maximum direct cosine-incidence during summer. */
export function criticalSummerHour(
  hours: ExposureHour[],
): ExposureHour | null {
  let best: ExposureHour | null = null;
  for (const h of hours) {
    if (!best || h.incidence > best.incidence) best = h;
  }
  return best;
}

export interface WindowModelInput {
  city: CityData;
  layout: Layout;
  sunPath: SunPathResult;
  /** true = model baseline: no overhangs installed. */
  baseline: boolean;
}

export function analyzeWindows(input: WindowModelInput): WindowAnalysis[] {
  const { city, layout, sunPath, baseline } = input;
  const profile = CLIMATE_ENERGY_PROFILES[city.climateZone];
  const heightFt = WINDOW_CONFIG.heightFt;
  const summer = sunPath.days.summer;
  const winter = sunPath.days.winter;
  const result: WindowAnalysis[] = [];

  for (const room of layout.rooms) {
    const floorArea = rectArea(room.rect);
    room.windows.forEach((win, index) => {
      const orientation = orientationOf(win.wall);
      const areaSqft = win.width * heightFt;
      const wfrPct = floorArea > 0 ? (areaSqft / floorArea) * 100 : 0;
      const targetWfrPct =
        profile.wfrTargetPct * profile.orientationWfrFactor[orientation];

      const summerRaw = wallExposure(
        summer,
        WALL_AZIMUTH_DEG[win.wall],
        0,
        heightFt,
      );
      const winterRaw = wallExposure(
        winter,
        WALL_AZIMUTH_DEG[win.wall],
        0,
        heightFt,
      );
      const critical = criticalSummerHour(summerRaw.hours);

      let requiredOverhangFt = 0;
      let overhangDepthClamped = false;
      if (!baseline && critical && critical.altitudeDeg > 5) {
        const rawDepth = heightFt / Math.tan((critical.altitudeDeg * Math.PI) / 180);
        requiredOverhangFt = clamp(
          rawDepth,
          WINDOW_CONFIG.overhangMinFt,
          WINDOW_CONFIG.overhangMaxFt,
        );
        overhangDepthClamped =
          rawDepth < WINDOW_CONFIG.overhangMinFt ||
          rawDepth > WINDOW_CONFIG.overhangMaxFt;
      }

      const summerWithOverhang =
        requiredOverhangFt > 0
          ? wallExposure(
              summer,
              WALL_AZIMUTH_DEG[win.wall],
              requiredOverhangFt,
              heightFt,
            )
          : summerRaw;
      const overhangReductionPct =
        summerRaw.exposure > 1e-9
          ? clamp(
              ((summerRaw.exposure - summerWithOverhang.exposureWithOverhang) /
                summerRaw.exposure) *
                100,
              0,
              100,
            )
          : 0;

      const finRecommended =
        !baseline &&
        (win.wall === "E" || win.wall === "W") &&
        summerRaw.directHours > 0;

      const shadingNote = baseline
        ? "Model baseline: no overhang or fin is assumed."
        : finRecommended
          ? `Deep overhang ${requiredOverhangFt.toFixed(1)} ft recommended; vertical fins are usually more effective on E/W walls because the sun is low and swings across the facade.`
          : requiredOverhangFt > 0
            ? `Overhang ${requiredOverhangFt.toFixed(1)} ft at the head of the window for full shade at the critical summer hour.`
            : "No direct summer sun reaches this pane at the modelled hours.";

      result.push({
        roomId: room.id,
        roomLabel: room.label,
        index,
        wall: win.wall,
        orientation,
        widthFt: win.width,
        heightFt,
        areaSqft,
        floorAreaSqft: floorArea,
        wfrPct,
        targetWfrPct,
        meetsTarget: wfrPct >= targetWfrPct * 0.8,
        summerDirectHours: summerRaw.directHours,
        winterDirectHours: winterRaw.directHours,
        summerExposure: summerRaw.exposure,
        winterExposure: winterRaw.exposure,
        summerWithOverhangExposure: summerWithOverhang.exposureWithOverhang,
        overhangReductionPct,
        requiredOverhangFt,
        overhangDepthClamped,
        finRecommended,
        shadingNote,
      });
    });
  }

  return result;
}

/** Group analyses by room id, preserving window order. */
export function windowsByRoom(
  windows: WindowAnalysis[],
): Map<string, WindowAnalysis[]> {
  const map = new Map<string, WindowAnalysis[]>();
  for (const window of windows) {
    const list = map.get(window.roomId) ?? [];
    list.push(window);
    map.set(window.roomId, list);
  }
  return map;
}

/** Window area-weighted dominant orientation for a room. */
export function dominantOrientation(
  windows: WindowAnalysis[],
): Orientation8 | null {
  const area = new Map<Orientation8, number>();
  for (const window of windows) {
    area.set(
      window.orientation,
      (area.get(window.orientation) ?? 0) + window.areaSqft,
    );
  }
  let best: Orientation8 | null = null;
  let bestArea = -1;
  area.forEach((value, orientation) => {
    if (value > bestArea + 1e-9) {
      bestArea = value;
      best = orientation;
    }
  });
  return best;
}

/** Total window exposure for one room in a selected season. */
export function roomSunExposure(
  windows: WindowAnalysis[],
  season: Season,
): number {
  return windows.reduce(
    (sum, w) =>
      sum + (season === "summer" ? w.summerExposure : w.winterExposure),
    0,
  );
}

/** Helper used by tests and UI coloring. */
export function windowExposureForSeason(
  window: WindowAnalysis,
  season: Season,
): number {
  return season === "summer"
    ? window.summerExposure
    : season === "winter"
      ? window.winterExposure
      : (window.summerExposure + window.winterExposure) / 2;
}

/** All windows on a room's W/SW/S walls (used by the trade-off explainer). */
export function westSouthWindowArea(
  room: PlanRoom,
  windows: WindowAnalysis[],
): number {
  return windows
    .filter((w) => w.wall === "W" || w.wall === "S")
    .reduce((sum, w) => sum + w.areaSqft, 0);
}
