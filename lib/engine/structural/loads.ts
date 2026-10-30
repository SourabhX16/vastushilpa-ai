import type { Layout, PlotInput } from "@/lib/engine/types";
import { beamsOfGrid, buildStructuralGrid } from "./grid";
import type {
  BeamPiece,
  ColumnLoadAgg,
  StructuralGrid,
  StructuralOptions,
  StructuralPanel,
} from "./types";

/**
 * Load takedown per IS 456:2000 cl. 36.2 (loads per IS 875 Parts 1–4) with
 * the γf = 1.5 of Table 18 applied at the very end.
 *
 * Two-way slab loads are distributed to the supporting beams by the 45°
 * corner-bisector construction of IS 456:2000 cl. 24.5 + Fig. 7 (the clause
 * says "loads on supporting beams may be assumed in accordance with Fig. 7";
 * the code gives no formulas — the closed-form resultants below are the
 * exact integrals of those 45° tributary shapes, derived and re-checked):
 *   triangle    V = q·Ls²/8            M = q·Ls³/24
 *   trapezoid   V = q·Ls(2Ll−Ls)/8     M = q·Ls(3Ll²−Ls²)/48
 * with Ls the SHORT panel span, Ll the LONG panel span, q the unfactored
 * slab load (kN/m²). A beam along the longer edge gets the trapezoid; the
 * shorter edge gets the triangle.
 *
 * One-way slabs (aspect ratio ≥ 2 — the "ratio-2" rule, verified:false,
 * check IS 456 cl. 22.6) shed load to the two long-edge beams as uniform
 * tributary strips of width Ls/2 (the beam that ends the SHORT span
 * direction — the long-edge beam — takes q·Ls/2 per metre).
 *
 * Mixed piece profiles + wall/self-weight UDLs along the same beam are
 * combined by numerically integrating the load profile (deterministic
 * 200-step midpoint rule) for end shears and mid-span moment.
 */

const FT_TO_M = 0.3048;
const CONCRETE_UNIT_KN_M3 = 25; // RCC 24–25 (IS 875-1 Table 1) — verify exact
const BRICK_UNIT_KN_M3 = 19; // IS 875-1 Table 1 (bound unverified)
export const STOREY_HEIGHT_M = 3.0; // structural.config.ts assumption
const FINISH_KNM2 = 1.0; // structural.config.ts
const PARTITION_ALLOWANCE_KNM2 = 1.0; // IS 875 (Part 2):1987 cl. 3.1.2 min.
const LL_FLOOR_KNM2 = 2.0; // IS 875-2 Table 1 dwellings
const LL_ROOF_KNM2 = 1.5; // IS 875-2 Table 2 accessible roofs
const STEPS = 200;
const EPS = 1e-6;

export function hasNotionalFirstFloor(layout: Layout): boolean {
  return layout.notes.some((n) =>
    n.toLowerCase().includes("notional first floor"),
  );
}

export function initialBeamDepth(spanM: number): number {
  // span/15 + 50 mm rounded up to 25 mm, min 275 mm; span/eff-depth ≈ 18–19
  // < 20 (cl. 23.2.1 simply-supported base ratio used conservatively).
  return Math.max(275, Math.ceil(((spanM * 1000) / 15 + 50) / 25) * 25);
}

export function initialSlabThickness(twoWay: boolean, lxM: number): number {
  // two-way ≤ 3.5 m: cl. 24.1 note 35 × 0.8 (Fe500 via Fe415 factor — flagged
  // in checks) on OVERALL depth. one-way: cl. 23.2.1 ratio 26 on effective
  // depth, + 26 mm cover/bar allowance.
  if (twoWay) return Math.max(110, Math.ceil(((lxM * 1000) / 32) / 5) * 5);
  const d = (lxM * 1000) / 26;
  return Math.max(110, Math.ceil((d + 26) / 5) * 5);
}

/* ------------------------------------------------------------------ */
/* internal beam representation — profile pieces + piece bookkeeping  */
/* ------------------------------------------------------------------ */

