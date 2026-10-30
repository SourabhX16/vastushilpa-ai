import type { Layout, PlotInput, Rect } from "@/lib/engine/types";
import {
  cellRectForZone,
  computeVastuGrid,
  toFeet,
} from "@/lib/engine/vastuGrid";
import type { ForcedSpan, StructuralGrid } from "./types";

/**
 * Structural grid — column placement on a line grid derived from the layout.
 *
 * Rules (each traced to a clause or an explicit unverified assumption):
 *  - Grid lines: plot ends + every wall corner the layout produces
 *    (columns must land at room corners).
 *  - Corners within 1.0 ft are clustered to one representative line
 *    (deterministic: value closest to the group mean, ties → lower value).
 *  - Any resulting span longer than 4.5 m is split with even intermediate
 *    lines (assumption: practical spans for a 3.0 m storey; IS 456 puts no
 *    absolute span limit — verified:false, check practice/agar SP-16 tables).
 *  - A column is NEVER placed strictly inside the Brahmasthan (centre cell
 *    of the 3x3 vastu grid shrunk by 0.5 ft). Columns sitting exactly on
 *    the margin/zone edges are kept. Spans forced by the omission are
 *    reported in `forcedSpans`.
 *  - Beams run on every kept line between consecutive kept columns.
 */

const CLUSTER_TOL_FT = 1.0;

export const MAX_SPAN_M = 4.5;
export const MAX_SPAN_FT = MAX_SPAN_M / 0.3048;
const BRAHMASTHAN_MARGIN_FT = 0.5;
const EPS = 1e-6;

/** Cluster nearly-coincident coordinates into single representative lines. */
function clusterAxis(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v - g[0] <= tol) g.push(v);
    else groups.push([v]);
  }
  const reps: number[] = [];
  for (const g of groups) {
    const mean = g.reduce((s, v) => s + v, 0) / g.length;
    let best = g[0];
    for (const v of g) {
      if (Math.abs(v - mean) < Math.abs(best - mean) - 1e-9) best = v;
    }
    reps.push(best);
  }
  // clusters can produce duplicate representatives — dedupe
  const out: number[] = [];
  for (const v of reps) {
    if (out.length === 0 || v - out[out.length - 1] > 1e-9) out.push(v);
  }
  return out;
}

function splitLongSpans(lines: number[]): number[] {
  const out = [...lines];
  let i = 0;
  // one pass per accumulated pair so inserted points also get checked
  while (i < out.length - 1) {
    const gap = out[i + 1] - out[i];
    const needed = Math.ceil(gap / MAX_SPAN_FT) - 1;
    if (needed <= 0) {
      i++;
      continue;
    }
    const inserted: number[] = [];
    for (let n = 1; n <= needed; n++) {
      inserted.push(out[i] + (gap * n) / (needed + 1));
    }
    out.splice(i + 1, 0, ...inserted);
    i += needed + 1;
  }
  return out;
}

/** true when the point is STRICTLY inside the shrunk Brahmasthan cell. */
function insideBrahmasthan(plot: PlotInput, xFt: number, yFt: number): boolean {
  const grid = computeVastuGrid(plot);
  const cell = cellRectForZone(grid, "C");
  const cell2: Rect = {
    x: cell.x + BRAHMASTHAN_MARGIN_FT,
    y: cell.y + BRAHMASTHAN_MARGIN_FT,
    w: cell.w - 2 * BRAHMASTHAN_MARGIN_FT,
    h: cell.h - 2 * BRAHMASTHAN_MARGIN_FT,
  };
  if (cell2.w <= 0 || cell2.h <= 0) return false;
  return (
    xFt > cell2.x + EPS &&
    xFt < cell2.x + cell2.w - EPS &&
    yFt > cell2.y + EPS &&
    yFt < cell2.y + cell2.h - EPS
  );
}

