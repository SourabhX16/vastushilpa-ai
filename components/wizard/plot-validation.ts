import type { LengthUnit, PlotInput } from "@/lib/engine/types";

/**
 * Sane prototype ranges. Very small plots make Ayadi truncation meaningless;
 * very large ones are out of the prototype's scope (site → single dwelling).
 *
 * AXIS CONVENTION (matches the plot preview and the whole engine):
 * plots are drawn north-up, so `length` runs along the EAST-WEST axis and
 * `width` along the NORTH-SOUTH axis. Length is NOT required to be the
 * longer side — any pair of positive dimensions is a valid plot.
 */
export const PLOT_LIMITS: Record<LengthUnit, { min: number; max: number }> = {
  ft: { min: 5, max: 500 },
  m: { min: 1.5, max: 152.5 },
};

const METRES_PER_FOOT = 0.3048;

/** Convert a length between ft and m, rounded for display. */
export function convertLength(
  value: number,
  from: LengthUnit,
  to: LengthUnit,
): number {
  if (!Number.isFinite(value) || from === to) return value;
  const converted = from === "ft" ? value * METRES_PER_FOOT : value / METRES_PER_FOOT;
  return Math.round(converted * 1000) / 1000;
}

export interface PlotFormErrors {
  length?: string;
  width?: string;
  city?: string;
  bedrooms?: string;
}

function dimError(
  label: string,
  value: number,
  unit: LengthUnit,
): string | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return `Enter ${label}.`;
  }
  const { min, max } = PLOT_LIMITS[unit];
  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max} ${unit}.`;
  }
  return undefined;
}

export function validatePlotInput(
  input: Pick<PlotInput, "length" | "width" | "unit" | "city" | "bedrooms">,
): PlotFormErrors {
  const errors: PlotFormErrors = {};

  errors.length = dimError("Plot length (east-west side)", input.length, input.unit);
  errors.width = dimError("Plot width (north-south side)", input.width, input.unit);

  if (!input.city) {
    errors.city = "Select a city to load climate and seismic context.";
  }

  if (!Number.isInteger(input.bedrooms) || input.bedrooms < 1 || input.bedrooms > 5) {
    errors.bedrooms = "Bedrooms must be 1–5.";
  }

  return errors;
}

export function isPlotFormValid(
  errors: PlotFormErrors,
): boolean {
  return (
    !errors.length && !errors.width && !errors.city && !errors.bedrooms
  );
}

export function formatDimension(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "—";
}
