import type {
  PlotFacing,
  VastuRoomType,
  VastuZoneId,
  WallSide,
} from "../engine/types";

/**
 * VASTU ZONING CONFIG — DATA, NOT PROCEDURE.
 *
 * STATUS: EVERY ENTRY IS verified: false.
 * The room-zone tables below are the commonly cited modern vastu rules,
 * transcribed from memory of secondary sources (vastu consultant sites,
 * blog summaries and apartment guides that *cite* Manasara / Mayamata /
 * Manushyalaya Chandrika / Vishwakarma Pratishtha). They have NOT been
 * checked against primary texts, and different sources disagree freely.
 * The engine marks every scored point as unverified; do not present the
 * rules as authentic traditional data.
 *
 * WHERE TO VERIFY (primary/authoritative):
 * - Manasara & Mayamata — zone deities (Vastu Purusha mandala), house-parts
 *   chapters (which part of the house belongs to which padadevata).
 * - Manushyalaya Chandrika — Kerala tradition; kitchen/pooja/entrance rules
 *   in a different form than the modern "SE kitchen / NE pooja" shorthand.
 * - Vishwakarma Pratishtha / Brihat Samhita chapters on dwellings.
 *
 * KNOWN VARIATION POINTS:
 * - "Bathroom vs toilet" are often merged in sources; the ideal zones differ.
 * - Kitchen: SE is the popular rule, but NW ("Vayavya" cooking / wind path)
 *   and NE appear in some commentaries.
 * - Staircase: S/W/SW clockwise ascent is cited commonly; some texts give
 *   a pada-based rule instead of a zone rule.
 * - Entrance padas: the "good pada counts" for the main door come in several
 *   incompatible lists (3,4 / 5,6... counting from different corners).
 * - Parking/garage: almost entirely a modern invention; zone claims vary.
 */

const TODO_SOURCE = "TODO: cite Manasara / Mayamata / relevant text";

export const ZONE_DEITIES: Record<
  VastuZoneId,
  { name: string; deity: string; source: string; verified: boolean }
> = {
  NW: { name: "Vayavya", deity: "Vayu (wind)", source: TODO_SOURCE, verified: false },
  N: { name: "Uttara", deity: "Kubera (wealth)", source: TODO_SOURCE, verified: false },
  NE: { name: "Ishanya", deity: "Ishvara (Shiva)", source: TODO_SOURCE, verified: false },
  W: { name: "Pashchima", deity: "Varuna (water)", source: TODO_SOURCE, verified: false },
  C: { name: "Brahmasthan", deity: "Brahma — must stay open", source: TODO_SOURCE, verified: false },
  E: { name: "Purva", deity: "Indra / Surya (rising sun)", source: TODO_SOURCE, verified: false },
  SW: { name: "Nairritya", deity: "Nirriti (ancestors)", source: TODO_SOURCE, verified: false },
  S: { name: "Dakshina", deity: "Yama", source: TODO_SOURCE, verified: false },
  SE: { name: "Agneya", deity: "Agni (fire)", source: TODO_SOURCE, verified: false },
};
// Common attributions; deity spellings/assignments vary between sources —
// every entry is verified:false above.

export interface VastuRoomRule {
  type: VastuRoomType;
  /** Zones ranked best-first. */
  preferred: VastuZoneId[];
  /** Zones accepted with a lesser score. */
  acceptable: VastuZoneId[];
  /** Zones the engine avoids until everything else fails (poor score). */
  avoid: VastuZoneId[];
  /** Smallest area the room is allowed to occupy (ft²). */
  minAreaSqft: number;
  /** Target area the room grows toward (ft²). */
  preferredAreaSqft: number;
  /** Smallest allowed side of the room rectangle (ft). */
  minSideFt: number;
  /** Preferred width/height aspect of the room rectangle. */
  aspect: number;
  /**
   * Which wall(s) the door should ideally sit on for this room, if the room
   * touches them (falls back to a neighbour/circulation wall otherwise).
   */
  doorWalls?: WallSide[];
  /** Scoring weight (relative importance within the room-points pool). */
  pointsWeight: number;
  /** true = this room wants windows on outer walls (daylight priority). */
  daylight: boolean;
  /** One-line traditional rationale shown in the "Why?" popover. */
  why: string;
  /** Suggested fix shown for acceptable/poor rows. */
  remedy: string;
  source: string;
  verified: boolean;
}

