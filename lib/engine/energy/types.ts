import type {
  CityData,
  ClimateZone,
  LayoutMode,
  Rect,
  VastuRoomType,
  VastuZoneId,
  WallSide,
} from "../types";

/**
 * Energy module result types. Everything in here is a simplified estimate
 * from the transparent heuristics documented in /lib/data/energy.config.ts —
 * it is NOT an energy simulation, and no number is code-certified.
 */

export type Season = "summer" | "winter" | "equinox";

/** Eight-point compass orientation (wall normals are cardinal in Layout). */
export type Orientation8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface SolarPoint {
  /** Local solar time, decimal hours (0..23). */
  hour: number;
  /** Degrees above the horizon (negative = below). */
  altitudeDeg: number;
  /** Degrees clockwise from true north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuthDeg: number;
  daylight: boolean;
}

export interface SunPathDay {
  season: Season;
  label: string;
  /** Fixed day-of-year used for the geometry (non-leap year). */
  dayOfYear: number;
  declinationDeg: number;
  /** Decimal local solar time; null only for polar day/night edge cases. */
  sunriseHour: number | null;
  sunsetHour: number | null;
  /** 24 hourly points, 00:00 through 23:00 solar time. */
  points: SolarPoint[];
  maxAltitudeDeg: number;
  polar: "day" | "night" | null;
}

export interface SunPathResult {
  latitude: number;
  days: Record<Season, SunPathDay>;
}

export interface WindowAnalysis {
  roomId: string;
  roomLabel: string;
  /** Window order within the room's `windows` array. */
  index: number;
  wall: WallSide;
  orientation: Orientation8;
  widthFt: number;
  heightFt: number;
  areaSqft: number;
  floorAreaSqft: number;
  /** This window's area / room floor area, percent. */
  wfrPct: number;
  /** Climate + orientation target for this window, percent. */
  targetWfrPct: number;
  meetsTarget: boolean;
  /** Number of daylight hours with the sun in front of this wall. */
  summerDirectHours: number;
  winterDirectHours: number;
  /** Integrated direct-beam exposure on the vertical pane, equivalent sun-hours. */
  summerExposure: number;
  winterExposure: number;
  /** Same metric if the computed minimum overhang is installed. */
  summerWithOverhangExposure: number;
  overhangReductionPct: number;
  /** Depth = height / tan(altitude at the critical summer hour), clamped. */
  requiredOverhangFt: number;
  overhangDepthClamped: boolean;
  /** Vertical fins are usually the better device on E/W walls. */
  finRecommended: boolean;
  shadingNote: string;
}

export interface DaylightCell {
  rect: Rect;
  /** 0..100 relative daylight proxy inside the room. */
  value: number;
}

export interface VentilationDetail {
  openingWalls: WallSide[];
  windowCount: number;
  crossVentilated: boolean;
  opposite: boolean;
  adjacent: boolean;
  singleSided: boolean;
  /** At least one opening faces within the configured wind tolerance. */
  windAligned: boolean;
  /** The chosen inlet→outlet pair roughly follows the wind flow vector. */
  flowAligned: boolean;
  notes: string;
}

export type VentilationArrowKind = "cross" | "single-sided";
export type VentilationAlignment = "aligned" | "partial" | "opposed";

export interface VentilationArrow {
  roomId: string;
  roomLabel: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: VentilationArrowKind;
  alignment: VentilationAlignment;
}

export interface RoomCoolingBreakdown {
  /** kWh thermal per year, before the COP conversion. */
  thermalKWhYear: number;
  wallKWh: number;
  windowConductionKWh: number;
  windowSolarKWh: number;
  internalKWh: number;
  /** Thermal kWh per m² of floor per year (comparison aid). */
  thermalKWhPerM2: number;
}

