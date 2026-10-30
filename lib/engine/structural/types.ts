import type { PlotInput, Rect } from "@/lib/engine/types";

/**
 * Structural (IS 456:2000 preliminary design) result types.
 * Pure data — no UI imports allowed in lib/engine.
 */

export type MemberType = "panel" | "beam" | "column" | "footing";
export type CheckStatus = "pass" | "amber" | "fail";

export interface StructuralCheck {
  /** stable id like "slab-span-depth" */
  id: string;
  label: string;
  /** human readable demand, e.g. "4.85 kN·m/m" */
  demand: string;
  capacity: string;
  /** demand/capacity; may exceed 1 when failing */
  util: number;
  status: CheckStatus;
  /** IS 456:2000 clause reference, e.g. "40.1, Table 20" */
  clause: string;
  reason: string;
  source: string;
  verified: boolean;
  /** concrete text of suggested remedy, usually produced by autofix ladder */
  fix?: {
    member: string;
    before: string;
    after: string;
    reason: string;
  };
}

export interface StructuralPanel {
  id: string;
  lx: number; // shorter span, metres
  ly: number; // longer span, metres
  /** true when ly/lx < 2 (ratio-1 rule, verified:false) */
  twoWay: boolean;
  thicknessMm: number;
  /** unfactored uniform load kN/m² on slab */
  q: {
    self: number;
    finish: number;
    partition: number;
    live: number;
  };
  factoredKMnM2: number;
  /** k>1: one-way, else two-way; number = ly/lx */
  aspectRatio: number;
}

export interface BeamPiece {
  beamId: string;
  /** which end the piece sits against */
  end: "start" | "end";
  kind: "triangle" | "trapezoid" | "uniform";
  /** unfactored piece load: kN and kN·m per floor */
  v: number;
  m: number;
  /** panel this piece came from */
  panelId: string;
}

export interface StructuralBeam {
  id: string;
  /** axis the beam runs along: "x" beams run horizontal (E–W), "y" beams run N–S */
  axis: "x" | "y";
  /** centre-to-centre span between columns at either end, metres */
  spanM: number;
  widthMm: number;
  depthMm: number;
  /** unfactored shear (kN) at start / end supports, per level */
  vStart: number;
  vEnd: number;
  /** unfactored maximum mid-span moment kN·m, per level */
  mMid: number;
  /** unfactored uniform line load contributions kN/m */
  udl: {
    slab: number; // triangular/trapezoid folded to an equivalent uniform value
    wall: number;
    selfWeight: number;
  };
  /** raw piece loads for the load-path diagram */
  pieces: BeamPiece[];
  /** factored end shears & moment */
  vuStart: number;
  vuEnd: number;
  mu: number;
  bars: { count: number; dia: number }; // tension bottom steel
  stirrups: { legs: 2; dia: number; spacingMm: number } | null;
  wallLoadKnm: number;
}

export interface StructuralColumn {
  id: string;
  /** grid-foot coordinates (ft, same convention as plan-view) */
  xFt: number;
  yFt: number;
  sizeMm: [number, number];
  bars: { count: number; dia: number };
  /** factored axial load including all levels + roof */
  pu: number;
  /** unfactored service load used for foundation sizing */
  service: number;
  /** number of structural levels this column carries */
  levels: number;
}

export interface StructuralPanelMember {
  id: string;
  member: StructuralPanel;
  checks: StructuralCheck[];
  status: CheckStatus;
}

export interface StructuralBeamMember {
  id: string;
  member: StructuralBeam;
  checks: StructuralCheck[];
  status: CheckStatus;
}

export interface StructuralColumnMember {
  id: string;
  member: StructuralColumn;
  checks: StructuralCheck[];
  status: CheckStatus;
}

export interface FootingEstimate {
  id: string;
  columnId: string;
  sizeM: number; // square side
  areaM2: number;
  /** service bearing pressure kN/m² */
  bearing: number;
  /** assumed, must be verified via soil test */
  sbcKPa: number;
}

export interface ForcedSpan {
  axis: "x" | "y";
  atFt: number;
  spanM: number;
  spanFt: number;
  exceeds45m: boolean;
  note: string;
}

export interface AutoFixLog {
  member: string;
  check: string;
  before: string;
  after: string;
  reason: string;
}

export interface StructuralSummary {
  total: number;
  pass: number;
  amber: number;
  fail: number;
}

export interface ResultColumn {
  id: string;
  xFt: number;
  yFt: number;
}

/** serializable plan-view data (no functions) for the 2D/3D overlays */
export interface ResultPlan {
  xLines: number[];
  yLines: number[];
  columns: ResultColumn[];
  panels: { id: string; i: number; j: number }[];
  beams: {
    id: string;
    axis: "x" | "y";
    lineIdx: number;
    segIdx: number;
    lineFt: number;
    startFt: number;
    endFt: number;
    spanFt: number;
  }[];
  levels: number;
}

export interface StructuralResult {
  ok: boolean;
  members: {
    panels: StructuralPanelMember[];
    beams: StructuralBeamMember[];
    columns: StructuralColumnMember[];
  };
  summary: StructuralSummary;
  /** summary before autofix was applied */
  initialSummary: StructuralSummary | null;
  /** per-member status before autofix (member id → status) */
  preFixStatus?: Record<string, CheckStatus>;
  autoFixLog: AutoFixLog[];
  loadPath: {
    columnId: string;
    slabs: string[];
    beams: string[];
    footing: string;
  }[];
  loadPathNote: string;
  plan: ResultPlan;
  forcedSpans: ForcedSpan[];
  seismic: {
    zone: string;
    label: string;
    note: string;
    verified: boolean;
    source: string;
  };
  foundation: {
    sbcKPa: number;
    footings: FootingEstimate[];
    note: string;
    verified: false;
  };
  assumptions: {
    id: string;
    label: string;
    value: string;
    source: string;
    verified: boolean;
  }[];
}

export interface StructuralGrid {
  xLines: number[]; // ft
  yLines: number[]; // ft
  columns: { id: string; xFt: number; yFt: number; k: number; p: number }[];
  panels: { id: string; i: number; j: number; rect: Rect }[];
  beamId: (axis: "x" | "y", k: number, j: number) => string;
  forcedSpans: ForcedSpan[];
}

export type StructuralOptions = {
  /** debug multiplier applied to live load for engine tests */
  overloadFactor?: number;
  /** overloadFactor apply only to this beam id (deterministic tests) */
  overloadBeamId?: string;
};

export type PlotShape = PlotInput;

export interface ColumnLoadAgg {
  xFt: number;
  yFt: number;
  /** factored axial Pu, kN */
  pu: number;
  /** unfactored service axial, kN (footing estimate) */
  service: number;
  levels: number;
  beams: { id: string; end: "start" | "end"; shear: number }[];
}
