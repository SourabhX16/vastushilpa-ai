import {
  ENTRANCE_RULES,
  VASTU_ROOM_CONFIG,
} from "../data/vastu.config";
import { getCityById } from "../data/cities";
import { CLIMATE_ENERGY_PROFILES, orientationFromWall } from "../data/energy.config";
import type {
  DoorMark,
  EntranceMark,
  Layout,
  LayoutMode,
  PlanRoom,
  PlotInput,
  Rect,
  Strictness,
  VastuZoneId,
  WallSide,
} from "./types";
import {
  ALL_ZONES,
  getRoadWalls,
  innerRect,
  overlapArea,
  rectArea,
  rectCenter,
  roadAdjacentZones,
  subtractAll,
  toFeet,
  zoneOfPoint,
} from "./vastuGrid";

/*
 * Layout generator — a pure, deterministic constrained search.
 *
 * The engine splits the plot into the 3x3 vastu zone grid (see vastuGrid.ts
 * for the coordinate system: x = east-west extent (length), y = north-south
 * extent (width), origin at the NW corner) and places the room programme
 * (built from the PlotInput) into single zone cells or straight-line merges
 * of two/three cells — never into the Brahmasthan. Free space per candidate
 * cell-union is tracked BSP-style (rectangle subtraction), every room gets a
 * realistic minimum area, and rectangle sides snap to a 0.5 ft grid.
 *
 * Objectives are weighted per mode (vastu-first: zone rank dominates;
 * energy-first: daylight/heat preference dominates; balanced: in between)
 * and the strictness parameter decides how far from preferred zones a room
 * may go. Everything is deterministic: stable orderings, no randomness.
 */

export const LAYOUT_MODES: LayoutMode[] = ["vastu-first", "energy-first", "balanced"];

const MODE_WEIGHTS: Record<LayoutMode, { vastu: number; energy: number }> = {
  "vastu-first": { vastu: 10, energy: 1 },
  balanced: { vastu: 6, energy: 6 },
  "energy-first": { vastu: 1, energy: 12 },
};

/** How far a room may descend from preferred zones per strictness. */
const PASS_TIERS: Record<Strictness, ("preferred" | "acceptable" | "all")[][]> = {
  strict: [["preferred"], ["preferred", "acceptable"], ["all"]],
  balanced: [["preferred", "acceptable"], ["all"]],
  flexible: [["all"]],
};

const TIER_LABELS: Record<Strictness, string[]> = {
  strict: ["preferred zones", "acceptable zones", "any free zone (last resort)"],
  balanced: ["preferred or acceptable zones", "any free zone (relaxed)"],
  flexible: ["configured preferred/acceptable/avoid zones"],
};

/* ------------------------------ room programme ------------------------------ */

interface RoomSpec {
  id: string;
  type: PlanRoom["type"];
  label: string;
  minArea: number;
  prefArea: number;
  minSide: number;
  aspect: number;
  /** Cost per unit of normalised distance to the entrance arrow point. */
  entranceWeight: number;
  /** Hard requirement: bay/break room must touch a road-facing side. */
  roadAccess: boolean;
  /** Required rooms are packed before any yielding room. */
  required: boolean;
  /** Vastu-preferred door walls (pooja), falls back to circulation logic. */
  doorWalls?: WallSide[];
}

/**
 * Builds the ground-floor room programme from the input. All bedrooms are
 * listed; bedrooms that cannot fit are reported in the notes as moved to a
 * notional first floor, other rooms as omitted.
 */