export function buildStructuralGrid(
  plot: PlotInput,
  layout: Layout,
): StructuralGrid {
  const lengthFt = toFeet(plot.length, plot.unit);
  const widthFt = toFeet(plot.width, plot.unit);

  // ---- 1. collect wall corner coordinates -------------------------------
  const rawX: number[] = [0, lengthFt];
  const rawY: number[] = [0, widthFt];
  for (const room of layout.rooms) {
    rawX.push(room.rect.x, room.rect.x + room.rect.w);
    rawY.push(room.rect.y, room.rect.y + room.rect.h);
  }

  // ---- 2. cluster + split into a well-conditioned grid ------------------
  const xLines = splitLongSpans(clusterAxis(rawX, CLUSTER_TOL_FT));
  const yLines = splitLongSpans(clusterAxis(rawY, CLUSTER_TOL_FT));

  // ---- 3. columns at line intersections, minus Brahmasthan -------------
  const columns: StructuralGrid["columns"] = [];
  const skipped: { xFt: number; yFt: number; xLine: number; yLine: number }[] =
    [];
  // note: enumerate p (y) outer, x (·) inner — row-major, north first
  for (let p = 0; p < yLines.length; p++) {
    for (let k = 0; k < xLines.length; k++) {
      const xFt = xLines[k];
      const yFt = yLines[p];
      if (insideBrahmasthan(plot, xFt, yFt)) {
        skipped.push({ xFt, yFt, xLine: k, yLine: p });
        continue;
      }
      columns.push({ id: `C-${k + 1}-${p + 1}`, xFt, yFt, k, p });
    }
  }

  // ---- 4. forced-span report for skipped columns ------------------------
  const forcedSpans: ForcedSpan[] = [];
  for (const s of skipped) {
    const keptOnYLine = columns
      .filter((c) => c.p === s.yLine)
      .map((c) => c.xFt)
      .sort((a, b) => a - b);
    const keptOnXLine = columns
      .filter((c) => c.k === s.xLine)
      .map((c) => c.yFt)
      .sort((a, b) => a - b);
    const gapX = spanAround(keptOnYLine, s.xFt);
    const gapY = spanAround(keptOnXLine, s.yFt);
    if (gapX !== null) {
      forcedSpans.push({
        axis: "x",
        atFt: s.yFt,
        spanM: gapX * 0.3048,
        spanFt: gapX,
        exceeds45m: gapX > MAX_SPAN_FT + EPS,
        note: `column omitted in Brahmasthan at (${s.xFt.toFixed(1)} ft, ${s.yFt.toFixed(1)} ft); beam span ${gapX.toFixed(2)} ft along x`,
      });
    }
    if (gapY !== null) {
      forcedSpans.push({
        axis: "y",
        atFt: s.xFt,
        spanM: gapY * 0.3048,
        spanFt: gapY,
        exceeds45m: gapY > MAX_SPAN_FT + EPS,
        note: `column omitted in Brahmasthan at (${s.xFt.toFixed(1)} ft, ${s.yFt.toFixed(1)} ft); beam span ${gapY.toFixed(2)} ft along y`,
      });
    }
  }

  // ---- 5. panels between kept-line intersections -----------------------
  const panels: StructuralGrid["panels"] = [];
  for (let i = 0; i < xLines.length - 1; i++) {
    for (let j = 0; j < yLines.length - 1; j++) {
      panels.push({
        id: `S-${i + 1}-${j + 1}`,
        i,
        j,
        rect: {
          x: xLines[i],
          y: yLines[j],
          w: xLines[i + 1] - xLines[i],
          h: yLines[j + 1] - yLines[j],
        },
      });
    }
  }

  const beamId = (axis: "x" | "y", k: number, j: number): string =>
    axis === "x" ? `B-x-${k}-${j}` : `B-y-${k}-${j}`;

  return { xLines, yLines, columns, panels, beamId, forcedSpans };
}

/** span that the two neighbouring elements around `v` must cover. */
function spanAround(sorted: number[], v: number): number | null {
  const lower = sorted.filter((c) => c < v - EPS);
  const higher = sorted.filter((c) => c > v + EPS);
  if (lower.length === 0 || higher.length === 0) return null;
  const left = Math.max(...lower);
  const right = Math.min(...higher);
  return right - left;
}


/**
 * Single source of truth for beam segments over kept columns: every beam is
 * the strip between consecutive kept columns on a grid line. Loads and
 * autofix both consume this so the engine sees exactly one beam picture.
 */
export interface BeamSeg {
  id: string;
  axis: "x" | "y";
  /** index of the line the beam sits on (x-axis beams index yLines) */
  lineIdx: number;
  /** segment index between consecutive kept columns */
  segIdx: number;
  /** absolute line coordinate (ft): the y value of an x-axis beam, etc. */
  lineFt: number;
  startFt: number;
  endFt: number;
  spanFt: number;
  spanM: number;
  /** true when the line is a plot-boundary line (corner wall beams) */
  boundary: boolean;
}

export function beamsOfGrid(grid: StructuralGrid): BeamSeg[] {
  const segs: BeamSeg[] = [];
  const keptOn = (which: "x" | "y", lineIdx: number) =>
    grid.columns
      .filter((c) =>
        which === "x"
          ? c.p === lineIdx // x-axis beams live on y lines
          : c.k === lineIdx,
      )
      .map((c) => (which === "x" ? c.xFt : c.yFt))
      .sort((a, b) => a - b);

  for (let p = 0; p < grid.yLines.length; p++) {
    const cols = keptOn("x", p);
    for (let n = 0; n < cols.length - 1; n++) {
      segs.push({
        id: grid.beamId("x", p, n),
        axis: "x",
        lineIdx: p,
        segIdx: n,
        lineFt: grid.yLines[p],
        startFt: cols[n],
        endFt: cols[n + 1],
        spanFt: cols[n + 1] - cols[n],
        spanM: (cols[n + 1] - cols[n]) * 0.3048,
        boundary: p === 0 || p === grid.yLines.length - 1,
      });
    }
  }
  for (let k = 0; k < grid.xLines.length; k++) {
    const cols = keptOn("y", k);
    for (let n = 0; n < cols.length - 1; n++) {
      segs.push({
        id: grid.beamId("y", k, n),
        axis: "y",
        lineIdx: k,
        segIdx: n,
        lineFt: grid.xLines[k],
        startFt: cols[n],
        endFt: cols[n + 1],
        spanFt: cols[n + 1] - cols[n],
        spanM: (cols[n + 1] - cols[n]) * 0.3048,
        boundary: k === 0 || k === grid.xLines.length - 1,
      });
    }
  }
  return segs;
}