export interface PieceProfile {
  kind: "tri" | "trap" | "uni";
  /** metres from the beam start to the piece start */
  offset: number;
  /** piece length along the beam, metres (== panel edge length) */
  len: number;
  /** peak intensity for tri/trap (kN/m); uniform value for uni */
  value: number;
  /** trap only: length of each taper (m) == perp/2 */
  rise: number;
  panelId: string;
}

interface BeamCore {
  id: string;
  axis: "x" | "y";
  lineFt: number;
  startFt: number;
  endFt: number;
  spanM: number;
  widthMm: number;
  depthMm: number;
  wallKnm: number;
  profile: PieceProfile[];
}

export interface BeamResult {
  /** unfactored end shear at the start/end column, kN per level */
  vStart: number;
  vEnd: number;
  /** unfactored mid-span moment, kN·m per level */
  mMid: number;
  /** equivalent-descriptive slab UDL for the UI (kN/m) */
  udlSlab: number;
  /** dominant piece kinds arriving on this beam */
  kindLabel: string;
}

function profileIntensity(profile: PieceProfile[], x: number): number {
  let q = 0;
  for (const p of profile) {
    if (x <= p.offset + EPS || x >= p.offset + p.len - EPS) continue;
    const local = x - p.offset;
    if (p.kind === "uni") q += p.value;
    else if (p.kind === "tri")
      q += (local < p.len / 2 ? local : p.len - local) * (p.value / (p.len / 2));
    else if (p.kind === "trap") {
      if (local < p.rise) q += (p.value * local) / p.rise;
      else if (local > p.len - p.rise) q += (p.value * (p.len - local)) / p.rise;
      else q += p.value;
    }
  }
  return q;
}

function integrateBeam(
  core: BeamCore,
): { vStart: number; vEnd: number; mMid: number } {
  const n = STEPS;
  const dx = core.spanM / n;
  const beamSelfKnm =
    (core.widthMm / 1000) * (core.depthMm / 1000) * CONCRETE_UNIT_KN_M3;
  const totalAt = (x: number) =>
    profileIntensity(core.profile, x) + core.wallKnm + beamSelfKnm;

  let area = 0;
  let rLeft = 0;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * dx;
    const dq = totalAt(x) * dx;
    area += dq;
    rLeft += dq * (core.spanM - x);
  }
  rLeft /= core.spanM;
  const rRight = area - rLeft;

  let mMid = (rLeft * core.spanM) / 2;
  for (let i = 0; i < n / 2; i++) {
    const x = (i + 0.5) * dx;
    mMid -= totalAt(x) * dx * (core.spanM / 2 - x);
  }
  return { vStart: rLeft, vEnd: rRight, mMid: Math.max(0, mMid) };
}

/* ------------------------------------------------------------------ */
/* panel loads                                                         */
/* ------------------------------------------------------------------ */

/**
 * Interior wall criterion: the panel is touched by a grid line strictly
 * inside the plot (room walls between rooms put the IS 875-2 cl. 3.1.2
 * partition allowance on the panel loads).
 */
function panelHasPartition(
  grid: StructuralGrid,
  panel: StructuralGrid["panels"][number],
): boolean {
  const xs = grid.xLines;
  const ys = grid.yLines;
  const innerX =
    xs.length > 2 &&
    panel.rect.x > xs[0] + EPS &&
    panel.rect.x + panel.rect.w < xs[xs.length - 1] - EPS;
  const innerY =
    ys.length > 2 &&
    panel.rect.y > ys[0] + EPS &&
    panel.rect.y + panel.rect.h < ys[ys.length - 1] - EPS;
  return innerX || innerY;
}

export interface LoadedPanel extends StructuralPanel {
  partition: boolean;
}

