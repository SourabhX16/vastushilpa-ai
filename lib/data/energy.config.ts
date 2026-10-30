import type { ClimateZone, VastuRoomType, WallSide } from "../engine/types";
import type {
  EnergyAssumption,
  Orientation8,
} from "../engine/energy/types";

/**
 * ENERGY CONFIG — transparent heuristics, NOT a simulation.
 *
 * Every design coefficient below is a placeholder for a simplified early-stage
 * estimate. Only the standard solar-geometry formula rows are marked
 * verified:true; every climate, envelope, ventilation, daylight, solar and
 * rainwater coefficient is verified:false and must be replaced with measured
 * or code-referenced data before any design decision relies on it.
 *
 * No result from this module is a certified energy performance claim.
 */

export interface ClimateEnergyProfile {
  zone: ClimateZone;
  label: string;
  /** Base window-to-floor-area target, percent of floor area. */
  wfrTargetPct: number;
  /** Multiplier on the base WFR target by orientation (hot climates favour N/NE). */
  orientationWfrFactor: Record<Orientation8, number>;
  /** Daylight orientation usefulness factor (0..~1.1). */
  daylightOrientationFactor: Record<Orientation8, number>;
  /** Annual cooling-degree hours, base ~24 °C. */
  coolingDegreeHoursK: number;
  /** Equivalent cooling-season days used for solar gain. */
  coolingDays: number;
  /** Additional climate multiplier applied to the thermal load. */
  heatGainFactor: number;
  /** Opaque wall U-value, W/m²K. */
  wallU: number;
  /** Window U-value, W/m²K (single glazing placeholder). */
  windowU: number;
  /** Solar heat gain coefficient. */
  shgc: number;
  /** Internal gains, kWh/m²/year. */
  internalGainKWhM2Year: number;
  /** Cooling system coefficient of performance. */
  cop: number;
  source: string;
  verified: false;
}

const HOT_DAYLIGHT: Record<Orientation8, number> = {
  N: 1.05,
  NE: 1.1,
  E: 0.95,
  SE: 0.8,
  S: 0.75,
  SW: 0.55,
  W: 0.45,
  NW: 0.85,
};

const MILD_DAYLIGHT: Record<Orientation8, number> = {
  N: 1.0,
  NE: 1.0,
  E: 0.95,
  SE: 0.85,
  S: 0.85,
  SW: 0.75,
  W: 0.7,
  NW: 0.85,
};

const SOURCE_CLIMATE =
  "TODO: replace with measured weather data / NBC 2016 climate-zone guidance; placeholder values compiled heuristically (verified:false)";