function buildRoomProgram(plot: PlotInput): RoomSpec[] {
  const cfg = VASTU_ROOM_CONFIG;
  const specs: RoomSpec[] = [];

  const push = (spec: Omit<RoomSpec, "type" | "required">, type: PlanRoom["type"]) => {
    const required = ["pooja", "masterBedroom", "verandah", "bathroom", "toilet", "kitchen", "staircase", "living"].includes(type);
    specs.push({ type, required, ...spec });
  };
  const fromCfg = (type: PlanRoom["type"]) => {
    const r = cfg[type];
    return {
      minArea: r.minAreaSqft,
      prefArea: r.preferredAreaSqft,
      minSide: r.minSideFt,
      aspect: r.aspect,
      doorWalls: r.doorWalls,
    };
  };

  if (plot.poojaRoom) {
    push(
      { id: "pooja", label: "Pooja room", ...fromCfg("pooja"), entranceWeight: 0.2, roadAccess: false },
      "pooja",
    );
  }

  push(
    { id: "master-bed", label: "Master bedroom", ...fromCfg("masterBedroom"), entranceWeight: 0, roadAccess: false },
    "masterBedroom",
  );

  if (plot.parking) {
    push(
      { id: "parking", label: "Parking bay", ...fromCfg("parking"), entranceWeight: 0.6, roadAccess: true },
      "parking",
    );
  }

  // The verandah anchors the entrance side early, before interiors pack it.
  push(
    {
      id: "verandah",
      label: "Entrance verandah / foyer",
      ...fromCfg("verandah"),
      entranceWeight: 3.2,
      roadAccess: true,
    },
    "verandah",
  );

  push(
    { id: "bathroom", label: "Bathroom", ...fromCfg("bathroom"), entranceWeight: 0, roadAccess: false },
    "bathroom",
  );

  // Toilets claim their NW/W pockets early, before larger rooms close them.
  push(
    { id: "toilet-1", label: "Toilet (common)", ...fromCfg("toilet"), entranceWeight: 0, roadAccess: false },
    "toilet",
  );

  if (plot.elderlyGroundFloor) {
    // Second, entrance-side toilet for the elderly-friendly ground floor.
    push(
      {
        id: "toilet-2",
        label: "Toilet (elderly / entrance side)",
        ...fromCfg("toilet"),
        entranceWeight: 1.6,
        roadAccess: false,
      },
      "toilet",
    );
  }

  push(
    { id: "kitchen", label: "Kitchen", ...fromCfg("kitchen"), entranceWeight: 0, roadAccess: false },
    "kitchen",
  );

  push(
    {
      id: "staircase",
      label: "Staircase (to first floor)",
      ...fromCfg("staircase"),
      entranceWeight: 0,
      roadAccess: false,
    },
    "staircase",
  );

  push(
    { id: "living", label: "Living room", ...fromCfg("living"), entranceWeight: 0.9, roadAccess: false },
    "living",
  );

  const bedrooms = Math.max(1, Math.round(plot.bedrooms));
  // Bedroom slots: master, Bedroom 2, Children's bedroom (3rd slot), then 4, 5.
  for (let i = 2; i <= bedrooms; i++) {
    const isChildrenSlot = i === 3;
    const type: PlanRoom["type"] = isChildrenSlot ? "childrenBedroom" : "bedroom";
    // Elderly-friendly ground floor nudges the first spare bedroom (and the
    // second toilet above) toward the entrance side.
    const elderly = plot.elderlyGroundFloor && i === 2;
    push(
      {
        id: `bed-${i}`,
        label: isChildrenSlot ? "Children's bedroom" : `Bedroom ${i}`,
        ...fromCfg(type),
        entranceWeight: elderly ? 2.2 : 0,
        roadAccess: false,
      },
      type,
    );
  }

  push(
    { id: "dining", label: "Dining", ...fromCfg("dining"), entranceWeight: 0.3, roadAccess: false },
    "dining",
  );

  if (bedrooms >= 4) {
    push(
      { id: "store", label: "Store room", ...fromCfg("store"), entranceWeight: 0, roadAccess: false },
      "store",
    );
  }

  return specs;
}

/* ------------------------------ entrance ------------------------------ */

function computeEntrance(
  lengthFt: number,
  widthFt: number,
  plot: PlotInput,
): EntranceMark {
  const rule = ENTRANCE_RULES[plot.facing];
  const wallLen = rule.wall === "N" || rule.wall === "S" ? lengthFt : widthFt;
  const segLen = Math.max(2, (rule.to - rule.from) * wallLen);
  const doorWidth = Math.min(4.5, Math.max(2.8, segLen * 0.7));
  const segMid = ((rule.from + rule.to) / 2) * wallLen;
  const center = Math.min(wallLen - 0.9, Math.max(0.9, segMid));
  const at = center - doorWidth / 2;

  // Zone: sample a point just inside the hosting wall.
  let px = 0;
  let py = 0;
  if (rule.wall === "E") {
    px = lengthFt - 0.2;
    py = center;
  } else if (rule.wall === "W") {
    px = 0.2;
    py = center;
  } else if (rule.wall === "N") {
    px = center;
    py = 0.2;
  } else {
    px = center;
    py = widthFt - 0.2;
  }

  // Road-side arrow origin, just outside the hosting wall.
  let arrowX = 0;
  let arrowY = 0;
  if (rule.wall === "E") {
    arrowX = lengthFt + 1.4;
    arrowY = center;
  } else if (rule.wall === "W") {
    arrowX = -1.4;
    arrowY = center;
  } else if (rule.wall === "N") {
    arrowX = center;
    arrowY = -1.4;
  } else {
    arrowX = center;
    arrowY = widthFt + 1.4;
  }

  return {
    wall: rule.wall,
    at,
    width: doorWidth,
    zone: zoneOfPoint(lengthFt, widthFt, px, py),
    label: `Main door — ${plot.facing} facing`,
    ruleLabel: rule.label,
    arrowFrom: { x: arrowX, y: arrowY },
    source: rule.source,
    verified: rule.verified,
  };
}

