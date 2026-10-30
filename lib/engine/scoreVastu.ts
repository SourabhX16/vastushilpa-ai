import {
  ENTRANCE_RULES,
  VASTU_ROOM_CONFIG,
  ZONE_DEITIES,
} from "../data/vastu.config";
import type {
  Rect,
  Layout,
  PlotInput,
  VastuCheck,
  VastuResult,
  VastuStatus,
  VastuZoneId,
  VastuRoomType,
} from "./types";
import {
  computeVastuGrid,
  overlapArea,
  rectArea,
  rectCenter,
  toFeet,
} from "./vastuGrid";

/*
 * Vastu scorer — /100 with a per-room breakdown.
 *
 * Points: 70 across the placed rooms (weighted by the config's
 * pointsWeight), 10 for the main-entrance rule, 10 for keeping the
 * Brahmasthan open, 10 for the left-right / north-south mass symmetry.
 * Statuses: ideal = preferred zone, acceptable = acceptable zone,
 * poor = everything else; acceptable rooms score 60% of their max,
 * poor rooms 0 (a remedy is attached to both).
 *
 * unverifiedShare = fraction of max points whose rule carries
 * verified:false in the config (currently all of them — see
 * lib/data/vastu.config.ts for where to verify).
 */

const ENTRANCE_MAX = 10;
const BRAHMASTHAN_MAX = 10;
const SYMMETRY_MAX = 10;
const ROOMS_MAX = 70;

/** Fraction of max points an acceptable placement still earns. */
const ACCEPTABLE_FRACTION = 0.6;

/** Deterministic status for a room in a zone. */
function statusForRoomZone(type: VastuRoomType, zone: VastuZoneId): VastuStatus {
  const cfg = VASTU_ROOM_CONFIG[type];
  if (cfg.preferred.includes(zone)) return "ideal";
  if (cfg.acceptable.includes(zone)) return "acceptable";
  return "poor";
}

function roomCheck(
  label: string,
  type: VastuRoomType,
  zone: VastuZoneId,
  maxPoints: number,
): VastuCheck {
  const cfg = VASTU_ROOM_CONFIG[type];
  const status = statusForRoomZone(type, zone);
  const points =
    status === "ideal"
      ? maxPoints
      : status === "acceptable"
        ? Math.round(maxPoints * ACCEPTABLE_FRACTION * 100) / 100
        : 0;
  const roomDeity = ZONE_DEITIES[zone];
  const short = status === "ideal" ? "preferred" : status === "acceptable" ? "acceptable" : "not recommended";
  return {
    label,
    roomType: type,
    zone,
    status,
    points,
    maxPoints,
    reason: `${label} sits in ${zone} — ${roomDeity.name} (${short} zone for this room type).`,
    remedy: status === "ideal" ? undefined : cfg.remedy,
    why: `${cfg.why} ${ZONE_DEITIES[zone].deity}.`,
    source: cfg.source,
    verified: cfg.verified,
  };
}

/** Entrance check: door centre inside the configured ideal segment of the wall. */
function entranceCheck(layout: Layout, plot: PlotInput): VastuCheck {
  const rule = ENTRANCE_RULES[plot.facing];
  const wallLen =
    rule.wall === "N" || rule.wall === "S"
      ? toFeet(plot.length, plot.unit)
      : toFeet(plot.width, plot.unit);
  const doorCentre = layout.entrance.at + layout.entrance.width / 2;
  const within =
    doorCentre >= rule.from * wallLen - 1e-9 && doorCentre <= rule.to * wallLen + 1e-9;
  const zone = layout.entrance.zone;
  const status: VastuStatus = within ? "ideal" : "acceptable";
  const points = within ? ENTRANCE_MAX : Math.round(ENTRANCE_MAX * ACCEPTABLE_FRACTION * 100) / 100;
  const cfg = VASTU_ROOM_CONFIG.verandah;
  return {
    label: "Main entrance",
    zone,
    status,
    points,
    maxPoints: ENTRANCE_MAX,
    reason: within
      ? `Main door on the ${rule.wall} wall — ${rule.label}.`
      : `Main door on the ${rule.wall} wall but outside its recommended segment (${rule.label}).`,
    remedy: within
      ? undefined
      : `Shift the door into the recommended segment: ${rule.label}.`,
    why: `The door rule for ${plot.facing}-facing plots: ${rule.label}. ${cfg.source}`,
    source: rule.source,
    verified: rule.verified,
  };
}

/**
 * Brahmasthan check: no room may overlap the centre cell (which should
 * stay open of walls, rooms and columns).
 */
