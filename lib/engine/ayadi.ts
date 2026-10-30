import {
  AYADI_CONFIG,
  AYADI_CONSTANTS,
  AYADI_DERIVED_CHECKS,
} from "../data/ayadi.config";
import type {
  AyadiFormulaResult,
  AyadiResult,
  AyadiStep,
  AyadiSuggestion,
  AyadiFormulaConfig,
  PlotInput,
} from "./types";

/**
 * Ayadi calculator. Pure functions, no UI imports.
 *
 * PROTOTYPE CONVENTIONS (flagged to the user through steps + config):
 * - Dimensions are converted to hasta with AYADI_CONSTANTS (unverified).
 * - Fractional hastas are truncated to whole hastas (Math.floor, min 1)
 *   because remainder tables assume integral measures. The truncation
 *   convention itself is unverified.
 * - The class index is remainder % divisor, reduced again mod classCount
 *   (the "most-copied" secondary-source convention; see config variants).
 * - All formulas from the config are unverified; unverifiedCount reflects
 *   that in the output so the UI can mark it.
 */

const METRES_PER_FOOT = 0.3048; // exact international definition (not traditional)

function toFeet(value: number, unit: PlotInput["unit"]): number {
  return unit === "ft" ? value : value / METRES_PER_FOOT;
}

function toHasta(feet: number): number {
  return feet / AYADI_CONSTANTS.hastaFeet;
}

/** Prototype guard: whole hastas, minimum 1. */
function quantizeHasta(hasta: number): number {
  return Math.max(1, Math.floor(hasta));
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

const NOT_EVALUATED_TEXT =
  "Not evaluated — formula not digitized / auspicious mapping unknown (see variants in config)";

function evaluateFormula(
  entry: AyadiFormulaConfig,
  lengthHasta: number,
  widthHasta: number
): { step: AyadiStep; formula: AyadiFormulaResult } {
  const base: AyadiStep = {
    label: entry.name,
    formulaText: entry.formulaText,
    calculation: "",
    result: "",
    evaluated: false,
    auspicious: null,
    unverified: true,
  };

  if (entry.multiplier === null || entry.divisor === null) {
    return {
      step: { ...base, calculation: "—", result: NOT_EVALUATED_TEXT },
      formula: {
        key: entry.key,
        name: entry.name,
        evaluated: false,
        auspicious: null,
      },
    };
  }

  const classCount = entry.classCount ?? entry.resultTable.length;
  const product = lengthHasta * widthHasta;
  const scaled = product * entry.multiplier;
  const remainder = scaled % entry.divisor;
  const classIndex = remainder % classCount;
  const row = entry.resultTable[classIndex % entry.resultTable.length];

  const step: AyadiStep = {
    ...base,
    calculation: `L = ${fmt(lengthHasta)} hasta, W = ${fmt(widthHasta)} hasta → L·W·${entry.multiplier} = ${fmt(scaled)} → mod ${entry.divisor} = ${remainder} → mod ${classCount} = class ${classIndex}`,
    result: `${row.label} — ${row.meaning}`,
    evaluated: entry.evaluates,
    auspicious: entry.evaluates ? row.auspicious : null,
  };

  return {
    step,
    formula: {
      key: entry.key,
      name: entry.name,
      evaluated: entry.evaluates,
      auspicious: entry.evaluates ? row.auspicious : null,
    },
  };
}

/**
 * Evaluate the configured Ayadi formula set for a plot.
 *
 * Use this when a caller needs the individual calculation steps and the
 * prototype's overall auspicious flag. Plot dimensions may be supplied in
 * feet or metres; conversion and hasta quantization follow the unverified
 * conventions documented in the data/configuration. The formulas and derived
 * rules are secondary-source implementations and remain unverified.
 */
export function calculateAyadi(plot: PlotInput): AyadiResult {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);
  const lengthHasta = toHasta(lengthFt);
  const widthHasta = toHasta(widthFt);

  const steps: AyadiStep[] = [];
  const convStep: AyadiStep = {
    label: "Measure conversion",
    formulaText: `ft/m → hasta using config constants (1 hasta = ${fmt(
      AYADI_CONSTANTS.hastaFeet
    )} ft = ${fmt(AYADI_CONSTANTS.hastaMeters, 4)} m)`,
    calculation: `L: ${fmt(plot.length)} ${plot.unit} → ${fmt(
      lengthFt
    )} ft → ${fmt(lengthHasta)} hasta → ${quantizeHasta(lengthHasta)} hasta used; W: ${fmt(
      plot.width
    )} ${plot.unit} → ${fmt(widthFt)} ft → ${fmt(
      widthHasta
    )} hasta → ${quantizeHasta(widthHasta)} hasta used`,
    result: `L = ${quantizeHasta(lengthHasta)}, W = ${quantizeHasta(
      widthHasta
    )} (whole hastas, prototype truncation)`,
    evaluated: false,
    auspicious: null,
    unverified: true,
  };
  steps.push(convStep);

  const lengthH = quantizeHasta(lengthHasta);
  const widthH = quantizeHasta(widthHasta);

  const perFormula: AyadiFormulaResult[] = [];
  const auspiciousFlags: boolean[] = [];

  for (const entry of AYADI_CONFIG) {
    const { step, formula } = evaluateFormula(entry, lengthH, widthH);
    steps.push(step);
    if (formula.evaluated && formula.auspicious !== null) {
      auspiciousFlags.push(formula.auspicious);
    }
    perFormula.push(formula);
  }

  const aayaIdx = findClassIndex("aaya", lengthH, widthH);
  const vyayaIdx = findClassIndex("vyaya", lengthH, widthH);
  const derivedOk = aayaIdx !== null && vyayaIdx !== null && aayaIdx >= vyayaIdx;
  const derivedCheck = AYADI_DERIVED_CHECKS[0];
  steps.push({
    label: `Derived: ${derivedCheck.description.split(".")[0] ?? "Aaya >= Vyaya"}`,
    formulaText: derivedCheck.calculation,
    calculation: `Aaya class position ${aayaIdx ?? "?"} vs Vyaya class position ${vyayaIdx ?? "?"} (1..8)`,
    result: derivedOk ? "PASS — income >= expenditure (proxy)" : "FAIL — income < expenditure (proxy)",
    evaluated: true,
    auspicious: derivedOk,
    unverified: true,
  });
  if (aayaIdx !== null && vyayaIdx !== null) {
    auspiciousFlags.push(derivedOk);
  }

  const evaluatedCount = auspiciousFlags.length;
  const overallAuspicious = evaluatedCount > 0 && auspiciousFlags.every(Boolean);

  return {
    steps,
    perFormula,
    overallAuspicious,
    unverifiedCount: steps.filter((s) => s.unverified).length,
  };
}