export function computePanelLoads(
  grid: StructuralGrid,
  levels: number,
  thicknessById: Map<string, number>,
  options: StructuralOptions,
): LoadedPanel[] {
  const panels: LoadedPanel[] = [];
  for (const gp of grid.panels) {
    const rect = gp.rect;
    const lxM = Math.min(rect.w, rect.h) * FT_TO_M;
    const lyM = Math.max(rect.w, rect.h) * FT_TO_M;
    const aspect = lxM > 0 ? lyM / lxM : 1;
    const twoWay = aspect < 2;
    const partition = panelHasPartition(grid, gp);
    const thickness =
      thicknessById.get(gp.id) ?? initialSlabThickness(twoWay, lxM);
    const q = {
      self: (thickness / 1000) * CONCRETE_UNIT_KN_M3,
      finish: FINISH_KNM2,
      partition: partition ? PARTITION_ALLOWANCE_KNM2 : 0,
      // notional-floor layout: modelled slab is the occupied first floor
      // (LL 2.0); single-level layouts: accessible terrace (LL 1.5)
      live: levels === 2 ? LL_FLOOR_KNM2 : LL_ROOF_KNM2,
    };
    if (options.overloadFactor && options.overloadFactor > 0 && !options.overloadBeamId) {
      q.live *= options.overloadFactor;
    }
    const dead = q.self + q.finish + q.partition;
    panels.push({
      id: gp.id,
      lx: lxM,
      ly: lyM,
      twoWay,
      thicknessMm: thickness,
      q,
      factoredKMnM2: 1.5 * (dead + q.live), // Table 18 γf = 1.5 (DL+LL)
      aspectRatio: aspect,
      partition,
    });
  }
  return panels;
}

/* ------------------------------------------------------------------ */
/* takedown                                                            */
/* ------------------------------------------------------------------ */

export interface TakedownResult {
  grid: StructuralGrid;
  panels: LoadedPanel[];
  /** final SHRUNKEN picture: all structural data per beam */
  beamLoads: Map<string, BeamResult>;
  /** factored per-column axial load aggregates */
  columnLoads: Map<string, ColumnLoadAgg>;
  /** per-beam piece records for UI/load path (display formulas) */
  pieces: Map<string, BeamPiece[]>;
  /** edges whose piece could not find a beam (Brahmasthan holes) */
  unassignedEdges: string[];
  wallKnm: number;
  levels: number;
}

