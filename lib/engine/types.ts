/**
 * Pure data types for the Vastushilpa engine.
 * No UI imports are allowed in /lib.
 * Every traditional quantity in /lib/data carries `source` and `verified`.
 */

export type PlotFacing = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type LengthUnit = "ft" | "m";
export type BuildingType = "residential" | "school" | "office";

/**
 * Climate classification per NBC 2016 (hot-dry, warm-humid, composite,
 * temperate, cold). TODO: verify category labels + map against the
 * official NBC 2016 climate zone map before relying on assignments.
 */
export type ClimateZone =
  | "hot-dry"
  | "warm-humid"
  | "composite"
  | "temperate"
  | "cold";

/** IS 1893 (Part 1) seismic zoning. TODO: verify per city against the official zone map. */
export type SeismicZone = "II" | "III" | "IV" | "V";

/** Plot/site data as entered by the user. */
export interface PlotInput {
  /**
   * EAST-WEST extent of the plot, in `unit`.
   *
   * AXIS CONVENTION (the one the plot preview already uses, applied
   * everywhere in the engine and plan view): the plot is drawn north-up,
   * so length always runs east-west and width always runs north-south.
   * Length is NOT the "longer side" — any positive pair is valid.
   * See lib/engine/vastuGrid.ts for the full coordinate system.
   */
  length: number;
  /** NORTH-SOUTH extent of the plot, in `unit` (see the note on `length`). */
  width: number;
  unit: LengthUnit;
  facing: PlotFacing;
  /** City id, see /lib/data/cities.ts */
  city: string;
  buildingType: BuildingType;
  bedrooms: number;
  poojaRoom: boolean;
  parking: boolean;
  elderlyGroundFloor: boolean;
}

export interface CityData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  climateZone: ClimateZone;
  seismicZone: SeismicZone;
  /**
   * Approximate normals: summer = hottest-month normal, winter = coldest-month
   * normal. Meaning of "normal" (daily mean vs. daily max) is itself
   * approximate until verified against IMD normals.
   */
  avgSummerTempC: number;
  avgWinterTempC: number;
  avgRelativeHumidityPct: number;
  annualRainfallMm: number;
  /** Free-form: seasonal reversal is NOT captured (see notes). */
  prevailingWind: string;
  source: string;
  verified: boolean;
  notes?: string;
}

/* ------------------------------ Ayadi ------------------------------ */

export type AyadiKey = "aaya" | "vyaya" | "yoni" | "nakshatra" | "vara" | "tithi";

/** One row of a formula's result-to-meaning table. */
export interface AyadiClassRow {
  /** 0-based index = remainder position for this formula. */
  label: string;
  meaning: string;
  auspicious: boolean;
}

export interface AyadiConstants {
  /** 1 hasta in feet (common modern convention; historically variable). */
  hastaFeet: number;
  /** 1 hasta in metres (same convention). */
  hastaMeters: number;
  source: string;
  verified: boolean;
}

export interface AyadiFormulaConfig {
  key: AyadiKey;
  /** Name with Devanagari if useful for UI display. */
  name: string;
  nameEn: string;
  /** Human-readable description of the encoded formula. */
  formulaText: string;
  /**
   * Encoded numeric form: (lengthHasta * widthHasta * multiplier) % divisor,
   * reduced again mod classCount to index resultTable.
   * null = deliberately not digitized (formula unknown / not reproduced).
   */
  multiplier: number | null;
  divisor: number | null;
  classCount: number | null;
  resultTable: AyadiClassRow[];
  /**
   * true = the engine scores this formula into the aggregate verdict;
   * false = slot exists but the auspicious mapping is unknown, so it is
   * displayed as "not evaluated" and excluded from the aggregate.
   */
  evaluates: boolean;
  /** Where the known text/sources disagree, recorded here. */
  variants?: string;
  source: string;
  verified: boolean;
}

/** Cross-formula rule (e.g. income must exceed expenditure). */
export interface AyadiDerivedCheck {
  key: string;
  description: string;
  calculation: string;
  source: string;
  verified: boolean;
}

/** One line of the worked calculation, so the UI can show the working. */
export interface AyadiStep {
  label: string;
  formulaText: string;
  /** Numbers actually plugged in. */
  calculation: string;
  result: string;
  evaluated: boolean;
  auspicious: boolean | null;
  unverified: boolean;
}

export interface AyadiFormulaResult {
  key: AyadiKey;
  name: string;
  evaluated: boolean;
  /** null = not evaluated (unknown auspicious mapping). */
  auspicious: boolean | null;
}

