import { CITIES } from "@/lib/data/cities";
import type {
  LengthUnit,
  PlotFacing,
  PlotInput,
} from "@/lib/engine/types";

/**
 * Natural-language plot description parser — regex/keyword matching ONLY
 * (no LLM). It never guesses: anything it cannot recognise is reported in
 * `missing`, and the corresponding form field is left unchanged.
 */
export interface ParseOutcome {
  /** Form patch extracted from the text. */
  patch: Partial<PlotInput>;
  /** What was understood, as human-readable items. */
  understood: string[];
  /** What was NOT found or ambiguous — shown instead of guessing. */
  missing: string[];
  /** Caveats applied while parsing (clamping, unsupported types…). */
  notes: string[];
}

export const FACING_LABELS: Record<PlotFacing, string> = {
  N: "North",
  NE: "North-East",
  E: "East",
  SE: "South-East",
  S: "South",
  SW: "South-West",
  W: "West",
  NW: "North-West",
};

const FACING_PATTERNS: [RegExp, PlotFacing][] = [
  [/\bnorth[\s-]*(?:east|e)\b|\bn[-\s]?east\b/i, "NE"],
  [/\bnorth[\s-]*(?:west|w)\b|\bn[-\s]?west\b/i, "NW"],
  [/\bsouth[\s-]*(?:east|e)\b|\bs[-\s]?east\b/i, "SE"],
  [/\bsouth[\s-]*(?:west|w)\b|\bs[-\s]?west\b/i, "SW"],
  [/\bne\b/i, "NE"],
  [/\bnw\b/i, "NW"],
  [/\bse\b/i, "SE"],
  [/\bsw\b/i, "SW"],
  [/\bnorth\b/i, "N"],
  [/\beast\b/i, "E"],
  [/\bsouth\b/i, "S"],
  [/\bwest\b/i, "W"],
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compound forms first (north-east before north). */
export function detectFacing(text: string): PlotFacing | null {
  for (const [pattern, facing] of FACING_PATTERNS) {
    if (pattern.test(text)) return facing;
  }
  return null;
}

function detectUnit(text: string): LengthUnit {
  if (/\bfeet\b|\bfoot\b|\bfts?\b/i.test(text)) return "ft";
  if (/\bmeters?\b|\bmetres?\b|\bm\b(?![a-z])/i.test(text)) return "m";
  return "ft";
}

function parseCount(match: RegExpMatchArray | null): number | null {
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function parsePlotDescription(text: string): ParseOutcome {
  const patch: Partial<PlotInput> = {};
  const understood: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  /* ---------------- dimensions + unit ---------------- */
  const dimsMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|×|\*|by)\s*(\d+(?:\.\d+)?)/i,
  );
  let unit: LengthUnit | undefined;
  if (dimsMatch && typeof dimsMatch.index === "number") {
    unit = detectUnit(
      text.slice(dimsMatch.index + dimsMatch[0].length, dimsMatch.index + dimsMatch[0].length + 8) ||
        text,
    );
    const dimA = parseFloat(dimsMatch[1]);
    const dimB = parseFloat(dimsMatch[2]);
    if (!Number.isFinite(dimA) || !Number.isFinite(dimB) || dimA <= 0 || dimB <= 0) {
      missing.push("Plot dimensions found but not usable (expected like “30x40”).");
    } else {
      // PlotInput convention: length = east-west extent. Free text is
      // direction-ambiguous, so when "A x B" is written without a compass
      // the longer figure is kept on the east-west axis (preview convention).
      patch.length = Math.max(dimA, dimB);
      patch.width = Math.min(dimA, dimB);
      patch.unit = unit ?? "ft";
      understood.push(`Dimensions: ${dimA} × ${dimB} ${patch.unit}`);
    }
  } else {
    missing.push("Plot dimensions not found (expected like “30x40”).");
  }

  /* ---------------- facing ---------------- */
  const facing = detectFacing(text);
  if (facing) {
    patch.facing = facing;
    understood.push(`Facing: ${FACING_LABELS[facing]}`);
  } else {
    missing.push("Facing not detected — current selection kept.");
  }

  /* ---------------- bedrooms ---------------- */
  const bhkMatch = text.match(/\b([1-9])\s*[-\s]?\s*bhk\b/i);
  const bedroomMatch = text.match(/\b([1-9])\s*bedrooms?\b/i);
  const count = parseCount(bhkMatch) ?? parseCount(bedroomMatch);
  if (count !== null) {
    if (count > 5) {
      notes.push("More than 5 bedrooms is outside the prototype range; clamped to 5.");
    }
    patch.bedrooms = Math.min(count, 5);
    understood.push(`Bedrooms: ${Math.min(count, 5)}${bhkMatch ? " (BHK)" : ""}`);
  } else {
    missing.push("Bedrooms not mentioned — current value kept.");
  }

  /* ---------------- building type ---------------- */
  if (/\bschool\b|\bvidyalaya\b|\bacademy\b/i.test(text)) {
    notes.push("School plots are coming soon — kept as Residential.");
  } else if (/\boffice(?:s)?\b|\bworkspace\b/i.test(text)) {
    notes.push("Office plots are coming soon — kept as Residential.");
  } else if (/\b(?:home|house|villa|apartment|flat|duplex|residential)\b/i.test(text)) {
    patch.buildingType = "residential";
    understood.push("Building type: Residential");
  }

  /* ---------------- features ---------------- */
  if (/\bpooja?[\s-]*room\b|\bpuja\b/i.test(text)) {
    patch.poojaRoom = true;
    understood.push("Pooja room: yes");
  }
  if (/\bparking\b|\bgarage\b|\bcarport\b/i.test(text)) {
    patch.parking = true;
    understood.push("Parking: yes");
  }
  if (/\belderly\b|\bsenior\b|\baccessible\b/i.test(text)) {
    patch.elderlyGroundFloor = true;
    understood.push("Elderly-friendly ground floor: yes");
  }

  /* ---------------- city ---------------- */
  const city = CITIES.find((c) =>
    new RegExp(`\\b${escapeRegex(c.name)}\\b`, "i").test(text),
  );
  if (city) {
    patch.city = city.id;
    understood.push(`City: ${city.name}`);
  } else {
    missing.push(
      "City not recognised — select manually. Supported: " +
        CITIES.map((c) => c.name).join(", ") +
        ".",
    );
  }

  return { patch, understood, missing, notes };
}