export const CLIMATE_ENERGY_PROFILES: Record<ClimateZone, ClimateEnergyProfile> = {
  "hot-dry": {
    zone: "hot-dry",
    label: "Hot-dry",
    wfrTargetPct: 12,
    orientationWfrFactor: {
      N: 1.25,
      NE: 1.2,
      E: 1.05,
      SE: 0.8,
      S: 0.85,
      SW: 0.75,
      W: 0.7,
      NW: 0.9,
    },
    daylightOrientationFactor: HOT_DAYLIGHT,
    coolingDegreeHoursK: 30000,
    coolingDays: 160,
    heatGainFactor: 1.1,
    wallU: 2.0,
    windowU: 5.8,
    shgc: 0.7,
    internalGainKWhM2Year: 12,
    cop: 3.0,
    source: SOURCE_CLIMATE,
    verified: false,
  },
  "warm-humid": {
    zone: "warm-humid",
    label: "Warm-humid",
    wfrTargetPct: 16,
    orientationWfrFactor: {
      N: 1.2,
      NE: 1.2,
      E: 1.05,
      SE: 0.85,
      S: 0.9,
      SW: 0.8,
      W: 0.75,
      NW: 0.95,
    },
    daylightOrientationFactor: HOT_DAYLIGHT,
    coolingDegreeHoursK: 26000,
    coolingDays: 180,
    heatGainFactor: 1.0,
    wallU: 2.2,
    windowU: 5.8,
    shgc: 0.65,
    internalGainKWhM2Year: 12,
    cop: 3.0,
    source: SOURCE_CLIMATE,
    verified: false,
  },
  composite: {
    zone: "composite",
    label: "Composite",
    wfrTargetPct: 14,
    orientationWfrFactor: {
      N: 1.25,
      NE: 1.2,
      E: 1.05,
      SE: 0.8,
      S: 0.85,
      SW: 0.75,
      W: 0.7,
      NW: 0.9,
    },
    daylightOrientationFactor: HOT_DAYLIGHT,
    coolingDegreeHoursK: 24000,
    coolingDays: 150,
    heatGainFactor: 1.0,
    wallU: 2.0,
    windowU: 5.8,
    shgc: 0.7,
    internalGainKWhM2Year: 12,
    cop: 3.0,
    source: SOURCE_CLIMATE,
    verified: false,
  },
  temperate: {
    zone: "temperate",
    label: "Temperate",
    wfrTargetPct: 15,
    orientationWfrFactor: {
      N: 1.15,
      NE: 1.1,
      E: 1.05,
      SE: 0.9,
      S: 0.95,
      SW: 0.9,
      W: 0.85,
      NW: 0.95,
    },
    daylightOrientationFactor: MILD_DAYLIGHT,
    coolingDegreeHoursK: 10000,
    coolingDays: 90,
    heatGainFactor: 0.75,
    wallU: 2.0,
    windowU: 5.2,
    shgc: 0.65,
    internalGainKWhM2Year: 12,
    cop: 3.2,
    source: SOURCE_CLIMATE,
    verified: false,
  },
  cold: {
    zone: "cold",
    label: "Cold",
    wfrTargetPct: 13,
    orientationWfrFactor: {
      N: 1.1,
      NE: 1.05,
      E: 1.0,
      SE: 0.95,
      S: 1.0,
      SW: 0.95,
      W: 0.9,
      NW: 0.95,
    },
    daylightOrientationFactor: MILD_DAYLIGHT,
    coolingDegreeHoursK: 2500,
    coolingDays: 30,
    heatGainFactor: 0.4,
    wallU: 1.8,
    windowU: 4.8,
    shgc: 0.6,
    internalGainKWhM2Year: 12,
    cop: 3.2,
    source: SOURCE_CLIMATE,
    verified: false,
  },
};

export const WINDOW_CONFIG = {
  /** Assumed window head height used for area and overhang geometry. */
  heightFt: 4.5,
  /** Assumed floor-to-floor wall height used for opaque wall area. */
  wallHeightFt: 10,
  /** Sensible clamp for a domestic overhang. */
  overhangMinFt: 1.5,
  overhangMaxFt: 6,
  /** Fraction of blocked direct sun removed from the cooling load. */
  overhangEffectiveness: 0.6,
  /** Reference direct normal irradiance used to turn exposure hours into kWh. */
  peakDirectKWm2: 0.75,
  source:
    "Assumed domestic dimensions and a placeholder peak direct irradiance; verify against the project window schedule and local design conditions",
  verified: false as const,
};

export const DAYLIGHT_CONFIG = {
  idealDepthRatio: 2.5,
  /** Depth-ratio band over which the depth score falls from 100 to 0. */
  depthPenaltySpan: 5,
  /** Relative decay length for the room heatmap, in window heights. */
  heatmapDecayWindowHeights: 2.5,
  heatmapTargetCellFt: 6,
  heatmapMinCols: 2,
  heatmapMaxCols: 4,
  heatmapMinRows: 2,
  heatmapMaxRows: 4,
  wfrWeight: 0.45,
  orientationWeight: 0.25,
  depthWeight: 0.3,
  source:
    "Rule-of-thumb daylight guidance (useful depth ~2–2.5 × window head height), simplified into a 0–100 index; not a daylight-factor calculation",
  verified: false as const,
};

