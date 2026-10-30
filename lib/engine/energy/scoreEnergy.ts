import {
  ENERGY_SCORE_WEIGHTS,
  RAINWATER_CONFIG,
  SOLAR_CONFIG,
} from "@/lib/data/energy.config";
import type {
  EnergyAnalysis,
  EnergyResult,
  EnergyScoreBreakdown,
} from "./types";

const SQFT_TO_M2 = 0.09290304;

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weightedTotal(analysis: EnergyAnalysis): number {
  return Math.round(
    analysis.daylightScore * ENERGY_SCORE_WEIGHTS.daylight +
      analysis.ventilationScore * ENERGY_SCORE_WEIGHTS.ventilation +
      analysis.heatScore * ENERGY_SCORE_WEIGHTS.heat +
      analysis.shadingScore * ENERGY_SCORE_WEIGHTS.shading,
  );
}

function breakdownFor(analysis: EnergyAnalysis): EnergyScoreBreakdown[] {
  const singleSided = analysis.rooms.filter(
    (r) => r.windowCount > 0 && r.ventilation.singleSided,
  ).length;
  return [
    {
      key: "daylight",
      label: "Daylight",
      value: analysis.daylightScore,
      weight: ENERGY_SCORE_WEIGHTS.daylight,
      points: round(analysis.daylightScore * ENERGY_SCORE_WEIGHTS.daylight),
      reason: `${analysis.daylightScore}/100 from window-to-floor ratio vs the climate/orientation target, orientation and room depth.`,
    },
    {
      key: "ventilation",
      label: "Ventilation",
      value: analysis.ventilationScore,
      weight: ENERGY_SCORE_WEIGHTS.ventilation,
      points: round(
        analysis.ventilationScore * ENERGY_SCORE_WEIGHTS.ventilation,
      ),
      reason: `${analysis.ventilationScore}/100 from opposite/adjacent openings and alignment with the ${analysis.city.prevailingWind} prevailing wind (${singleSided} single-sided room${singleSided === 1 ? "" : "s"}).`,
    },
    {
      key: "heat",
      label: "Heat / cooling demand",
      value: analysis.heatScore,
      weight: ENERGY_SCORE_WEIGHTS.heat,
      points: round(analysis.heatScore * ENERGY_SCORE_WEIGHTS.heat),
      reason: `${analysis.heatScore}/100; estimated cooling demand ${Math.round(analysis.cooling.annualCoolingKWh)} kWh/year (${analysis.cooling.kWhPerSqft} kWh/ft²/year). Lower demand scores higher.`,
    },
    {
      key: "shading",
      label: "Shading potential",
      value: analysis.shadingScore,
      weight: ENERGY_SCORE_WEIGHTS.shading,
      points: round(analysis.shadingScore * ENERGY_SCORE_WEIGHTS.shading),
      reason: `${analysis.shadingScore}/100 from the share of direct summer exposure blocked by the computed minimum overhangs.`,
    },
  ];
}

function solarPotential(analysis: EnergyAnalysis) {
  const roofAreaSqft = analysis.floorAreaSqft;
  const usableRoofAreaM2 =
    roofAreaSqft * SQFT_TO_M2 * SOLAR_CONFIG.usableRoofFraction;
  const irradianceKWhM2Year = Math.max(
    1200,
    SOLAR_CONFIG.irradianceBaseKWhM2Year -
      SOLAR_CONFIG.irradianceFalloffKWhPerDegree *
        Math.abs(
          analysis.sunPath.latitude - SOLAR_CONFIG.irradianceOptimalLatitudeDeg,
        ),
  );
  const annualKWh =
    usableRoofAreaM2 *
    irradianceKWhM2Year *
    SOLAR_CONFIG.pvEfficiency *
    SOLAR_CONFIG.performanceRatio;
  return {
    roofAreaSqft: round(roofAreaSqft, 1),
    usableRoofAreaM2: round(usableRoofAreaM2, 1),
    irradianceKWhM2Year: round(irradianceKWhM2Year, 0),
    pvEfficiency: SOLAR_CONFIG.pvEfficiency,
    performanceRatio: SOLAR_CONFIG.performanceRatio,
    annualKWh: round(annualKWh, 0),
    co2AvoidedKg: round(annualKWh * SOLAR_CONFIG.co2FactorKgPerKWh, 0),
    assumptions: [
      `Usable roof = ${Math.round(SOLAR_CONFIG.usableRoofFraction * 100)}% of the modelled roof area (${Math.round(roofAreaSqft)} ft²).`,
      `Irradiance placeholder = 1800 − 8 × |latitude − 20°| = ${Math.round(irradianceKWhM2Year)} kWh/m²/year.`,
      `PV efficiency ${Math.round(SOLAR_CONFIG.pvEfficiency * 100)}%, performance ratio ${Math.round(SOLAR_CONFIG.performanceRatio * 100)}%.`,
      "No tilt, orientation, shading, temperature or battery model — a screening estimate only.",
    ],
  };
}

function rainwaterEstimate(analysis: EnergyAnalysis) {
  const catchmentAreaM2 = analysis.floorAreaSqft * SQFT_TO_M2;
  const rainfallMm = analysis.city.annualRainfallMm;
  const runoffCoefficient = RAINWATER_CONFIG.runoffCoefficient;
  const annualLitres =
    catchmentAreaM2 * rainfallMm * runoffCoefficient;
  return {
    catchmentAreaM2: round(catchmentAreaM2, 1),
    rainfallMm,
    runoffCoefficient,
    annualLitres: round(annualLitres, 0),
    annualM3: round(annualLitres / 1000, 1),
    assumptions: [
      `Catchment = modelled roof area ${Math.round(analysis.floorAreaSqft)} ft².`,
      `City rainfall = ${rainfallMm} mm/year (cities.ts, unverified).`,
      `Runoff coefficient ${runoffCoefficient} — first-flush, evaporation and storage losses are not modelled.`,
    ],
  };
}

/**
 * Add a weighted energy score and screening estimates to an energy analysis.
 *
 * Use this to compare a candidate analysis with a baseline. Geometry used by
 * the engine is in feet; its plan convention is north up, with y increasing
 * southward. Cooling, solar, and rainwater values rely on simplified or
 * placeholder assumptions and are estimates, not simulation or certified
 * performance results. Pass a separately computed baseline when comparison
 * against another design is needed.
 */
export function scoreEnergy(
  analysis: EnergyAnalysis,
  baseline: EnergyAnalysis = analysis,
): EnergyResult {
  const breakdown = breakdownFor(analysis);
  const score100 = weightedTotal(analysis);
  const baselineScore100 = weightedTotal(baseline);
  const reduction =
    baseline.cooling.annualCoolingKWh > 0
      ? ((baseline.cooling.annualCoolingKWh -
          analysis.cooling.annualCoolingKWh) /
          baseline.cooling.annualCoolingKWh) *
        100
      : 0;

  return {
    ...analysis,
    score100,
    breakdown,
    coolingReductionPctVsBaseline: round(reduction),
    baseline: {
      coolingKWh: baseline.cooling.annualCoolingKWh,
      daylightScore: baseline.daylightScore,
      ventilationScore: baseline.ventilationScore,
      score100: baselineScore100,
    },
    solar: solarPotential(analysis),
    rainwater: rainwaterEstimate(analysis),
  };
}