export interface AyadiResult {
  /** Chronological working, conversion step first, derived checks last. */
  steps: AyadiStep[];
  perFormula: AyadiFormulaResult[];
  overallAuspicious: boolean;
  unverifiedCount: number;
}

/** A dimension pair found by suggestNearestAuspicious(). */
export interface AyadiSuggestion {
  /** In the same unit as the input plot. */
  length: number;
  width: number;
  unit: LengthUnit;
  /** Signed offsets applied, always in ft (0.5 ft grid). */
  deltaLengthFt: number;
  deltaWidthFt: number;
}

/* ------------------ Vastu grid, layouts and scoring ------------------ */

/**
 * The nine zones of the 3x3 vastu mandala.
 * Row order (north row first): NW N NE / W C E / SW S SE.
 * "C" is the Brahmasthan — the engine keeps it free of rooms.
 */
export type VastuZoneId = "NW" | "N" | "NE" | "W" | "C" | "E" | "SW" | "S" | "SE";

/** Axis convention (same one as the plot preview): x runs west→east along
 * the plot's length (east-west axis), y runs north→south along the plot's
 * width (north-south axis), so y increases toward the south and the plan
 * is always drawn north-up. All engine geometry is in feet. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type VastuRoomType =
  | "living"
  | "kitchen"
  | "dining"
  | "masterBedroom"
  | "bedroom"
  | "childrenBedroom"
  | "pooja"
  | "toilet"
  | "bathroom"
  | "staircase"
  | "store"
  | "parking"
  | "verandah";

/** How far from preferred zones a room may go. */
export type Strictness = "strict" | "balanced" | "flexible";

/**
 * Layout mode. vastu-first = strict zone compliance, energy-first = favours
 * daylight/ventilation for living spaces and pushes services to the hot
 * sides, balanced = in between.
 */
export type LayoutMode = "vastu-first" | "energy-first" | "balanced";

/** Compass side of a room/plot wall. */
export type WallSide = "N" | "E" | "S" | "W";

/** One door opening: `at` is feet from the wall's low-coordinate edge. */
export interface DoorMark {
  wall: WallSide;
  at: number;
  width: number;
}

/** One window symbol: `at` is feet from the wall's low-coordinate edge. */
export interface WindowMark {
  wall: WallSide;
  at: number;
  width: number;
}

/** A room placed on the plan. */
export interface PlanRoom {
  id: string;
  type: VastuRoomType;
  label: string;
  rect: Rect;
  /** Primary (largest-overlap) vastu zone of the room. */
  zone: VastuZoneId;
  doors: DoorMark[];
  windows: WindowMark[];
}

/** The main entrance: wall, position along that wall, door width. */
export interface EntranceMark {
  wall: WallSide;
  /** Feet along the wall, measured from the wall's low-coordinate edge. */
  at: number;
  width: number;
  zone: VastuZoneId;
  label: string;
  ruleLabel: string;
  /** Road-side point (plot coords) the entry arrow starts from. */
  arrowFrom: { x: number; y: number };
  source: string;
  verified: boolean;
}

/** A generated layout (mode id, name, rooms, entrance, notes). */
export interface Layout {
  id: LayoutMode;
  name: string;
  mode: LayoutMode;
  rooms: PlanRoom[];
  entrance: EntranceMark;
  /** Human-readable notes: relaxations, dropped rooms, fit warnings. */
  notes: string[];
}

export interface VastuGridCell {
  zone: VastuZoneId;
  rect: Rect;
}

/** The 3x3 zone grid (incl. Brahmasthan) and the 9x9 pada display grid. */
export interface VastuGrid {
  lengthFt: number;
  widthFt: number;
  /** 9 cells in row-major order starting at the NW corner. */
  cells: VastuGridCell[];
  /** 81 pada rectangles, row-major from the NW corner (display only). */
  padas: Rect[];
}

export type VastuStatus = "ideal" | "acceptable" | "poor";

/** One scored line item of the vastu score. */
export interface VastuCheck {
  /** Display label, e.g. the room label or "Main entrance". */
  label: string;
  roomType?: VastuRoomType;
  zone: VastuZoneId | null;
  status: VastuStatus;
  points: number;
  maxPoints: number;
  reason: string;
  /** Present for poor/acceptable rows. */
  remedy?: string;
  /** The rule behind the verdict, cited as data. */
  why: string;
  source: string;
  verified: boolean;
}

export interface VastuResult {
  layoutId: LayoutMode;
  score100: number;
  breakdown: VastuCheck[];
  counts: { ideal: number; acceptable: number; poor: number };
  entrance: VastuCheck;
  brahmasthan: VastuCheck;
  symmetry: VastuCheck;
  /** Fraction (0..1) of the max score that depends on unverified rules. */
  unverifiedShare: number;
}
