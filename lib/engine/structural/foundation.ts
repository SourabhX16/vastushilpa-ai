import type { FootingEstimate, StructuralColumn } from "./types";

/**
 * Foundation estimates. Bearing-capacity sizing only (service loads / SBC) —
 * NOT a design: punching/one-way shear and footing reinforcement belong to a
 * full design (cl. 34, 31). SBC 150 kN/m² is an ASSUMED value that MUST be
 * replaced with a geotechnical report (structural.config.ts).
 */

export const ASSUMED_SBC_KPA = 150;

export function estimateFooting(column: StructuralColumn): FootingEstimate {
  const service = column.service;
  const area = service / ASSUMED_SBC_KPA;
  // square pad side, rounded up to 0.1 m
  const sideM = Math.ceil(Math.sqrt(Math.max(area, 0.1)) * 10) / 10;
  return {
    id: `F-${column.id}`,
    columnId: column.id,
    sizeM: sideM,
    areaM2: sideM * sideM,
    bearing: service / (sideM * sideM),
    sbcKPa: ASSUMED_SBC_KPA,
  };
}

export function foundationFootnote(): string {
  return (
    "Isolated pad footings estimated from service loads (Pu/1.5) with an " +
    "ASSUMED SBC of 150 kN/m² — replace with the site geotechnical report. " +
    "Footing thickness, punching and one-way shear are NOT checked here " +
    "(IS 456 cl. 31/34 scope for the structural engineer); nominal cover 50 mm " +
    "per cl. 26.4.2.2."
  );
}