function brahmasthanCheck(layout: Layout, plot: PlotInput): VastuCheck {
  const grid = computeVastuGrid(plot);
  const centre: Rect | undefined = grid.cells.find((c) => c.zone === "C")?.rect;
  if (!centre) {
    throw new Error("Vastu grid did not produce a Brahmasthan cell.");
  }
  const breached = layout.rooms.filter((room) => overlapArea(room.rect, centre) > 1e-6);
  const status: VastuStatus = breached.length === 0 ? "ideal" : "poor";
  const points = breached.length === 0 ? BRAHMASTHAN_MAX : 0;
  return {
    label: "Brahmasthan open",
    zone: "C",
    status,
    points,
    maxPoints: BRAHMASTHAN_MAX,
    reason:
      breached.length === 0
        ? "The centre of the plot is free of every room footprint."
        : `${breached.map((r) => r.label).join(", ")} intrude(s) into the Brahmasthan.`,
    remedy:
      breached.length === 0
        ? undefined
        : "Empty the centre cell: no walls, rooms or columns through the Brahmasthan (keep it as an open hall / courtyard).",
    why: "The central padas of the Vastu Purusha mandala belong to Brahma; most traditions keep the Brahmasthan open.",
    source: "TODO: verify against Manasara / Mayamata mandala chapters",
    verified: false,
  };
}

/**
 * Symmetry sub-score (0..10): even mass of built rooms between west-east
 * and north-south halves, measured on room centres (a proxy for the
 * traditional emphasis on balanced massing).
 */
function symmetryCheck(layout: Layout, plot: PlotInput): VastuCheck {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);
  let west = 0;
  let east = 0;
  let north = 0;
  let south = 0;
  for (const room of layout.rooms) {
    const area = rectArea(room.rect);
    const c = rectCenter(room.rect);
    if (c.x < lengthFt / 2) west += area;
    else east += area;
    if (c.y < widthFt / 2) north += area;
    else south += area;
  }
  const totalX = west + east;
  const totalY = north + south;
  const ew = totalX > 0 ? 1 - Math.abs(west - east) / totalX : 0;
  const ns = totalY > 0 ? 1 - Math.abs(north - south) / totalY : 0;
  const score = Math.round(((0.5 * ew + 0.5 * ns) * SYMMETRY_MAX * 100) / 100);
  const status: VastuStatus = score >= 7.5 ? "ideal" : score >= 5 ? "acceptable" : "poor";
  return {
    label: "Mass symmetry",
    zone: "C",
    status,
    points: score,
    maxPoints: SYMMETRY_MAX,
    reason: `Built mass split W/E ${(ew * 100).toFixed(0)}%·N/S ${(ns * 100).toFixed(0)}% balanced.`,
    remedy:
      status === "ideal"
        ? undefined
        : "Rebalance heavy rooms across the east-west and north-south halves of the plan.",
    why: "Traditional layouts seek balanced massing around the Brahmasthan; the exact weighting here is an engine heuristic.",
    source: "TODO: verify how much symmetry matters in the primary texts",
    verified: false,
  };
}

/** Scores a generated layout for a plot. Deterministic. */
export function scoreVastu(layout: Layout, plot: PlotInput): VastuResult {
  const roomChecks: VastuCheck[] = [];
  const totalWeight = layout.rooms.reduce(
    (sum, room) => sum + VASTU_ROOM_CONFIG[room.type].pointsWeight,
    0,
  );

  for (const room of layout.rooms) {
    const cfg = VASTU_ROOM_CONFIG[room.type];
    const maxPoints =
      totalWeight > 0
        ? Math.round((cfg.pointsWeight / totalWeight) * ROOMS_MAX * 100) / 100
        : 0;
    roomChecks.push(roomCheck(room.label, room.type, room.zone, maxPoints));
  }

  const entrance = entranceCheck(layout, plot);
  const brahmasthan = brahmasthanCheck(layout, plot);
  const symmetry = symmetryCheck(layout, plot);

  const all = [...roomChecks, entrance, brahmasthan, symmetry];
  const raw = all.reduce((sum, c) => sum + c.points, 0);
  const score100 = Math.round(Math.min(100, Math.max(0, raw)));

  const breakdown = [...roomChecks];
  const counts = breakdown.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { ideal: 0, acceptable: 0, poor: 0 },
  );

  const maxTotal = all.reduce((sum, c) => sum + c.maxPoints, 0) || 1;
  const unverifiedTotal = all.reduce(
    (sum, c) => sum + (c.verified ? 0 : c.maxPoints),
    0,
  );

  return {
    layoutId: layout.id,
    score100,
    breakdown,
    counts,
    entrance,
    brahmasthan,
    symmetry,
    unverifiedShare: unverifiedTotal / maxTotal,
  };
}