export function runTakedown(
  plot: PlotInput,
  layout: Layout,
  thicknessById: Map<string, number>,
  beamDepthById: Map<string, number>,
  options: StructuralOptions = {},
): TakedownResult {
  const grid = buildStructuralGrid(plot, layout);
  const levels = hasNotionalFirstFloor(layout) ? 2 : 1;
  const wallKnm = 0.23 * BRICK_UNIT_KN_M3 * STOREY_HEIGHT_M; // ≈ 13.11 kN/m
  const panels = computePanelLoads(grid, levels, thicknessById, options);

  /* ---- beams (stubs with line coordinates) ------------------------- */
  // start/end coordinates on the chosen axis (recovered from column ids)
  const cores = new Map<string, BeamCore>();
  const keptAxisCoords = (
    axis: "x" | "y",
    lineIdx: number,
  ): number[] | null => {
    const cols = grid.columns
      .filter((c) => (axis === "x" ? c.p === lineIdx : c.k === lineIdx))
      .map((c) => (axis === "x" ? c.xFt : c.yFt))
      .sort((a, b) => a - b);
    return cols;
  };
  for (const seg of beamsOfGrid(grid)) {
    if (seg.spanM <= 0) continue;
    const coords = keptAxisCoords(seg.axis, seg.lineIdx);
    if (!coords) continue;
    const id = seg.id;
    cores.set(id, {
      id,
      axis: seg.axis,
      lineFt:
        seg.axis === "x" ? grid.yLines[seg.lineIdx] : grid.xLines[seg.lineIdx],
      startFt: coords[seg.segIdx],
      endFt: coords[seg.segIdx + 1],
      spanM: seg.spanM,
      widthMm: 230,
      depthMm: beamDepthById.get(id) ?? initialBeamDepth(seg.spanM),
      wallKnm: seg.boundary ? wallKnm : 0,
      profile: [],
    });
  }

  /* ---- pieces per panel edge onto beams ---------------------------- */
  const unassignedEdges: string[] = [];
  const panelById = new Map(panels.map((pp) => [pp.id, pp]));

  for (const gp of grid.panels) {
    const panel = panelById.get(gp.id);
    if (!panel) continue;
    const rect = gp.rect;
    const qTotal =
      panel.q.self + panel.q.finish + panel.q.partition + panel.q.live;
    const LsM = panel.lx;
    const dims: Record<"W" | "E" | "N" | "S", { run: number; perp: number }> = {
      W: { run: rect.h, perp: rect.w },
      E: { run: rect.h, perp: rect.w },
      N: { run: rect.w, perp: rect.h },
      S: { run: rect.w, perp: rect.h },
    };
    const edge: Record<
      "W" | "E" | "N" | "S",
      { axis: "x" | "y"; line: number; a: number; b: number }
    > = {
      W: { axis: "y", line: rect.x, a: rect.y, b: rect.y + rect.h },
      E: { axis: "y", line: rect.x + rect.w, a: rect.y, b: rect.y + rect.h },
      N: { axis: "x", line: rect.y, a: rect.x, b: rect.x + rect.w },
      S: { axis: "x", line: rect.y + rect.h, a: rect.x, b: rect.x + rect.w },
    };

    for (const side of ["W", "E", "N", "S"] as const) {
      const oneWay = !panel.twoWay;
      // one-way: only the two edges that END the short-span direction
      // (i.e. the long-edge beams carrying the uniform tributary Ls/2)
      const shortDimRunsVertically = rect.h < rect.w;
      if (oneWay) {
        const isCarrier =
          (shortDimRunsVertically && (side === "N" || side === "S")) ||
          (!shortDimRunsVertically && (side === "W" || side === "E"));
        if (!isCarrier) continue;
      }
      const runFt = dims[side].run;
      const perpFt = dims[side].perp;
      const runM = runFt * FT_TO_M;
      const perpM = perpFt * FT_TO_M;
      const peak = (qTotal * LsM) / 2; // kN/m

      // find the beam covering the edge
      const r = edge[side];
      const cands = Array.from(cores.values()).filter(
        (c) =>
          c.axis === r.axis &&
          Math.abs(c.lineFt - r.line) < EPS &&
          c.startFt <= r.a + EPS &&
          c.endFt >= r.b - EPS,
      );
      let beam = cands.length
        ? cands.reduce((acc, c) =>
            Math.abs(c.lineFt - r.line) < Math.abs(acc.lineFt - r.line) ? c : acc,
          )
        : null;
      if (!beam) {
        // fallback: nearest parallel beam containing the same interval
        const near = Array.from(cores.values())
          .filter(
            (c) =>
              c.axis === r.axis && c.startFt <= r.a + EPS && c.endFt >= r.b - EPS,
          )
          .sort((c1, c2) => Math.abs(c1.lineFt - r.line) - Math.abs(c2.lineFt - r.line));
        beam = near.length ? near[0] : null;
      }
      if (!beam) {
        unassignedEdges.push(`${panel.id}:${side}`);
        continue;
      }

      const offset = r.a - beam.startFt;
      if (oneWay) {
        beam.profile.push({
          kind: "uni",
          offset,
          len: runM,
          value: peak,
          rise: 0,
          panelId: panel.id,
        });
        continue;
      }
      const trap = runFt >= perpFt;
      beam.profile.push({
        kind: trap ? "trap" : "tri",
        offset,
        len: runM,
        value: peak,
        rise: perpM / 2,
        panelId: panel.id,
      });
    }
  }

  /* ---- solve beams + per-piece display resultants ------------------ */
  const beamLoads = new Map<string, BeamResult>();
  const pieces = new Map<string, BeamPiece[]>();
  for (const core of Array.from(cores.values())) {
    const id = core.id;
    const overloadActive =
      options.overloadBeamId === id && options.overloadFactor
        ? options.overloadFactor
        : 1;
    const scaled = core.profile.map((prof: PieceProfile) => ({
      ...prof,
      // debug knob: scale only what the slab produces (not wall/self), so
      // structural tests can overload individual beams deterministically
      value: prof.value * overloadActive,
    }));
    core.profile = scaled;
    const { vStart, vEnd, mMid } = integrateBeam(core);

    let pieceArea = 0;
    for (const p of core.profile) {
      pieceArea += p.len * (p.kind === "uni" ? p.value : p.value / 2);
    }
    const kinds = Array.from(
      new Set(core.profile.map((p: PieceProfile) => p.kind)),
    );
    const kindLabel = kinds.length
      ? kinds.map(kMap).join("+")
      : "none";
    beamLoads.set(id, {
      vStart,
      vEnd,
      mMid,
      udlSlab: core.spanM > 0 ? pieceArea / core.spanM : 0,
      kindLabel,
    });

    // piece records for UI: closed-form resultants per piece
    const list: BeamPiece[] = core.profile.map((p: PieceProfile) => {
      const pnl = panelById.get(p.panelId);
      const qT = pnl
        ? pnl.q.self + pnl.q.finish + pnl.q.partition + pnl.q.live
        : 0;
      const ls = pnl ? pnl.lx : 1;
      // exact integrals of the 45° shapes (cl. 24.5 / Fig. 7):
      if (p.kind === "tri") {
        return {
          beamId: id,
          end: "start" as const,
          kind: "triangle" as const,
          v: (qT * ls * ls) / 8,
          m: (qT * ls * ls * ls) / 24,
          panelId: p.panelId,
        };
      }
      if (p.kind === "trap") {
        const ll = pnl ? pnl.ly : 1;
        return {
          beamId: id,
          end: "start" as const,
          kind: "trapezoid" as const,
          v: (qT * ls * (2 * ll - ls)) / 8,
          m: (qT * ls * (3 * ll * ll - ls * ls)) / 48,
          panelId: p.panelId,
        };
      }
      return {
        beamId: id,
        end: "start" as const,
        kind: "uniform" as const,
        v: p.value * p.len,
        m: (p.value * p.len * p.len) / 8,
        panelId: p.panelId,
      };
    });
    pieces.set(id, list);
  }

  /* ---- column loads: factored per-column axial --------------------- */
  const columnLoads = new Map<string, ColumnLoadAgg>();
  for (const col of grid.columns) {
    let sum = 0;
    const attached: ColumnLoadAgg["beams"] = [];
    for (const core of Array.from(cores.values())) {
      const isStart =
        core.axis === "x"
          ? core.lineFt === col.yFt && Math.abs(core.startFt - col.xFt) < EPS
          : core.lineFt === col.xFt && Math.abs(core.startFt - col.yFt) < EPS;
      const isEnd =
        core.axis === "x"
          ? core.lineFt === col.yFt && Math.abs(core.endFt - col.xFt) < EPS
          : core.lineFt === col.xFt && Math.abs(core.endFt - col.yFt) < EPS;
      if (!isStart && !isEnd) continue;
      const res = beamLoads.get(core.id);
      if (!res) continue;
      const shear = isStart ? res.vStart : res.vEnd;
      sum += shear * levels;
      attached.push({ id: core.id, end: isStart ? "start" : "end", shear });
    }
    const service = sum; // unfactored, per the engine's service-only footing
    columnLoads.set(col.id, {
      xFt: col.xFt,
      yFt: col.yFt,
      pu: 1.5 * service, // Table 18: γf = 1.5 for DL+LL
      service,
      levels,
      beams: attached,
    });
  }
  return {
    grid,
    panels,
    beamLoads,
    columnLoads,
    pieces,
    unassignedEdges,
    wallKnm,
    levels,
  };
}

function kMap(k: string): string {
  return k === "tri" ? "triangle" : k === "trap" ? "trapezoid" : "uniform";
}

/* re-exported types used by the engine assembly */
export type { StructuralGrid };