export const VENTILATION_CONFIG = {
  /** Openings within this angle of the prevailing wind are treated as windward. */
  windToleranceDeg: 45,
  singleSidedScore: 25,
  adjacentScore: 60,
  oppositeScore: 80,
  windAlignedBonus: 15,
  flowAlignedBonus: 10,
  /** Dot-product threshold used to call a pair "aligned" with the wind flow. */
  flowAlignedDot: 0.7,
  source:
    "Simplified cross-ventilation rules of thumb; the city wind field is a single-vector simplification (see cities.ts)",
  verified: false as const,
};

export const COOLING_CONFIG = {
  /** Absolute heuristic band used only to normalise the heat sub-score. */
  coolingTargetKWhPerSqft: 2.5,
  coolingWorstKWhPerSqft: 10,
  /** Wall conduction solar weighting: base + exposureMultiplier × normalised exposure. */
  wallExposureBase: 0.7,
  wallExposureMultiplier: 0.6,
  source:
    "Transparent early-stage cooling-load heuristic. NOT a dynamic energy simulation and NOT a code compliance calculation.",
  verified: false as const,
};

export const ENERGY_SCORE_WEIGHTS = {
  daylight: 0.3,
  ventilation: 0.25,
  heat: 0.3,
  shading: 0.15,
} as const;

export const ROOM_ENERGY_WEIGHTS: Record<VastuRoomType, number> = {
  living: 1.2,
  masterBedroom: 1.1,
  bedroom: 1,
  childrenBedroom: 1,
  dining: 0.8,
  kitchen: 0.9,
  pooja: 0.4,
  toilet: 0.2,
  bathroom: 0.2,
  staircase: 0.3,
  store: 0.2,
  parking: 0.1,
  verandah: 0.6,
};

export const ROOM_DAYLIGHT_WEIGHTS: Record<VastuRoomType, number> = {
  living: 1.3,
  masterBedroom: 1.2,
  bedroom: 1.1,
  childrenBedroom: 1.1,
  dining: 1,
  kitchen: 0.8,
  pooja: 0.5,
  toilet: 0.2,
  bathroom: 0.2,
  staircase: 0.3,
  store: 0.2,
  parking: 0.1,
  verandah: 0.7,
};

export const SOLAR_CONFIG = {
  /** Share of the roof assumed available after tanks, parapets, access. */
  usableRoofFraction: 0.6,
  pvEfficiency: 0.18,
  performanceRatio: 0.75,
  /** Placeholder annual plane-of-array irradiance model: base at 20° latitude. */
  irradianceBaseKWhM2Year: 1800,
  irradianceOptimalLatitudeDeg: 20,
  irradianceFalloffKWhPerDegree: 8,
  co2FactorKgPerKWh: 0.82,
  source:
    "Placeholder rooftop-PV yield model; irradiance derived only from latitude, no tilt/shading/temperature model (verified:false)",
  verified: false as const,
};

export const RAINWATER_CONFIG = {
  runoffCoefficient: 0.85,
  source:
    "Common concrete-roof runoff coefficient placeholder; verify with local rainfall normals and first-flush losses",
  verified: false as const,
};

export const WIND_FROM_DEGREES: Record<Orientation8, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

export function orientationFromWall(wall: WallSide): Orientation8 {
  return wall;
}

/**
 * Single list of every energy assumption shown in the UI. Solar geometry
 * rows are standard formulas and are verified:true; every placeholder
 * coefficient is verified:false.
 */
