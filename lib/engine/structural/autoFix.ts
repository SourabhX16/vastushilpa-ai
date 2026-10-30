import type {
  AutoFixLog,
  BeamPiece,
  ColumnLoadAgg,
  StructuralBeamMember,
  StructuralCheck,
  StructuralColumnMember,
  StructuralGrid,
  StructuralOptions,
  StructuralPanelMember,
  StructuralSummary,
} from "./types";
import {
  checkBeam,
  checkColumn,
  checkSlab,
  pickBeamBars,
  rebarArea,
  type BeamCheckInput,
  type ColumnCheckInput,
} from "./checks";
import { BEAM_WIDTH_MM, SLAB_THK_MAX_MM, SLAB_THK_STEP_MM, BEAM_DEPTH_STEP_MM, BEAM_DEPTH_MAX_MM } from "./constants";
import { beamsOfGrid, buildStructuralGrid } from "./grid";
import { initialBeamDepth, initialSlabThickness, runTakedown, STOREY_HEIGHT_M } from "./loads";
import { nextColumnSize, type SizesState } from "./ladders";

/**
 * Deterministic autofix: one ladder step per failing member per pass, max
 * 12 passes. Every size change RECOMPUTES the full takedown before
 * re-checking (loads feed members back). Ladders:
 *   slab    +5 mm depth steps (cap 350 mm)
 *   beam    depth +25 mm up to span/6 (cap 900 mm); if depth is capped the
 *           min-steel shim grows bars by one ladder step instead
 *   column  size ladder 230→300→350→450, bars re-picked every pass
 *
 * `column-min-ecc` never drives autofix (documented engine note) and never
 * contributes `fail` (amber at most) — see checks.ts.
 */

const MAX_PASSES = 12;

interface AssembleResult {
  members: {
    panels: StructuralPanelMember[];
    beams: StructuralBeamMember[];
    columns: StructuralColumnMember[];
  };
  pieces: Map<string, BeamPiece[]>;
  columnLoads: Map<string, ColumnLoadAgg>;
  wallKnm: number;
  levels: number;
  unassignedEdges: string[];
}

