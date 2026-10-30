import { getCityById } from "@/lib/data/cities";
import {
  STRUCTURAL_ASSUMPTIONS,
  seismicNote,
} from "@/lib/data/structural.config";
import type { Layout, PlotInput } from "@/lib/engine/types";
import { runAutoFix } from "./autoFix";
import { beamsOfGrid } from "./grid";
import {
  estimateFooting,
  foundationFootnote,
  ASSUMED_SBC_KPA,
} from "./foundation";
import type {
  FootingEstimate,
  ResultPlan,
  StructuralResult,
  StructuralOptions,
} from "./types";

/**
 * Engine entry point: uploaded plot + generated layout → the full structural
 * result (members, checks, autofix log, load path, foundation + seismic
 * notes) consumed by the design step, plan-view structure overlay, 3D model
 * and the report panel.
 */
export function runStructural(
  plot: PlotInput,
  layout: Layout,
  options: StructuralOptions = {},
): StructuralResult {
  const fix = runAutoFix(plot, layout, options);

  const footings: FootingEstimate[] = fix.members.columns.map((col) =>
    estimateFooting(col.member),
  );

  /* ---- load path model --------------------------------------------- */
  const loadPath: StructuralResult["loadPath"] = fix.members.columns.map(
    (col) => {
      const attached = fix.columnLoads.get(col.id)?.beams ?? [];
      const slabs = new Set<string>();
      for (const b of attached) {
        const pieces = fix.pieces.get(b.id) ?? [];
        for (const p of pieces) if (p.panelId) slabs.add(p.panelId);
      }
      return {
        columnId: col.id,
        slabs: Array.from(slabs),
        beams: attached.map((b) => b.id),
        footing: `F-${col.id}`,
      };
    },
  );
  const loadPathNote = fix.levels === 2
      ? "Slabs → beams → columns → footings (both models assumed identical above; column Pu multiplies the wall/self/slab set by the notional two levels). The two-way slab share goes to beam ends from the 45° corner-bisector construction (IS 456 cl. 24.5/Fig. 7); one-way slabs drop uniform strips on the long-edge beams."
      : "Slabs → beams → columns → footings: two-way panels shed via the 45° construction of IS 456 cl. 24.5/Fig. 7; one-way panels drop uniform strips on the long-edge beams.";

  /* ---- seismic advisory (city-driven, verified:false) ---------------- */
  const city = getCityById(plot.city);
  const zone = city?.seismicZone ?? undefined;
  const zoneLabel = zone ? `Zone ${zone}` : "Zone unknown";
  const seismic = {
    zone: zoneLabel,
    label: zoneLabel,
    note:
      seismicNote(zone) ??
      "City not recognised — advisory seismic note unavailable.",
    verified: false,
    source: "IS 1893-1:2016 via cities.ts (entries marked verified:false)",
  };

  /* ---- serializable plan data for the 2D/3D overlays ---------------- */
  const plan: ResultPlan = {
    xLines: fix.grid.xLines,
    yLines: fix.grid.yLines,
    columns: fix.grid.columns.map((c) => ({ id: c.id, xFt: c.xFt, yFt: c.yFt })),
    panels: fix.grid.panels.map((p) => ({ id: p.id, i: p.i, j: p.j })),
    beams: beamsOfGrid(fix.grid).map((seg) => ({
      id: seg.id,
      axis: seg.axis,
      lineIdx: seg.lineIdx,
      segIdx: seg.segIdx,
      lineFt: seg.lineFt,
      startFt: seg.startFt,
      endFt: seg.endFt,
      spanFt: seg.spanFt,
    })),
    levels: fix.levels,
  };

  return {
    ok: fix.summary.fail === 0,
    members: fix.members,
    summary: fix.summary,
    initialSummary: fix.initialSummary,
    preFixStatus: fix.initialStatus,
    autoFixLog: fix.autoFixLog,
    loadPath,
    loadPathNote,
    forcedSpans: fix.forcedSpans,
    seismic,
    foundation: {
      sbcKPa: ASSUMED_SBC_KPA,
      footings,
      note: foundationFootnote(),
      verified: false,
    },
    assumptions: STRUCTURAL_ASSUMPTIONS.map((a) => ({
      id: a.id,
      label: a.label,
      value: a.value,
      source: a.source,
      verified: a.verified,
    })),
    plan,
  };
}

export type { StructuralOptions };