export interface RoomEnergy {
  roomId: string;
  roomLabel: string;
  roomType: VastuRoomType;
  zone: VastuZoneId;
  floorAreaSqft: number;
  windowCount: number;
  windowAreaSqft: number;
  wfrPct: number;
  targetWfrPct: number;
  dominantOrientation: Orientation8 | null;
  daylightScore: number;
  /** Mean of the coarse heatmap grid, 0..100. */
  heatmapValue: number;
  daylightHeatmap: DaylightCell[];
  effectiveDepthFt: number;
  depthRatio: number;
  windowHeightFt: number;
  ventilationScore: number;
  ventilation: VentilationDetail;
  cooling: RoomCoolingBreakdown;
  /** Sum of window summer exposure values (equivalent sun-hours). */
  summerWindowExposure: number;
  winterWindowExposure: number;
  /** Share of summer window exposure arriving on W/SW/S walls, 0..1. */
  westSouthExposureShare: number;
  /** Heuristic flag used by the trade-off explainer. */
  heavyWestExposure: boolean;
}

export interface CoolingEstimate {
  /** Estimated annual cooling ELECTRICITY demand, kWh. */
  annualCoolingKWh: number;
  /** Estimated annual thermal load before the COP conversion, kWh. */
  annualThermalKWh: number;
  kWhPerSqft: number;
  wallKWh: number;
  windowConductionKWh: number;
  windowSolarKWh: number;
  internalKWh: number;
  climateFactor: number;
  cop: number;
  floorAreaSqft: number;
  formula: string;
}

export type PassiveRecommendationId =
  | "courtyard"
  | "jaali"
  | "ventilator"
  | "overhang";

export interface PassiveRecommendation {
  id: PassiveRecommendationId;
  title: string;
  /** Generated from the actual metric that triggered the rule. */
  reason: string;
  /** The metric the measure is expected to improve. */
  metric: string;
  priority: "high" | "medium" | "low";
  targetRooms: string[];
  /** Honest, non-numeric caveat where the model cannot predict the gain. */
  estimatedEffect: string;
}

export interface EnergyAssumption {
  id: string;
  label: string;
  value: string;
  /** Explicit formula or rule-of-thumb statement. */
  formula: string;
  source: string;
  verified: boolean;
}

export interface ClimateProfileView {
  zone: ClimateZone;
  label: string;
  wfrTargetPct: number;
  coolingDegreeHoursK: number;
  coolingDays: number;
  heatGainFactor: number;
}

export interface EnergyAnalysis {
  layoutId: LayoutMode;
  layoutName: string;
  /** true for the conventional model baseline, false for generated layouts. */
  isBaseline: boolean;
  estimated: true;
  city: CityData;
  climate: ClimateProfileView;
  sunPath: SunPathResult;
  windows: WindowAnalysis[];
  rooms: RoomEnergy[];
  arrows: VentilationArrow[];
  cooling: CoolingEstimate;
  daylightScore: number;
  ventilationScore: number;
  heatScore: number;
  shadingScore: number;
  floorAreaSqft: number;
  recommendations: PassiveRecommendation[];
  assumptions: EnergyAssumption[];
  notes: string[];
}

export interface EnergyScoreBreakdown {
  key: "daylight" | "ventilation" | "heat" | "shading";
  label: string;
  /** Component score 0..100. */
  value: number;
  weight: number;
  /** Weighted contribution to the /100 total. */
  points: number;
  reason: string;
}

export interface SolarPotential {
  roofAreaSqft: number;
  usableRoofAreaM2: number;
  irradianceKWhM2Year: number;
  pvEfficiency: number;
  performanceRatio: number;
  annualKWh: number;
  co2AvoidedKg: number;
  assumptions: string[];
}

export interface RainwaterEstimate {
  catchmentAreaM2: number;
  rainfallMm: number;
  runoffCoefficient: number;
  annualLitres: number;
  annualM3: number;
  assumptions: string[];
}

export interface EnergyResult extends EnergyAnalysis {
  score100: number;
  breakdown: EnergyScoreBreakdown[];
  coolingReductionPctVsBaseline: number;
  baseline: {
    coolingKWh: number;
    daylightScore: number;
    ventilationScore: number;
    score100: number;
  };
  solar: SolarPotential;
  rainwater: RainwaterEstimate;
}

export interface EnergyOptions {
  /** true = model baseline: no overhangs are assumed to be installed. */
  baseline?: boolean;
}
