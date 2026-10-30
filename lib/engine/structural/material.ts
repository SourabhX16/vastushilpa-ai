import { rebarArea } from "./checks";
import { STOREY_HEIGHT_M } from "./loads";
import type { StructuralResult } from "./types";

/**
 * Preliminary material take-off FROM the structural result.
 *
 * This is a screening quantity estimate, not a BOQ: slab steel is a
 * percentage placeholder (the panel result does not store the bar schedule),
 * beam top steel is assumed as 50% of bottom steel, footing thickness is
 * assumed and no wastage/laps beyond the allowances below are included.
 */

const STEEL_DENSITY_KG_M3 = 7850;
const SLAB_STEEL_RATIO = 0.007; // 0.7% by volume — placeholder
const BEAM_TOP_STEEL_RATIO = 0.5; // placeholder: top = 50% of bottom
const FOOTING_THICKNESS_M = 0.45; // placeholder
const FOOTING_STEEL_RATIO = 0.006; // placeholder
const COLUMN_TIE_ALLOWANCE = 0.08; // +8% over longitudinal bars
const BEAM_STIRRUP_COVER_M = 0.025;
const BEAM_ANCHORAGE_M = 0.6;
const COLUMN_LAP_M = 0.6;

export interface MaterialEstimate {
  concreteM3: number;
  steelKg: number;
  slabConcreteM3: number;
  beamConcreteM3: number;
  columnConcreteM3: number;
  footingConcreteM3: number;
  slabSteelKg: number;
  beamSteelKg: number;
  columnSteelKg: number;
  footingSteelKg: number;
  notes: string[];
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function estimateMaterials(result: StructuralResult): MaterialEstimate {
  const levels = Math.max(1, result.plan.levels);

  let slabConcreteM3 = 0;
  for (const panel of result.members.panels) {
    const area = panel.member.lx * panel.member.ly;
    slabConcreteM3 += area * (panel.member.thicknessMm / 1000);
  }
  slabConcreteM3 *= levels;

  let beamConcreteM3 = 0;
  let beamSteelKg = 0;
  for (const beam of result.members.beams) {
    const b = beam.member;
    const widthM = b.widthMm / 1000;
    const depthM = b.depthMm / 1000;
    beamConcreteM3 += widthM * depthM * b.spanM;
    const mainAreaM2 = rebarArea(b.bars.count, b.bars.dia) / 1_000_000;
    const mainSteel =
      mainAreaM2 * (b.spanM + BEAM_ANCHORAGE_M) * STEEL_DENSITY_KG_M3;
    const topSteel = mainSteel * BEAM_TOP_STEEL_RATIO;
    let stirrupSteel = 0;
    if (b.stirrups) {
      const stirrupAreaM2 = rebarArea(b.stirrups.legs, b.stirrups.dia) / 1_000_000;
      const perimeter =
        2 *
        (Math.max(0.1, widthM - 2 * BEAM_STIRRUP_COVER_M) +
          Math.max(0.1, depthM - 2 * BEAM_STIRRUP_COVER_M));
      const count = b.spanM / Math.max(0.05, b.stirrups.spacingMm / 1000);
      stirrupSteel = stirrupAreaM2 * perimeter * count * STEEL_DENSITY_KG_M3;
    }
    beamSteelKg += mainSteel + topSteel + stirrupSteel;
  }
  beamConcreteM3 *= levels;
  beamSteelKg *= levels;

  let columnConcreteM3 = 0;
  let columnSteelKg = 0;
  for (const column of result.members.columns) {
    const c = column.member;
    const ax = c.sizeMm[0] / 1000;
    const by = c.sizeMm[1] / 1000;
    const columnLevels = Math.max(1, c.levels);
    columnConcreteM3 += ax * by * STOREY_HEIGHT_M * columnLevels;
    const barAreaM2 = rebarArea(c.bars.count, c.bars.dia) / 1_000_000;
    const length = columnLevels * STOREY_HEIGHT_M + COLUMN_LAP_M;
    const longitudinal = barAreaM2 * length * STEEL_DENSITY_KG_M3;
    columnSteelKg += longitudinal * (1 + COLUMN_TIE_ALLOWANCE);
  }

  let footingConcreteM3 = 0;
  for (const footing of result.foundation.footings) {
    footingConcreteM3 += footing.areaM2 * FOOTING_THICKNESS_M;
  }
  const footingSteelKg =
    footingConcreteM3 * FOOTING_STEEL_RATIO * STEEL_DENSITY_KG_M3;

  const concreteM3 =
    slabConcreteM3 + beamConcreteM3 + columnConcreteM3 + footingConcreteM3;
  const steelKg = slabSteelKg(slabConcreteM3) + beamSteelKg + columnSteelKg + footingSteelKg;

  return {
    concreteM3: round(concreteM3),
    steelKg: round(steelKg),
    slabConcreteM3: round(slabConcreteM3),
    beamConcreteM3: round(beamConcreteM3),
    columnConcreteM3: round(columnConcreteM3),
    footingConcreteM3: round(footingConcreteM3),
    slabSteelKg: round(slabSteelKg(slabConcreteM3)),
    beamSteelKg: round(beamSteelKg),
    columnSteelKg: round(columnSteelKg),
    footingSteelKg: round(footingSteelKg),
    notes: [
      "Preliminary screening take-off from the structural result — not a BOQ.",
      `Slab steel assumed at ${(SLAB_STEEL_RATIO * 100).toFixed(1)}% of concrete volume (bar schedule not stored per panel).`,
      `Beam top steel assumed at ${Math.round(BEAM_TOP_STEEL_RATIO * 100)}% of bottom steel; stirrups included from the member schedule.`,
      `Footings assumed ${FOOTING_THICKNESS_M} m thick with ${(FOOTING_STEEL_RATIO * 100).toFixed(1)}% steel by volume.`,
      `Levels mirrored from the structural result (${levels}); no wastage, laps beyond the allowances or formwork included.`,
    ],
  };
}

function slabSteelKg(concreteM3: number): number {
  return concreteM3 * SLAB_STEEL_RATIO * STEEL_DENSITY_KG_M3;
}