export const VASTU_ROOM_CONFIG: Record<VastuRoomType, VastuRoomRule> = {
  pooja: {
    type: "pooja",
    preferred: ["NE"],
    acceptable: ["N", "E"],
    avoid: ["S", "SW", "SE"],
    minAreaSqft: 20,
    preferredAreaSqft: 36,
    minSideFt: 3,
    aspect: 1,
    // Commonly cited: pooja-room door on the east (falls back north).
    doorWalls: ["E", "N"],
    pointsWeight: 2.4,
    daylight: false,
    why: "Ishanya (NE) is Ishvara's corner — the widely cited seat for a pooja / prayer space.",
    remedy:
      "If NE is unavailable, keep the pooja corner in the N or E, never in S/SW/SE; keep an image of Vastu Purusha in the N if that is your tradition.",
    source: "TODO: verify against Manasara / Mayamata parts chapters",
    verified: false,
  },
  masterBedroom: {
    type: "masterBedroom",
    preferred: ["SW"],
    acceptable: ["S", "W", "NW"],
    avoid: ["NE"],
    minAreaSqft: 100,
    preferredAreaSqft: 130,
    minSideFt: 7,
    aspect: 1.2,
    pointsWeight: 2.6,
    daylight: true,
    why: "Nairritya (SW) is the ancestor / stability corner — the commonly cited master-bedroom seat.",
    remedy:
      "If SW is taken, use S or W; sleep with the head toward S (some sources) and avoid placing the master bedroom in NE.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  bedroom: {
    type: "bedroom",
    preferred: ["NW", "W"],
    acceptable: ["E", "N", "S"],
    avoid: ["SE", "SW"],
    minAreaSqft: 85,
    preferredAreaSqft: 110,
    minSideFt: 6.5,
    aspect: 1.2,
    pointsWeight: 2.2,
    daylight: true,
    why: "Vayavya (NW) / west are the commonly cited guest & spare-bedroom zones; the main earning couple sleeps SW.",
    remedy:
      "If NW/W are taken, N/E/S are workable; keep bedrooms out of SE (some texts link Agni's corner to quarrels).",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  childrenBedroom: {
    type: "childrenBedroom",
    preferred: ["W", "NW"],
    acceptable: ["E", "N"],
    avoid: ["SE", "SW"],
    minAreaSqft: 85,
    preferredAreaSqft: 105,
    minSideFt: 6.5,
    aspect: 1.2,
    pointsWeight: 1.8,
    daylight: true,
    why: "West / NW corners are the commonly cited children's-room zones (study, growth).",
    remedy: "E of the children's room is commonly accepted; avoid SW.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  living: {
    type: "living",
    preferred: ["N", "NE", "E"],
    acceptable: ["NW"],
    avoid: ["SW"],
    minAreaSqft: 110,
    preferredAreaSqft: 150,
    minSideFt: 8,
    aspect: 1.2,
    pointsWeight: 2.8,
    daylight: true,
    why: "North / NE / east get morning light and are the commonly cited reception zones.",
    remedy:
      "NW works for a guest-facing drawing room; keep the heavy sofa mass toward W/S (some sources) if using SW.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  kitchen: {
    type: "kitchen",
    preferred: ["SE"],
    acceptable: ["NW"],
    avoid: ["NE"],
    minAreaSqft: 70,
    preferredAreaSqft: 95,
    minSideFt: 6,
    aspect: 1.15,
    // Cooking face east (common); door to the room is less codified.
    pointsWeight: 2.4,
    daylight: false,
    why: "Agneya (SE) is Agni's corner — the widely cited kitchen zone; NW appears as a secondary seat (wind path).",
    remedy:
      "If SE is unavailable, NW is the common fallback; keep the cook facing E/S; never put the fire under a pooja wall facing NE (some sources).",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  dining: {
    type: "dining",
    preferred: ["W"],
    acceptable: ["NW", "N"],
    avoid: ["NE"],
    minAreaSqft: 40,
    preferredAreaSqft: 80,
    minSideFt: 5.5,
    aspect: 1.15,
    pointsWeight: 1.4,
    daylight: true,
    why: "West is the commonly cited dining zone (digestion / away from the fire corner).",
    remedy: "NW or N are accepted fallbacks; avoid dining in NE.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  toilet: {
    type: "toilet",
    preferred: ["NW"],
    acceptable: ["W"],
    avoid: ["NE", "SE"],
    minAreaSqft: 25,
    preferredAreaSqft: 32,
    minSideFt: 3.5,
    aspect: 0.65,
    pointsWeight: 1.2,
    daylight: false,
    why: "Vayavya (NW) / west are the cited toilet zones (wind carries odours away).",
    remedy:
      "Keep toilets out of NE (Ishan corner) and SE (Agni); a W/NW pocket by a bedroom is the common fallback.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  bathroom: {
    type: "bathroom",
    preferred: ["E"],
    acceptable: ["SE", "W", "NE"],
    avoid: ["SW"],
    minAreaSqft: 30,
    preferredAreaSqft: 40,
    minSideFt: 3.5,
    aspect: 0.9,
    pointsWeight: 1.2,
    daylight: false,
    why: "East bath is the commonly cited morning-sunzone for bathing (Surya on the body).",
    remedy:
      "SE / W pockets are accepted fallbacks; keep bathing areas out of SW per common sources.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  staircase: {
    type: "staircase",
    preferred: ["SW", "S", "W"],
    acceptable: ["SE", "NW"],
    avoid: ["NE"],
    minAreaSqft: 38,
    preferredAreaSqft: 45,
    minSideFt: 3,
    aspect: 0.8,
    pointsWeight: 1.4,
    daylight: false,
    why: "S/SW/W stairs keep the ascent on the heavy southern and western mass (common citation); NE stairs are widely discouraged.",
    remedy:
      "Keep the ascent clockwise (common rule) and never inside the Brahmasthan or NE.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  store: {
    type: "store",
    preferred: ["SW", "W"],
    acceptable: ["S"],
    avoid: ["NE"],
    minAreaSqft: 25,
    preferredAreaSqft: 35,
    minSideFt: 3.5,
    aspect: 1.1,
    pointsWeight: 0.8,
    daylight: false,
    why: "SW storage fits the heavy-mass corner in most modern summaries.",
    remedy: "W / S are accepted fallbacks; avoid a store in NE.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  parking: {
    type: "parking",
    preferred: ["NW"],
    acceptable: ["W", "SW", "SE", "S", "N"],
    avoid: ["NE", "E"],
    minAreaSqft: 110,
    preferredAreaSqft: 130,
    minSideFt: 7,
    aspect: 1.35,
    // No vastu door; the bay opens toward the road. Renderer leaves it open.
    pointsWeight: 1,
    daylight: false,
    why: "NW parking is the commonly cited seat (heavy vehicle offset from the sacred corners, near the wind path).",
    remedy:
      "Vehicles need a road-facing bay: when vastu zone and access conflict, access wins and the bay is scored poor. Avoid NE/centre per most sources.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
  verandah: {
    type: "verandah",
    preferred: ["N", "NE", "E"],
    acceptable: ["NW", "SE"],
    avoid: ["SW"],
    minAreaSqft: 40,
    preferredAreaSqft: 55,
    minSideFt: 4,
    aspect: 1.7,
    pointsWeight: 1.2,
    daylight: true,
    why: "North / NE verandahs face the rising sun and the Kubera side in the commonly cited rules.",
    remedy: "SE/NW are accepted fallbacks; avoid SW verandahs per common sources.",
    source: "TODO: verify against primary texts",
    verified: false,
  },
};

export interface EntranceRule {
  /** Which perimeter wall hosts the main door for this facing. */
  wall: WallSide;
  /**
   * Preferred segment of that wall, as fractions of the wall length,
   * measured from the wall's low-coordinate edge (W end for N/S walls,
   * N end for E/W walls — same axis convention as Rect).
   */
  from: number;
  to: number;
  /** Human-readable rule text (shown in the UI / scoring). */
  label: string;
  /** Hard rule for this prototype: parking must touch a road-facing side. */
  source: string;
  verified: boolean;
}

/**
 * MAIN-DOOR POSITION RULES, per road-facing direction, as fractions of the
 * hosting wall. Earlier fractions sit toward the north/west end, later
 * fractions toward the south/east end (see the Rect documentation for the
 * axes). Example: East-facing → east wall, 0–0.34 = the NE-most third of
 * the east wall. All entries verified:false pending pada-wise verification.
 */
export const ENTRANCE_RULES: Record<PlotFacing, EntranceRule> = {
  N: {
    wall: "N",
    from: 0.62,
    to: 0.94,
    label: "North wall, north-east (NE-pad) portion",
    source: TODO_SOURCE,
    verified: false,
  },
  NE: {
    wall: "N",
    from: 0.66,
    to: 0.96,
    label: "North wall, east (NE-corner) end",
    source: TODO_SOURCE,
    verified: false,
  },
  E: {
    wall: "E",
    from: 0,
    to: 0.34,
    label: "East wall, NE-most third",
    source: TODO_SOURCE,
    verified: false,
  },
  SE: {
    wall: "S",
    from: 0.66,
    to: 0.96,
    label: "South wall, east (SE-corner) end",
    source: TODO_SOURCE,
    verified: false,
  },
  S: {
    wall: "S",
    from: 0.34,
    to: 0.88,
    label: "South wall, centre-east portion (avoiding the exact corners)",
    source: TODO_SOURCE,
    verified: false,
  },
  SW: {
    wall: "S",
    from: 0.2,
    to: 0.62,
    label: "South wall, SW-to-centre portion",
    source: TODO_SOURCE,
    verified: false,
  },
  W: {
    wall: "W",
    from: 0,
    to: 0.34,
    label: "West wall, north (NW-side) portion",
    source: TODO_SOURCE,
    verified: false,
  },
  NW: {
    wall: "N",
    from: 0.04,
    to: 0.34,
    label: "North wall, west (NW-corner) end",
    source: TODO_SOURCE,
    verified: false,
  },
};

/** Perimeter walls touched by the road for each facing (diagonals get two). */
export const ROAD_WALLS: Record<PlotFacing, WallSide[]> = {
  N: ["N"],
  NE: ["N", "E"],
  E: ["E"],
  SE: ["E", "S"],
  S: ["S"],
  SW: ["S", "W"],
  W: ["W"],
  NW: ["W", "N"],
};
