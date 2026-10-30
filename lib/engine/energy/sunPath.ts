import type { WallSide } from "../types";
import type { Season, SolarPoint, SunPathDay, SunPathResult } from "./types";

/**
 * Standard solar geometry (Cooper declination + horizontal coordinates).
 * No equation-of-time, longitude or time-zone correction: hours are LOCAL
 * SOLAR TIME, a deliberate simplification documented in energy.config.ts.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export const SEASON_DAYS: Record<
  Season,
  { dayOfYear: number; label: string }
> = {
  summer: { dayOfYear: 172, label: "Summer solstice (21 Jun)" },
  winter: { dayOfYear: 355, label: "Winter solstice (21 Dec)" },
  equinox: { dayOfYear: 80, label: "Equinox (21 Mar)" },
};

export const SEASONS: Season[] = ["summer", "winter", "equinox"];

export const WALL_AZIMUTH_DEG: Record<WallSide, number> = {
  N: 0,
  E: 90,
  S: 180,
  W: 270,
};

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function norm360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Cooper's equation, degrees. n = day of year (non-leap). */
export function solarDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * DEG);
}

/** Hour angle, degrees; negative morning, positive afternoon. */
export function solarHourAngleDeg(hour: number): number {
  return 15 * (hour - 12);
}

/** Solar altitude above the horizon, degrees. */
export function solarAltitudeDeg(
  latitudeDeg: number,
  declinationDeg: number,
  hourAngleDeg: number,
): number {
  const sinAlt =
    Math.sin(latitudeDeg * DEG) * Math.sin(declinationDeg * DEG) +
    Math.cos(latitudeDeg * DEG) *
      Math.cos(declinationDeg * DEG) *
      Math.cos(hourAngleDeg * DEG);
  return Math.asin(clamp(sinAlt, -1, 1)) * RAD;
}

/** Azimuth clockwise from north, degrees. */
export function solarAzimuthDeg(
  latitudeDeg: number,
  declinationDeg: number,
  hourAngleDeg: number,
  altitudeDeg: number,
): number {
  const cosAlt = Math.cos(altitudeDeg * DEG);
  const cosLat = Math.cos(latitudeDeg * DEG);
  if (Math.abs(cosAlt) < 1e-9 || Math.abs(cosLat) < 1e-9) {
    // Sun exactly overhead or observer at a pole: azimuth is undefined.
    return 180;
  }
  const numerator =
    Math.sin(declinationDeg * DEG) -
    Math.sin(altitudeDeg * DEG) * Math.sin(latitudeDeg * DEG);
  const cosAz = numerator / (cosAlt * cosLat);
  const az = Math.acos(clamp(cosAz, -1, 1)) * RAD;
  return norm360(hourAngleDeg > 0 ? 360 - az : az);
}

/** Sunrise/sunset in decimal local solar time; null for polar day/night. */
export function sunriseSunset(
  latitudeDeg: number,
  declinationDeg: number,
): {
  sunriseHour: number | null;
  sunsetHour: number | null;
  polar: "day" | "night" | null;
} {
  const cosH0 =
    -Math.tan(latitudeDeg * DEG) * Math.tan(declinationDeg * DEG);
  if (cosH0 >= 1) {
    return { sunriseHour: null, sunsetHour: null, polar: "night" };
  }
  if (cosH0 <= -1) {
    return { sunriseHour: 0, sunsetHour: 24, polar: "day" };
  }
  const h0 = Math.acos(clamp(cosH0, -1, 1)) * RAD;
  return {
    sunriseHour: 12 - h0 / 15,
    sunsetHour: 12 + h0 / 15,
    polar: null,
  };
}

export function computeSunPathDay(
  latitudeDeg: number,
  season: Season,
): SunPathDay {
  const { dayOfYear, label } = SEASON_DAYS[season];
  const declinationDeg = solarDeclinationDeg(dayOfYear);
  const points: SolarPoint[] = [];
  let maxAltitudeDeg = -90;
  for (let hour = 0; hour < 24; hour++) {
    const h = solarHourAngleDeg(hour);
    const altitudeDeg = solarAltitudeDeg(latitudeDeg, declinationDeg, h);
    const azimuthDeg = solarAzimuthDeg(
      latitudeDeg,
      declinationDeg,
      h,
      altitudeDeg,
    );
    maxAltitudeDeg = Math.max(maxAltitudeDeg, altitudeDeg);
    points.push({
      hour,
      altitudeDeg,
      azimuthDeg,
      daylight: altitudeDeg > 0,
    });
  }
  const rise = sunriseSunset(latitudeDeg, declinationDeg);
  return {
    season,
    label,
    dayOfYear,
    declinationDeg,
    sunriseHour: rise.sunriseHour,
    sunsetHour: rise.sunsetHour,
    points,
    maxAltitudeDeg,
    polar: rise.polar,
  };
}

export function computeSunPath(latitudeDeg: number): SunPathResult {
  if (!Number.isFinite(latitudeDeg) || Math.abs(latitudeDeg) > 90) {
    throw new Error("Latitude must be a finite number between -90 and 90.");
  }
  return {
    latitude: latitudeDeg,
    days: {
      summer: computeSunPathDay(latitudeDeg, "summer"),
      winter: computeSunPathDay(latitudeDeg, "winter"),
      equinox: computeSunPathDay(latitudeDeg, "equinox"),
    },
  };
}

/* ------------------------- vertical-pane exposure ------------------------- */

export interface ExposureHour {
  hour: number;
  altitudeDeg: number;
  azimuthDeg: number;
  /** Cosine incidence on the vertical pane; 0 when the sun is behind it. */
  incidence: number;
  /** Fraction of the pane hidden by an overhang at this hour, 0..1. */
  shadedFraction: number;
}

export interface WallExposure {
  directHours: number;
  /** Sum of cosine-incidence values: equivalent sun-hours on the pane. */
  exposure: number;
  exposureWithOverhang: number;
  hours: ExposureHour[];
}

/**
 * Direct-beam exposure on a vertical wall. Only the direct component is
 * modelled (no diffuse sky, no ground reflection).
 */
export function wallExposure(
  day: SunPathDay,
  wallAzimuthDeg: number,
  overhangDepthFt: number,
  windowHeightFt: number,
): WallExposure {
  let directHours = 0;
  let exposure = 0;
  let exposureWithOverhang = 0;
  const hours: ExposureHour[] = [];

  for (const point of day.points) {
    if (!point.daylight) continue;
    const azDiff = norm360(point.azimuthDeg - wallAzimuthDeg);
    const cosAzDiff = Math.cos(azDiff * DEG);
    if (cosAzDiff <= 0) continue;
    const cosAlt = Math.cos(point.altitudeDeg * DEG);
    const incidence = Math.max(0, cosAlt * cosAzDiff);
    if (incidence <= 1e-9) continue;

    directHours += 1;
    exposure += incidence;

    let shadedFraction = 0;
    if (overhangDepthFt > 0 && windowHeightFt > 0) {
      // Profile-angle construction: drop = depth · tan(profile angle).
      const tanProfile =
        Math.tan(point.altitudeDeg * DEG) / Math.max(0.15, cosAzDiff);
      const drop = overhangDepthFt * tanProfile;
      shadedFraction = clamp(drop / windowHeightFt, 0, 1);
    }
    exposureWithOverhang += incidence * (1 - shadedFraction);

    hours.push({
      hour: point.hour,
      altitudeDeg: point.altitudeDeg,
      azimuthDeg: point.azimuthDeg,
      incidence,
      shadedFraction,
    });
  }

  return { directHours, exposure, exposureWithOverhang, hours };
}