/* ------------------------------ candidate enumeration ------------------------------ */

interface Candidate {
  zones: VastuZoneId[];
  box: Rect;
  cost: number;
}

/** Straight-line merged sets (C is never a member). */
const MERGE_SETS: VastuZoneId[][] = [
  ["NW", "N"],
  ["N", "NE"],
  ["SW", "S"],
  ["S", "SE"],
  ["NW", "W"],
  ["W", "SW"],
  ["NE", "E"],
  ["E", "SE"],
  ["NW", "N", "NE"],
  ["SW", "S", "SE"],
  ["NW", "W", "SW"],
  ["NE", "E", "SE"],
];

function zoneRectFor(lengthFt: number, widthFt: number, zone: VastuZoneId): Rect {
  const col = ALL_ZONES.indexOf(zone) % 3;
  const row = Math.floor(ALL_ZONES.indexOf(zone) / 3);
  return { x: (col * lengthFt) / 3, y: (row * widthFt) / 3, w: lengthFt / 3, h: widthFt / 3 };
}

function unionRect(lengthFt: number, widthFt: number, zones: VastuZoneId[]): Rect {
  let x = Infinity;
  let y = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const z of zones) {
    const r = zoneRectFor(lengthFt, widthFt, z);
    x = Math.min(x, r.x);
    y = Math.min(y, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x, y, w: x2 - x, h: y2 - y };
}

/** 0..~2.5 vastu rank cost: preferred ~0, acceptable ~1, avoid/rest ~2+. */
function zoneRankCost(spec: RoomSpec, zone: VastuZoneId): number {
  const cfg = VASTU_ROOM_CONFIG[spec.type];
  const pIdx = cfg.preferred.indexOf(zone);
  if (pIdx >= 0) return 0.1 * pIdx;
  const aIdx = cfg.acceptable.indexOf(zone);
  if (aIdx >= 0) return 1 + 0.1 * aIdx;
  const vIdx = cfg.avoid.indexOf(zone);
  if (vIdx >= 0) return 2 + 0.1 * vIdx;
  return 2.5;
}

/** 0..~2 climate/objective cost depending on the room's energy profile. */
function energyCost(spec: RoomSpec, lengthFt: number, widthFt: number, rect: Rect, cityId: string): number {
  const cfg = VASTU_ROOM_CONFIG[spec.type];
  const city = getCityById(cityId);
  const factors = CLIMATE_ENERGY_PROFILES[city?.climateZone ?? "composite"].daylightOrientationFactor;
  const touched = (["N", "E", "S", "W"] as WallSide[]).filter((wall) =>
    wallTouchesPlotSide(rect, wall, lengthFt, widthFt),
  );
  // Generated daylight windows use these same exterior walls. Weight a room
  // by the scorer's own orientation factors rather than its zone centroid.
  const orientations = (touched.length ? touched : ["N", "E", "S", "W"] as WallSide[])
    .map(orientationFromWall);
  const mean = orientations.reduce((sum, orientation) => sum + factors[orientation], 0) / orientations.length;
  const best = Math.max(...Object.values(factors));
  const worst = Math.min(...Object.values(factors));
  if (cfg.daylight) {
    return best > worst ? (best - mean) / (best - worst) : 0;
  }
  return best > worst ? (mean - worst) / (best - worst) : 0;
}

