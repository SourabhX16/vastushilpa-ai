import type { CityData, Layout, PlotInput } from "../types";
import { rectArea, toFeet } from "../vastuGrid";
import type {
  CoolingEstimate,
  PassiveRecommendation,
  RoomEnergy,
  WindowAnalysis,
} from "./types";

export interface RecommendationInput {
  plot: PlotInput;
  layout: Layout;
  city: CityData;
  rooms: RoomEnergy[];
  windows: WindowAnalysis[];
  daylightScore: number;
  ventilationScore: number;
  heatScore: number;
  cooling: CoolingEstimate;
  baseline: boolean;
}

/**
 * Passive-measure rules. Every recommendation is triggered by a computed
 * metric and quotes that metric; none is generic copy. The model does not
 * quantify the improvement of a courtyard/jaali/ventilator, so the effect
 * text stays qualitative and explicitly says so.
 */
export function buildRecommendations(
  input: RecommendationInput,
): PassiveRecommendation[] {
  if (input.baseline) return [];

  const recommendations: PassiveRecommendation[] = [];
  const poorDaylight = input.rooms.filter(
    (r) => r.windowCount > 0 && r.daylightScore < 50,
  );
  const singleSided = input.rooms.filter(
    (r) => r.windowCount > 0 && r.ventilation.singleSided,
  );
  const westSouthExposure = input.windows
    .filter((w) => w.wall === "W" || w.wall === "S")
    .reduce((sum, w) => sum + w.summerExposure, 0);
  const totalExposure = input.windows.reduce(
    (sum, w) => sum + w.summerExposure,
    0,
  );
  const westSouthShare =
    totalExposure > 0 ? westSouthExposure / totalExposure : 0;
  const shadedWindows = input.windows.filter(
    (w) => w.requiredOverhangFt > 0 && w.overhangReductionPct > 8,
  );

  const lengthFt = toFeet(input.plot.length, input.plot.unit);
  const widthFt = toFeet(input.plot.width, input.plot.unit);
  const plotArea = lengthFt * widthFt;
  const minSide = Math.min(lengthFt, widthFt);
  const builtArea = input.layout.rooms.reduce(
    (sum, room) => sum + rectArea(room.rect),
    0,
  );

  const courtyardFeasible =
    minSide >= 24 && plotArea >= 850 && builtArea < plotArea * 0.85;

  if (
    courtyardFeasible &&
    (poorDaylight.length >= 2 || input.daylightScore < 55)
  ) {
    recommendations.push({
      id: "courtyard",
      title: "Consider a small internal courtyard",
      reason: `${poorDaylight.length || "Several"} room(s) score below 50 on the daylight index; the aggregate daylight score is ${input.daylightScore}/100. A courtyard would add a second light source to the deep rooms.`,
      metric: "Daylight index (estimated)",
      priority: poorDaylight.length >= 3 ? "high" : "medium",
      targetRooms: poorDaylight.slice(0, 6).map((r) => r.roomLabel),
      estimatedEffect:
        "Potential daylight gain is not simulated by this model — use a daylight study before sizing the court.",
    });
  }

  if (
    (westSouthShare >= 0.4 || input.heatScore < 65) &&
    input.windows.length > 0
  ) {
    const targetRooms = Array.from(
      new Set(
        input.windows
          .filter((w) => w.wall === "W" || w.wall === "S")
          .map((w) => w.roomLabel),
      ),
    );
    recommendations.push({
      id: "jaali",
      title: "Use jaali screens / external louvres on W and S windows",
      reason: `${Math.round(westSouthShare * 100)}% of the modelled summer pane exposure arrives on W/S walls. The estimated cooling demand is ${Math.round(input.cooling.annualCoolingKWh)} kWh/year.`,
      metric: "Heat gain / shading (estimated)",
      priority: westSouthShare >= 0.55 ? "high" : "medium",
      targetRooms,
      estimatedEffect:
        "A jaali cuts direct sun while keeping airflow, but this model cannot quantify the airflow or daylight penalty.",
    });
  }

  if (singleSided.length > 0 || input.ventilationScore < 55) {
    recommendations.push({
      id: "ventilator",
      title: "Add a roof ventilator or high-level exhaust vent",
      reason: `${singleSided.length} room(s) have windows on only one wall; the aggregate ventilation score is ${input.ventilationScore}/100. A high-level vent can create a stack effect where a through-draught is impossible.`,
      metric: "Ventilation index (estimated)",
      priority: singleSided.length >= 3 ? "high" : singleSided.length > 0 ? "medium" : "low",
      targetRooms: singleSided.slice(0, 6).map((r) => r.roomLabel),
      estimatedEffect:
        "Stack ventilation depends on vent area, temperature difference and wind; not simulated here.",
    });
  }

  if (shadedWindows.length > 0) {
    const depths = shadedWindows.map((w) => w.requiredOverhangFt);
    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);
    const avgReduction =
      shadedWindows.reduce((sum, w) => sum + w.overhangReductionPct, 0) /
      shadedWindows.length;
    recommendations.push({
      id: "overhang",
      title: "Build the computed window overhangs",
      reason: `${shadedWindows.length} window(s) need a ${minDepth.toFixed(1)}–${maxDepth.toFixed(1)} ft overhang for full shade at the critical summer hour; the estimated direct summer exposure falls by ${Math.round(avgReduction)}% when they are installed.`,
      metric: "Shading / cooling demand (estimated)",
      priority: avgReduction >= 35 ? "high" : "medium",
      targetRooms: Array.from(
        new Set(shadedWindows.map((w) => w.roomLabel)),
      ),
      estimatedEffect:
        "The cooling estimate already assumes these overhangs exist; omitting them gives back the unshaded load.",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return recommendations.sort(
    (a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id),
  );
}