export const ENERGY_ASSUMPTIONS: EnergyAssumption[] = [
  {
    id: "declination",
    label: "Solar declination",
    value: "Cooper equation",
    formula: "δ = 23.45° · sin(360/365 · (284 + n))",
    source: "Cooper (1969) / standard solar geometry",
    verified: true,
  },
  {
    id: "solar-position",
    label: "Solar altitude and azimuth",
    value: "Standard horizontal-coordinate formulas",
    formula:
      "sin α = sin φ sin δ + cos φ cos δ cos H; cos A = (sin δ − sin α sin φ)/(cos α cos φ)",
    source: "Standard solar geometry (NOAA solar calculator formulation)",
    verified: true,
  },
  {
    id: "sunrise",
    label: "Sunrise / sunset",
    value: "Hour angle at the horizon",
    formula: "cos H₀ = −tan φ · tan δ; sunrise/sunset = 12 ∓ H₀/15",
    source: "Standard solar geometry",
    verified: true,
  },
  {
    id: "vertical-incidence",
    label: "Direct sun on a vertical pane",
    value: "Cosine incidence",
    formula: "I = cos α · cos(A − wall azimuth), only when positive",
    source: "Standard solar geometry",
    verified: true,
  },
  {
    id: "solar-days",
    label: "Representative days",
    value: "21 Jun, 21 Dec, 20 Mar",
    formula: "n = 172 (summer), 355 (winter), 79 (equinox), non-leap year",
    source: "Fixed representative dates; no leap-year or equation-of-time adjustment",
    verified: false,
  },
  {
    id: "location-time",
    label: "Time basis",
    value: "Local solar time",
    formula: "H = 15° · (t − 12)",
    source: "No longitude/time-zone conversion, no equation of time",
    verified: false,
  },
  {
    id: "window-height",
    label: "Window height",
    value: "4.5 ft assumed for every window",
    formula: "Window area = window width × 4.5 ft",
    source: "Placeholder; replace with the project window schedule",
    verified: false,
  },
  {
    id: "wall-height",
    label: "Wall height for opaque area",
    value: "10 ft assumed",
    formula: "Opaque wall area = wall span × 10 ft − window area",
    source: "Placeholder storey height; replace with the architectural section",
    verified: false,
  },
  {
    id: "wfr-target",
    label: "Window-to-floor-area target",
    value: "12–16% climate base, orientation-weighted",
    formula: "target% = climate base% × orientation factor",
    source:
      "Heuristic energy/daylight target; larger N/NE and smaller W/SW in hot climates. Not a code requirement.",
    verified: false,
  },
  {
    id: "overhang-depth",
    label: "Required overhang depth",
    value: "1.5–6 ft clamp",
    formula:
      "depth = window height / tan(solar altitude at the critical summer hour), clamped",
    source:
      "Simplified full-shade geometry; ignores wall thickness, window reveal and off-axis sun. E/W walls need vertical fins as well.",
    verified: false,
  },
  {
    id: "overhang-effect",
    label: "Overhang cooling benefit",
    value: "60% of blocked direct sun removed",
    formula: "shadingFactor = 1 − 0.6 × blockedDirectFraction",
    source: "Placeholder effectiveness; not a validated shading coefficient",
    verified: false,
  },
  {
    id: "daylight-index",
    label: "Daylight score",
    value: "0–100 heuristic",
    formula:
      "45% WFR target ratio + 25% orientation factor + 30% depth-ratio score",
    source:
      "Rule-of-thumb daylight index, not a daylight factor / autonomy simulation",
    verified: false,
  },
  {
    id: "daylight-depth",
    label: "Useful daylight depth",
    value: "2.5 × window height",
    formula:
      "depthScore = 100 · (1 − max(0, depth/windowHeight − 2.5)/5), clamped",
    source: "Common rule of thumb; simplified and unverified",
    verified: false,
  },
  {
    id: "ventilation-rule",
    label: "Cross-ventilation classification",
    value: "Opposite > adjacent > single-sided",
    formula:
      "Score = 25 (single-sided), 60 (adjacent) or 80 (opposite) + wind bonuses",
    source:
      "Rule-of-thumb classification; single-vector wind and no pressure-coefficient model",
    verified: false,
  },
  {
    id: "wind-direction",
    label: "Prevailing wind",
    value: "One vector from cities.ts",
    formula: "Wind from the stated compass point; no seasonal reversal",
    source:
      "cities.ts prevailingWind (verified:false); monsoon reversal and local terrain not represented",
    verified: false,
  },
  {
    id: "cooling-load",
    label: "Annual cooling demand",
    value: "Envelope + internal-gain heuristic",
    formula:
      "Q = [wall conduction + window conduction + window solar + internal] × climate factor; E = Q / COP",
    source:
      "Transparent early-stage estimate only; not a dynamic simulation and not a certified load calculation",
    verified: false,
  },
  {
    id: "cooling-cdh",
    label: "Cooling-degree hours",
    value: "2,500–30,000 K·h/year by climate zone",
    formula: "Wall/window conduction = U × area × CDH / 1000",
    source:
      "Placeholder annual CDH values; replace with hourly weather data / degree-day normals",
    verified: false,
  },
  {
    id: "cooling-days",
    label: "Equivalent cooling-season days",
    value: "30–180 days by climate zone",
    formula: "Window solar gain = area × SHGC × daily sun exposure × days",
    source: "Placeholder season length; replace with local weather data",
    verified: false,
  },
  {
    id: "envelope-u",
    label: "Envelope U-values",
    value: "Wall 1.8–2.2, window 4.8–5.8 W/m²K",
    formula: "Conduction = U × area × degree-hours",
    source:
      "Placeholder 230 mm brick wall / single-glazed window values; verify construction build-up",
    verified: false,
  },
  {
    id: "shgc",
    label: "Solar heat gain coefficient",
    value: "0.6–0.7",
    formula: "Solar gain = aperture × SHGC × incident solar energy",
    source: "Placeholder single-glazing SHGC; verify glazing specification",
    verified: false,
  },
  {
    id: "cop",
    label: "Cooling system COP",
    value: "3.0–3.2",
    formula: "Electricity = thermal load / COP",
    source: "Placeholder split-system COP; actual equipment and part-load vary",
    verified: false,
  },
  {
    id: "internal-gain",
    label: "Internal gains",
    value: "12 kWh/m²/year",
    formula: "Internal gain = floor area × 12 kWh/m²/year",
    source: "Placeholder occupancy/appliance gain; not a usage schedule",
    verified: false,
  },
  {
    id: "peak-irradiance",
    label: "Peak direct irradiance",
    value: "0.75 kW/m²",
    formula: "Daily solar exposure (kWh/m²/day) = Σ cos-incidence × 0.75",
    source: "Placeholder clear-sky direct normal irradiance; no diffuse model",
    verified: false,
  },
  {
    id: "wall-solar-weight",
    label: "Opaque wall solar weighting",
    value: "0.7 + 0.6 × normalised exposure",
    formula: "Wall conduction × (0.7 + 0.6 × S_orientation/S_max)",
    source: "Heuristic weighting of opaque-wall conduction by summer exposure",
    verified: false,
  },
  {
    id: "score-weights",
    label: "Energy score weights",
    value: "Daylight 30%, ventilation 25%, heat 30%, shading 15%",
    formula: "score = Σ(component × weight)",
    source: "Engine weighting choice; adjustable only in code, not a standard",
    verified: false,
  },
  {
    id: "roof-solar",
    label: "Rooftop solar potential",
    value: "60% usable roof, 18% PV, 75% performance ratio",
    formula:
      "kWh/year = usable roof m² × irradiance(latitude) × 0.18 × 0.75",
    source:
      "Placeholder yield model; irradiance = 1800 − 8 × |latitude − 20°| kWh/m²/year, no tilt/shading/temperature effects",
    verified: false,
  },
  {
    id: "rainwater",
    label: "Rainwater harvesting",
    value: "85% runoff coefficient",
    formula: "Litres/year = catchment m² × rainfall mm × 0.85",
    source:
      "Placeholder concrete-roof runoff coefficient; first-flush and storage losses not modelled",
    verified: false,
  },
  {
    id: "baseline",
    label: "Model baseline",
    value: "Plain grid, no overhangs, equal windows every side",
    formula: "Same engine metrics on a conventional gridded plan",
    source:
      "A model baseline generated by this engine — NOT a surveyed or benchmarked building",
    verified: false,
  },
];

export function assumptionsFor(
  ids: string[],
): EnergyAssumption[] {
  return ENERGY_ASSUMPTIONS.filter((a) => ids.includes(a.id));
}