export function runAutoFix(
  plot: Parameters<typeof buildStructuralGrid>[0],
  layout: Parameters<typeof buildStructuralGrid>[1],
  options: StructuralOptions = {},
): {
  grid: StructuralGrid;
  sizes: SizesState;
  members: AssembleResult["members"];
  summary: StructuralSummary;
  initialSummary: StructuralSummary;
  initialStatus: Record<string, "pass" | "amber" | "fail">;
  autoFixLog: AutoFixLog[];
  pieces: Map<string, BeamPiece[]>;
  columnLoads: Map<string, ColumnLoadAgg>;
  wallKnm: number;
  levels: number;
  unassignedEdges: string[];
  forcedSpans: StructuralGrid["forcedSpans"];
  hasNotionalFloor: boolean;
} {
  const grid = buildStructuralGrid(plot, layout);
  const sizes: SizesState = {
    slabThk: new Map(),
    beamDepth: new Map(),
    columnSize: new Map(),
    beamBarOverride: new Map(),
  };

  /* seed sizes from the grid so the takedown sees final values */
  for (const seg of beamsOfGrid(grid)) {
    if (!sizes.beamDepth.has(seg.id)) {
      sizes.beamDepth.set(seg.id, initialBeamDepth(seg.spanM));
    }
  }

  const assemble = (): AssembleResult => {
    const tak = runTakedown(
      plot,
      layout,
      sizes.slabThk,
      sizes.beamDepth,
      options,
    );

    const panels: StructuralPanelMember[] = tak.panels.map((panel) => {
      const { checks } = checkSlab(panel);
      return { id: panel.id, member: panel, checks, status: worst(checks) };
    });

    const beams: StructuralBeamMember[] = [];
    for (const seg of beamsOfGrid(grid)) {
      const res = tak.beamLoads.get(seg.id);
      if (!res) continue;
      const depth = sizes.beamDepth.get(seg.id) ?? initialBeamDepth(seg.spanM);
      const wallLoadKnm = seg.boundary ? tak.wallKnm : 0;
      const input: BeamCheckInput = {
        id: seg.id,
        spanM: seg.spanM,
        widthMm: BEAM_WIDTH_MM,
        depthMm: depth,
        vuStart: 1.5 * res.vStart,
        vuEnd: 1.5 * res.vEnd,
        mu: 1.5 * res.mMid,
        asMinOverride: sizes.beamBarOverride.get(seg.id),
      };
      const { checks, bars, stirrups } = checkBeam(input);
      const factored = 1.5; // Table 18
      beams.push({
        id: seg.id,
        member: {
          id: seg.id,
          axis: seg.axis,
          spanM: seg.spanM,
          widthMm: BEAM_WIDTH_MM,
          depthMm: depth,
          vStart: res.vStart,
          vEnd: res.vEnd,
          mMid: res.mMid,
          udl: {
            slab: res.udlSlab,
            wall: wallLoadKnm,
            selfWeight:
              (BEAM_WIDTH_MM / 1000) * (depth / 1000) * 25 * tak.levels,
          },
          pieces: tak.pieces.get(seg.id) ?? [],
          vuStart: factored * res.vStart,
          vuEnd: factored * res.vEnd,
          mu: factored * res.mMid,
          bars,
          stirrups,
          wallLoadKnm,
        },
        checks,
        status: worst(checks),
      });
    }

    const columns: StructuralColumnMember[] = [];
    for (const col of grid.columns) {
      const agg = tak.columnLoads.get(col.id);
      const size =
        sizes.columnSize.get(col.id) ?? ([230, 230] as [number, number]);
      const input: ColumnCheckInput = {
        id: col.id,
        sizeMm: size,
        pu: agg?.pu ?? 0,
      };
      const { checks, bars } = checkColumn(input, STOREY_HEIGHT_M);
      columns.push({
        id: col.id,
        member: {
          id: col.id,
          xFt: col.xFt,
          yFt: col.yFt,
          sizeMm: size,
          bars,
          pu: agg?.pu ?? 0,
          service: agg?.service ?? 0,
          levels: tak.levels,
        },
        checks,
        status: worst(checks),
      });
    }

    return {
      members: { panels, beams, columns },
      pieces: tak.pieces,
      columnLoads: tak.columnLoads,
      wallKnm: tak.wallKnm,
      levels: tak.levels,
      unassignedEdges: tak.unassignedEdges,
    };
  };

  const summaryOf = (r: AssembleResult): StructuralSummary => {
    const all: StructuralCheck[] = [
      ...r.members.panels.flatMap((m) => m.checks),
      ...r.members.beams.flatMap((m) => m.checks),
      ...r.members.columns.flatMap((m) => m.checks),
    ];
    const count = (status: string) => all.filter((c) => c.status === status).length;
    return {
      total: all.length,
      pass: count("pass"),
      amber: count("amber"),
      fail: count("fail"),
    };
  };

  /* ---------------- loop ---------------- */
  const initialRun = assemble();
  const initialSummary = summaryOf(initialRun);
  /** per-member status BEFORE autofix (test/UI use) */
  const initialStatus: Record<string, "pass" | "amber" | "fail"> = {};
  for (const m of initialRun.members.panels) initialStatus[m.id] = m.status;
  for (const m of initialRun.members.beams) initialStatus[m.id] = m.status;
  for (const m of initialRun.members.columns) initialStatus[m.id] = m.status;
  const log: AutoFixLog[] = [];

  let summary = initialSummary;
  for (let pass = 0; pass < MAX_PASSES && summary.fail > 0; pass++) {
    const state = assemble();

    for (const panel of state.members.panels) {
      if (panel.status !== "fail") continue;
      const failing = panel.checks
        .filter((c) => c.status === "fail")
        .map((c) => c.id);
      const seed = panel.member;
      const cur =
        sizes.slabThk.get(panel.id) ??
        initialSlabThickness(seed.twoWay, seed.lx);
      if (cur >= SLAB_THK_MAX_MM) continue;
      const next = Math.min(SLAB_THK_MAX_MM, cur + SLAB_THK_STEP_MM);
      sizes.slabThk.set(panel.id, next);
      log.push({
        member: panel.id,
        check: failing.join(","),
        before: `t=${cur} mm`,
        after: `t=${next} mm`,
        reason:
          failing.includes("slab-span-depth")
            ? "span-depth shortfall — IS 456 cl. 23.2.1 / 24.1"
            : "moment/shear capacity shortfall — cl. G-1.1 / 40.2",
      });
    }

    for (const beam of state.members.beams) {
      if (beam.status !== "fail") continue;
      const failing = beam.checks
        .filter((c) => c.status === "fail")
        .map((c) => c.id);
      const cur = sizes.beamDepth.get(beam.id) ?? initialBeamDepth(beam.member.spanM);
      const depthCap = Math.min(maxBeamDepthCap(), BEAM_DEPTH_MAX_MM);
      if (failing.length > 0 && cur < depthCap && failing.some((f) => f !== "beam-min-steel")) {
        const next = Math.min(depthCap, cur + BEAM_DEPTH_STEP_MM);
        sizes.beamDepth.set(beam.id, next);
        log.push({
          member: beam.id,
          check: failing.join(","),
          before: `b×h=230×${cur}`,
          after: `b×h=230×${next}`,
          reason: "shear/daylight headroom — cl. 40.2.3 / 23.2.1",
        });
      } else if (failing.includes("beam-min-steel")) {
        const curBars = beam.member.bars;
        const area = rebarArea(curBars.count, curBars.dia);
        const next = pickBeamBars(area + 1);
        sizes.beamBarOverride.set(beam.id, next);
        log.push({
          member: beam.id,
          check: "beam-min-steel",
          before: `${curBars.count}⌀${curBars.dia}`,
          after: `${next.count}⌀${next.dia}`,
          reason: "min tension steel 0.85bd/fy not met — cl. 26.5.1.1(a)",
        });
      }
    }

    for (const col of state.members.columns) {
      if (col.status !== "fail") continue;
      const failing = col.checks.filter((c) => c.status === "fail").map((c) => c.id);
      const cur = sizes.columnSize.get(col.id) ?? ([230, 230] as [number, number]);
      const next = nextColumnSize(cur);
      if (next[0] === cur[0] && next[1] === cur[1]) continue;
      sizes.columnSize.set(col.id, next);
      log.push({
        member: col.id,
        check: failing.join(","),
        before: `${cur[0]}×${cur[1]}`,
        after: `${next[0]}×${next[1]}`,
        reason: "axial/slenderness — cl. 39.3 / 25.1.2",
      });
    }

    summary = summaryOf(assemble());
  }

  /* final recompute to flush loads reflecting final sizes */
  const finalRun = assemble();
  summary = summaryOf(finalRun);

  return {
    grid,
    sizes,
    members: finalRun.members,
    summary,
    initialSummary,
    initialStatus,
    autoFixLog: log,
    pieces: finalRun.pieces,
    columnLoads: finalRun.columnLoads,
    wallKnm: finalRun.wallKnm,
    levels: finalRun.levels,
    unassignedEdges: finalRun.unassignedEdges,
    forcedSpans: grid.forcedSpans,
    hasNotionalFloor: finalRun.levels === 2,
  };
}

function maxBeamDepthCap(): number {
  return BEAM_DEPTH_MAX_MM;
}

function worst(checks: StructuralCheck[]): "pass" | "amber" | "fail" {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "amber")) return "amber";
  return "pass";
}