/* ---------------------- suggestion search ---------------------- */

/**
 * Find nearby plot dimensions that pass the configured Ayadi evaluation.
 *
 * Use this as an exploratory suggestion alongside {@link calculateAyadi},
 * not as a claim that a plot size is traditionally validated. Search offsets
 * are in feet (±3 ft in 0.5 ft steps on each dimension); returned dimensions
 * use the input unit and include deltas in feet. The underlying formula set
 * and auspicious mappings are unverified. At most three candidates are
 * returned, ordered by smallest total change; the input itself is excluded.
 */
export function suggestNearestAuspicious(plot: PlotInput): AyadiSuggestion[] {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);

  const offsets: number[] = [];
  for (let i = -6; i <= 6; i++) offsets.push(i * 0.5);

  const candidates: {
    lengthFt: number;
    widthFt: number;
    dL: number;
    dW: number;
    auspicious: boolean;
  }[] = [];

  for (const dL of offsets) {
    for (const dW of offsets) {
      if (dL === 0 && dW === 0) continue; // never suggest the input itself
      const candLengthFt = lengthFt + dL;
      const candWidthFt = widthFt + dW;
      const cand: PlotInput = {
        ...plot,
        length: plot.unit === "ft" ? candLengthFt : candLengthFt / METRES_PER_FOOT,
        width: plot.unit === "ft" ? candWidthFt : candWidthFt / METRES_PER_FOOT,
      };
      candidates.push({
        lengthFt: candLengthFt,
        widthFt: candWidthFt,
        dL,
        dW,
        auspicious: calculateAyadi(cand).overallAuspicious,
      });
    }
  }

  const passing = candidates.filter((c) => c.auspicious);
  passing.sort(
    (a, b) =>
      Math.abs(a.dL) + Math.abs(a.dW) - (Math.abs(b.dL) + Math.abs(b.dW)) ||
      Math.abs(a.dL) - Math.abs(b.dL) ||
      a.dL - b.dL ||
      Math.abs(a.dW) - Math.abs(b.dW) ||
      a.dW - b.dW
  );

  return passing.slice(0, 3).map((c) => ({
    length:
      plot.unit === "ft" ? c.lengthFt : +(c.lengthFt / METRES_PER_FOOT).toFixed(3),
    width:
      plot.unit === "ft" ? c.widthFt : +(c.widthFt / METRES_PER_FOOT).toFixed(3),
    unit: plot.unit,
    deltaLengthFt: c.dL,
    deltaWidthFt: c.dW,
  }));
}

/** Class index (0-based) a given formula resolves to for these dims. */
function findClassIndex(
  key: AyadiFormulaConfig["key"],
  lengthH: number,
  widthH: number
): number | null {
  const entry = AYADI_CONFIG.find((e) => e.key === key);
  if (!entry || entry.multiplier === null || entry.divisor === null) return null;
  const scaled = lengthH * widthH * entry.multiplier;
  return scaled % entry.divisor;
}

export const AYADI_STEP_NOTICE =
  "All Ayadi formulas in this prototype are unverified config data — verify against primary texts.";