function isAllowedZone(
  tierList: ("preferred" | "acceptable" | "all")[],
  spec: RoomSpec,
  zone: VastuZoneId,
): boolean {
  const cfg = VASTU_ROOM_CONFIG[spec.type];
  if (tierList.includes("all")) return zone !== "C";
  if (tierList.includes("preferred") && cfg.preferred.includes(zone)) return true;
  if (tierList.includes("acceptable") && cfg.acceptable.includes(zone)) return true;
  return false;
}

function enumerateCandidates(
  spec: RoomSpec,
  tierList: ("preferred" | "acceptable" | "all")[],
  lengthFt: number,
  widthFt: number,
  inner: Rect,
  entrance: EntranceMark,
  facing: PlotInput["facing"],
  cityId: string,
  mode: LayoutMode,
): Candidate[] {
  const universe = spec.roadAccess
    ? roadAdjacentZones(facing)
    : ALL_ZONES.filter((z) => z !== "C");
  const effectiveTiers: ("preferred" | "acceptable" | "all")[] = mode !== "vastu-first" && tierList.includes("preferred")
    ? tierList.includes("acceptable") ? tierList : [...tierList, "acceptable"]
    : tierList;
  const allowed = universe.filter((z) => isAllowedZone(effectiveTiers, spec, z));

  const sets: VastuZoneId[][] = [];
  for (const z of allowed) sets.push([z]);
  for (const merge of MERGE_SETS) {
    if (merge.every((z) => allowed.includes(z))) sets.push(merge);
  }

  const weights = MODE_WEIGHTS[mode];
  const diag = Math.hypot(lengthFt, widthFt);

  const candidates: Candidate[] = [];
  for (const zones of sets) {
    const union = unionRect(lengthFt, widthFt, zones);
    // Clip the candidate box to the usable inner area (inside the outer wall).
    const x1 = Math.max(union.x, inner.x);
    const y1 = Math.max(union.y, inner.y);
    const x2 = Math.min(union.x + union.w, inner.x + inner.w);
    const y2 = Math.min(union.y + union.h, inner.y + inner.h);
    const box: Rect = { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
    if (box.w <= 0.1 || box.h <= 0.1) continue;

    const boxCenter = rectCenter(box);
    const vastu =
      zones.reduce((sum, z) => sum + zoneRankCost(spec, z), 0) / zones.length;
    const energy = energyCost(spec, lengthFt, widthFt, box, cityId);
    const entryAdj =
      spec.entranceWeight *
      (Math.hypot(
        boxCenter.x - entrance.arrowFrom.x,
        boxCenter.y - entrance.arrowFrom.y,
      ) /
        diag);
    const cost =
      weights.vastu * vastu +
      weights.energy * energy +
      entryAdj +
      (zones.length - 1) * 0.15;
    candidates.push({ zones, box, cost });
  }

  // Deterministic order: cost, then zone list in canonical join order.
  candidates.sort(
    (a, b) =>
      a.cost - b.cost ||
      a.zones.join("+").localeCompare(b.zones.join("+")) ||
      a.zones.length - b.zones.length,
  );
  return candidates;
}

/* ------------------------------ room fitting ------------------------------ */

const SNAP = 0.5;

function snapDown(value: number): number {
  return Math.floor(value / SNAP) * SNAP;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Fits the room into any of the free rects; prefers rect sizes near prefArea. */
function fitRoomInFree(
  spec: RoomSpec,
  free: Rect[],
  roadWalls: WallSide[],
): Rect | null {
  const rects = [...free].sort(
    (a, b) => rectArea(b) - rectArea(a) || a.x - b.x || a.y - b.y,
  );

  for (const f of rects) {
    const fitArea = Math.min(spec.prefArea, rectArea(f));
    if (fitArea < spec.minArea - 1e-9) continue;

    const sizeCandidates: { w: number; h: number }[] = [];
    const w0 = Math.min(f.w, Math.sqrt(fitArea * spec.aspect));
    sizeCandidates.push({ w: w0, h: fitArea / w0 });
    const h0 = Math.min(f.h, Math.sqrt(fitArea / spec.aspect));
    sizeCandidates.push({ w: fitArea / h0, h: h0 });
    // Strip fills along either axis (kept for stacked small service rooms).
    sizeCandidates.push({ w: f.w, h: fitArea / f.w });
    sizeCandidates.push({ w: fitArea / f.h, h: f.h });

    let best: { rect: Rect; gap: number } | null = null;
    for (const cand of sizeCandidates) {
      let w = snapDown(cand.w);
      let h = snapDown(cand.h);
      if (w < spec.minSide || h < spec.minSide) {
        const rotatedW = h;
        const rotatedH = w;
        w = snapDown(rotatedW);
        h = snapDown(rotatedH);
      }
      if (w < spec.minSide || h < spec.minSide || w > f.w + 1e-9 || h > f.h + 1e-9) {
        continue;
      }
      // Grow on a snapped grid until the area covers minArea (box allowing).
      while (w + SNAP <= f.w + 1e-9 && (w + SNAP) * h < spec.minArea) w += SNAP;
      while (h + SNAP <= f.h + 1e-9 && w * (h + SNAP) < spec.minArea) h += SNAP;
      if (w * h < spec.minArea - 1e-9) continue;

      const areaGap = Math.abs(w * h - spec.prefArea);
      if (best && areaGap >= best.gap) continue;

      // Position: default NW corner of the free rect; special anchors below.
      let px = f.x;
      let py = f.y;
      if (spec.type === "pooja") {
        // Pooja hugs the NE corner of its frame (Ishanya anchor).
        px = f.x + f.w - w;
        py = f.y;
      } else if (spec.roadAccess) {
        // Parking/verandah hug the road-facing wall.
        if (roadWalls.includes("W")) px = f.x;
        else if (roadWalls.includes("E")) px = f.x + f.w - w;
        if (roadWalls.includes("N")) py = f.y;
        else if (roadWalls.includes("S")) py = f.y + f.h - h;
      }
      px = clampNum(px, f.x, f.x + f.w - w);
      py = clampNum(py, f.y, f.y + f.h - h);
      best = { rect: { x: px, y: py, w, h }, gap: areaGap };
    }
    if (best) return best.rect;
  }
  return null;
}

/* ------------------------------ room assembly ------------------------------ */

function wallTouchesPlotSide(
  rect: Rect,
  wall: WallSide,
  lengthFt: number,
  widthFt: number,
): boolean {
  switch (wall) {
    case "W":
      return rect.x <= 0.5 + 1e-9;
    case "E":
      return lengthFt - (rect.x + rect.w) <= 0.5 + 1e-9;
    case "N":
      return rect.y <= 0.5 + 1e-9;
    case "S":
      return widthFt - (rect.y + rect.h) <= 0.5 + 1e-9;
  }
}

function buildRoom(
  spec: RoomSpec,
  rect: Rect,
  lengthFt: number,
  widthFt: number,
  zones: VastuZoneId[],
  roadWalls: WallSide[],
): PlanRoom {
  const roomCenter = rectCenter(rect);

  // Primary zone: largest overlap restricted to the candidate zones.
  let zone: VastuZoneId = zones[0];
  let bestOverlap = -1;
  for (const z of zones) {
    const overlap = overlapArea(rect, zoneRectFor(lengthFt, widthFt, z));
    if (overlap > bestOverlap + 1e-9) {
      bestOverlap = overlap;
      zone = z;
    }
  }

  // Perimeter walls the room effectively touches (windows/go doors).
  const touched: WallSide[] = (["N", "E", "S", "W"] as WallSide[]).filter((w) =>
    wallTouchesPlotSide(rect, w, lengthFt, widthFt),
  );

  // Windows on the daylight-priority outer walls.
  const windows: DoorMark[] = [];
  if (VASTU_ROOM_CONFIG[spec.type].daylight) {
    for (const wall of touched) {
      const wallSpan = wall === "N" || wall === "S" ? rect.w : rect.h;
      if (wallSpan < 3) continue;
      const winWidth = Math.min(4.5, Math.max(2.5, wallSpan * 0.7));
      const at = clampNum(wallSpan / 2 - winWidth / 2, 0.5, Math.max(0.5, wallSpan - winWidth - 0.5));
      windows.push({ wall, at, width: winWidth });
    }
  }

  // Door: config preference (pooja) → road side (parking/verandah) →
  // wall pointing toward the circulation (nearest to the plot centre).
  const orderedDoorWalls: WallSide[] = [];
  const preferred = spec.doorWalls?.filter((w) => {
    if (spec.type === "pooja") return true;
    return touched.includes(w);
  });
  if (preferred) orderedDoorWalls.push(...preferred);
  if (spec.roadAccess) {
    orderedDoorWalls.push(...roadWalls);
  }
  // Wall whose midpoint is closest to the plot centre (circulation proxy).
  const centreSorted = (["N", "E", "S", "W"] as WallSide[])
    .map((wall) => {
      const mid =
        wall === "N"
          ? { x: roomCenter.x, y: rect.y }
          : wall === "S"
            ? { x: roomCenter.x, y: rect.y + rect.h }
            : wall === "E"
              ? { x: rect.x + rect.w, y: roomCenter.y }
              : { x: rect.x, y: roomCenter.y };
      return { wall, d: Math.hypot(mid.x - lengthFt / 2, mid.y - widthFt / 2) };
    })
    .sort((a, b) => a.d - b.d)
    .map((entry) => entry.wall);
  orderedDoorWalls.push(...centreSorted);

  const doors: DoorMark[] = [];
  const roadDoor = orderedDoorWalls.find(
    (w) => roadWalls.includes(w) && wallTouchesPlotSide(rect, w, lengthFt, widthFt),
  );
  if (roadDoor && spec.roadAccess) {
    const span = roadDoor === "N" || roadDoor === "S" ? rect.w : rect.h;
    const width = Math.min(3.2, Math.max(2.5, span * 0.6));
    doors.push({ wall: roadDoor, at: clampNum(span / 2 - width / 2, 0.5, Math.max(0.5, span - width - 0.5)), width });
  }
  const innerDoor = orderedDoorWalls.find(
    (w) => w !== roadDoor && (!spec.roadAccess || !roadWalls.includes(w)),
  );
  if (innerDoor) {
    const span = innerDoor === "N" || innerDoor === "S" ? rect.w : rect.h;
    const width = Math.min(3, Math.max(2.4, span * 0.55));
    doors.push({
      wall: innerDoor,
      at: clampNum(span * 0.4, 0.5, Math.max(0.5, span - width - 0.5)),
      width,
    });
  }

  return { id: spec.id, type: spec.type, label: spec.label, rect, zone, doors, windows };
}

/* ------------------------------ one layout ------------------------------ */

function buildLayoutForMode(
  plot: PlotInput,
  lengthFt: number,
  widthFt: number,
  inner: Rect,
  entrance: EntranceMark,
  mode: LayoutMode,
  strictness: Strictness,
): Layout {
  const notes: string[] = [];
  const roadWalls = getRoadWalls(plot.facing);

  // Plot-level feasibility notes (the tests look for these).
  const minSide = Math.min(lengthFt, widthFt);
  if (minSide < 17) {
    notes.push(
      `Narrow plot - ${minSide.toFixed(1)} ft minimum side: zone cells are slim, so this plan is indicative rather than buildable.`,
    );
  }
  if (lengthFt * widthFt < 450) {
    notes.push("Plot too small for a family home; several rooms are omitted below.");
  }

  const specs = buildRoomProgram(plot).sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    const optionalOrder = (spec: RoomSpec) =>
      spec.type === "parking" ? 0 : spec.type === "store" ? 1 : spec.type === "dining" ? 2 : 3;
    return optionalOrder(a) - optionalOrder(b);
  });
  const placedRooms: PlanRoom[] = [];
  const placedRects: Rect[] = [];
  const relaxed: string[] = [];
  const dropped: string[] = [];
  let remaining = new Set(specs);

  const passLists = PASS_TIERS[strictness];
  for (let passIndex = 0; passIndex < passLists.length; passIndex++) {
    const tierList = passLists[passIndex];
    for (const spec of specs) {
      if (!remaining.has(spec)) continue;
      const candidates = enumerateCandidates(
        spec,
        tierList,
        lengthFt,
        widthFt,
        inner,
        entrance,
        plot.facing,
        plot.city,
        mode,
      );
      let chosen: { candidate: Candidate; rect: Rect } | null = null;
      for (const cand of candidates) {
        const obstacles = placedRects.filter((r) => overlapArea(r, cand.box) > 1e-9);
        const free = subtractAll(cand.box, obstacles);
        const rect = fitRoomInFree(spec, free, roadWalls);
        if (rect) {
          chosen = { candidate: cand, rect };
          break;
        }
      }
      if (chosen) {
        const room = buildRoom(
          spec,
          chosen.rect,
          lengthFt,
          widthFt,
          chosen.candidate.zones,
          roadWalls,
        );
        placedRooms.push(room);
        placedRects.push(room.rect);
        remaining.delete(spec);
        if (passIndex > 0) {
          const tier = TIER_LABELS[strictness][passIndex] ?? "a relaxed zone set";
          relaxed.push(`${room.label} placed in the ${room.zone} zone (${tier}) to fit the ground floor.`);
        }
      }
    }
    if (remaining.size === 0) break;
  }

  // If a required room still cannot fit, clear the optional programme and
  // retry once with only required rooms so yielded space cannot block it.
  if (specs.some((spec) => spec.required && remaining.has(spec))) {
    placedRooms.length = 0;
    placedRects.length = 0;
    remaining = new Set(specs.filter((spec) => spec.required));
    for (const tierList of passLists) {
      for (const spec of specs.filter((entry) => entry.required)) {
        if (!remaining.has(spec)) continue;
        for (const candidate of enumerateCandidates(spec, tierList, lengthFt, widthFt, inner, entrance, plot.facing, plot.city, mode)) {
          const free = subtractAll(candidate.box, placedRects.filter((r) => overlapArea(r, candidate.box) > 1e-9));
          const rect = fitRoomInFree(spec, free, roadWalls);
          if (!rect) continue;
          const room = buildRoom(spec, rect, lengthFt, widthFt, candidate.zones, roadWalls);
          placedRooms.push(room);
          placedRects.push(room.rect);
          remaining.delete(spec);
          break;
        }
      }
      if (remaining.size === 0) break;
    }
    for (const spec of specs.filter((entry) => !entry.required)) {
      let placed = false;
      for (const tierList of passLists) {
        for (const candidate of enumerateCandidates(spec, tierList, lengthFt, widthFt, inner, entrance, plot.facing, plot.city, mode)) {
          const free = subtractAll(candidate.box, placedRects.filter((r) => overlapArea(r, candidate.box) > 1e-9));
          const rect = fitRoomInFree(spec, free, roadWalls);
          if (!rect) continue;
          const room = buildRoom(spec, rect, lengthFt, widthFt, candidate.zones, roadWalls);
          placedRooms.push(room);
          placedRects.push(room.rect);
          remaining.delete(spec);
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed) remaining.add(spec);
    }
  }

  for (const spec of specs) {
    if (!remaining.has(spec)) continue;
    if (spec.type === "bedroom" || spec.type === "childrenBedroom") {
      dropped.push(`${spec.label} moved to the notional first floor (ground footprint is full).`);
    } else {
      dropped.push(spec.required
        ? `${spec.label} could not be placed: plot too small.`
        : `${spec.label} omitted: the ground-floor footprint is too full or too small.`);
    }
  }

  for (const note of relaxed) notes.push(note);
  for (const note of dropped) notes.push(note);
  if (relaxed.length === 0 && dropped.length === 0) {
    notes.push("Every room fits in one of its preferred or acceptable zones; the Brahmasthan stays open.");
  }
  if (plot.elderlyGroundFloor) {
    notes.push(
      "Elderly-friendly ground floor: a spare bedroom and a second toilet sit near the entrance.",
    );
  }

  return {
    id: mode,
    name:
      mode === "vastu-first"
        ? "Vastu-first plan"
        : mode === "energy-first"
          ? "Energy-first plan"
          : "Balanced plan",
    mode,
    rooms: placedRooms,
    entrance,
    notes,
  };
}

/**
 * Generate three deterministic candidate layouts for the supplied plot.
 *
 * Use this when the planner needs comparable Vastu-first, energy-first, and
 * balanced options. Input plot dimensions can be feet or metres; generated
 * rectangle coordinates and dimensions are in feet. The plot origin is at
 * the north-west corner, x increases eastward, and y increases southward
 * (north is up when displayed). Placement uses a constrained, rule-based
 * search over Vastu zones and does not guarantee that every requested room
 * fits on the ground floor. Configured Vastu and climate preferences are not
 * all verified.
 */
export function generateLayouts(
  plot: PlotInput,
  strictness: Strictness = "balanced",
): Layout[] {
  if (
    !Number.isFinite(plot.length) ||
    !Number.isFinite(plot.width) ||
    plot.length <= 0 ||
    plot.width <= 0
  ) {
    throw new Error("Plot dimensions must be positive numbers.");
  }
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);
  const inner = innerRect(plot);
  const entrance = computeEntrance(lengthFt, widthFt, plot);

  return LAYOUT_MODES.map((mode) =>
    buildLayoutForMode(plot, lengthFt, widthFt, inner, entrance, mode, strictness),
  );
}
