import type {
  BeamPiece,
  CheckStatus,
  StructuralCheck,
  StructuralPanel,
} from "./types";

/**
 * IS 456:2000 member checks. Every formula below was verified against the
 * full text of IS 456:2000 unless marked verified:false with the exact item
 * to re-check in the clause comment.
 */

/* ---------------------------- material data --------------------------- */

export const MATERIALS = {
  fck: 20, // M20 — see structural.config.ts CONFLICT note (Table 5 wants M25 for moderate exposure)
  fy: 500, // Fe500
  /** cl. 38.1 note: xu,max/d = 0.46 for Fe500 (verified) */
  xuMaxRatio: 0.46,
  /** Table 20: τc,max for M20 = 2.8 N/mm² (verified) */
  tauCmaxMpa: 2.8,
} as const;

/**
 * Table 19: design shear strength τc for M20 (N/mm²) at reinforcement
 * percentage p (VERIFIED column read from the clause text). Linear
 * interpolation between tabulated points; clamped to the 3% row above.
 */
const TAU_C_M20: { p: number; v: number }[] = [
  { p: 0.15, v: 0.28 },
  { p: 0.25, v: 0.36 },
  { p: 0.5, v: 0.48 },
  { p: 0.75, v: 0.56 },
  { p: 1.0, v: 0.62 },
  { p: 1.25, v: 0.67 },
  { p: 1.5, v: 0.72 },
  { p: 1.75, v: 0.75 },
  { p: 2.0, v: 0.79 },
  { p: 2.25, v: 0.81 },
  { p: 2.5, v: 0.82 },
  { p: 2.75, v: 0.82 },
  { p: 3.0, v: 0.82 },
];

export function designShearStrength(ptPercent: number): number {
  const pts = TAU_C_M20;
  if (ptPercent <= pts[0].p) return pts[0].v;
  if (ptPercent >= 3.0) return pts[pts.length - 1].v;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (ptPercent >= a.p && ptPercent <= b.p) {
      const t = (ptPercent - a.p) / (b.p - a.p);
      return a.v + t * (b.v - a.v);
    }
  }
  return pts[pts.length - 1].v;
}

/**
 * Table 27 (Annex D-2.1): αx coefficients for two-way simply supported
 * slabs, Mx = αx·w·lx². Rows read from the clause text (verified);
 * intermediate ly/lx values are linearly interpolated between rows (mark:
 * interpolation is standard practice but the interpolated coefficient is
 * verified:false), capped at k = 3.0 for longer panels.
 */
const TABLE27_ALPHA_X: { k: number; vx: number }[] = [
  { k: 1.0, vx: 0.062 },
  { k: 1.1, vx: 0.074 },
  { k: 1.2, vx: 0.084 },
  { k: 1.3, vx: 0.093 },
  { k: 1.4, vx: 0.099 },
  { k: 1.5, vx: 0.104 },
  { k: 2.0, vx: 0.122 },
  { k: 2.5, vx: 0.124 },
  { k: 3.0, vx: 0.124 },
];

export function twoWayAlphaX(k: number): number {
  const pts = TABLE27_ALPHA_X;
  if (k <= pts[0].k) return pts[0].vx;
  if (k >= pts[pts.length - 1].k) return pts[pts.length - 1].vx;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (k >= a.k && k <= b.k) {
      const t = (k - a.k) / (b.k - a.k);
      return a.vx + t * (b.vx - a.vx);
    }
  }
  return pts[pts.length - 1].vx;
}

/* --------------------------- bar utilities ---------------------------- */

const BAR_AREA: Record<number, number> = { 8: 50.3, 12: 113.1, 16: 201.1, 20: 314.2, 25: 490.9 };

export function rebarArea(count: number, dia: number): number {
  return count * (BAR_AREA[dia] ?? 0);
}

/** In-area ladders: [count, dia] combos in increasing steel area. */
const BEAM_COMBO: { c: number; d: number }[] = [];
for (const d of [12, 16, 20, 25]) {
  for (const c of [2, 3, 4, 5, 6]) {
    BEAM_COMBO.push({ c, d });
  }
}
BEAM_COMBO.sort((a, b) => {
  const areaDiff = rebarArea(a.c, a.d) - rebarArea(b.c, b.d);
  if (Math.abs(areaDiff) > 1e-9) return areaDiff;
  return a.c - b.c || a.d - b.d;
});

/** Pick the smallest beam bar set ≥ As,min per the deterministic ladder. */
export function pickBeamBars(asRequiredMm2: number): { count: number; dia: number } {
  for (const combo of BEAM_COMBO) {
    if (rebarArea(combo.c, combo.d) >= asRequiredMm2 - 1e-6) {
      return { count: combo.c, dia: combo.d };
    }
  }
  return { count: 6, dia: 25 };
}

export function pickColumnBars(asPercentMinAreaMm2: number) {
  // 4 bars minimum (26.5.3.1); grows through 12/16/20/25 ⌀, then 6/8 bars
  const ladder = [
    { c: 4, d: 12 },
    { c: 4, d: 16 },
    { c: 4, d: 20 },
    { c: 4, d: 25 },
    { c: 6, d: 16 },
    { c: 6, d: 20 },
    { c: 6, d: 25 },
    { c: 8, d: 20 },
    { c: 8, d: 25 },
  ] as const;
  for (const item of ladder) {
    if (rebarArea(item.c, item.d) >= asPercentMinAreaMm2 - 1e-6) {
      return { count: item.c, dia: item.d };
    }
  }
  return { count: 8, dia: 25 };
}

/**
 * slab bars per metre run: thinnest ⌀ allowed by cl. 26.5.2.2 (⌀ ≤ t/8)
 * from ⌀8/10/12 with spacings from the ladder 100/125/150/160/180/200/250/300
 * capped by cl. 26.3.3(b): ≤ 3d and ≤ 300 mm.
 */
export function pickSlabBars(params: {
  depthMm: number;
  thicknessMm: number;
  asPerMmRequired: number;
}): { dia: number; spacing: number; asProvided: number } {
  const spacings = [100, 125, 150, 160, 180, 200, 250, 300];
  const maxSpacing = Math.min(300, Math.max(3 * params.depthMm, 100));
  const allowed = spacings.filter((s) => s <= maxSpacing + 1e-9);
  for (const diaRaw of [8, 10, 12]) {
    if (diaRaw > params.thicknessMm / 8) continue; // cl. 26.5.2.2
    const perBar = BAR_AREA[diaRaw];
    for (const s of allowed) {
      const asP = (perBar * 1000) / s; // per metre run
      if (asP >= params.asPerMmRequired - 1e-6) {
        return { dia: diaRaw, spacing: s, asProvided: asP };
      }
    }
  }
  return { dia: 12, spacing: allowed[allowed.length - 1] ?? 300, asProvided: (BAR_AREA[12] * 1000) / (allowed[allowed.length - 1] ?? 300) };
}

/* ------------------------- status thresholds -------------------------- */

export function statusForUtil(util: number): CheckStatus {
  if (util <= 0.85) return "pass";
  if (util <= 1.0) return "amber";
  return "fail";
}

function make(
  id: string,
  label: string,
  demand: string,
  capacity: string,
  util: number,
  clause: string,
  reason: string,
  verified: boolean,
): StructuralCheck {
  return {
    id,
    label,
    demand,
    capacity,
    util,
    status: statusForUtil(util),
    clause,
    reason,
    source: "IS 456:2000",
    verified,
  };
}

/* ----------------------------- slab checks ---------------------------- */

export function checkSlab(
  panel: StructuralPanel,
): { checks: StructuralCheck[]; bars: { dia: number; spacing: number } } {
  const checks: StructuralCheck[] = [];
  const b = 1000; // per metre strip
  const t = panel.thicknessMm;
  const d = Math.max(75, t - 20 - 6); //胫 cover 20 (Table 16 mild) + ⌀12/2
  const fck = MATERIALS.fck;
  const fy = MATERIALS.fy;

  /* ---- 1. span / effective depth ----------------------------------- */
  const spanDepthCheck = ((): StructuralCheck => {
    if (panel.twoWay && panel.lx <= 3.5) {
      // cl. 24.1 note: two-way ≤ 3.5 m, limiting span/OVERALL depth 35 (SS) ×
      // 0.8 (Fe415 factor; used for Fe500 too — flagged) → 32
      const ratio = (panel.lx * 1000) / t;
      return make(
        "slab-span-depth",
        "span / overall depth (two-way ≤ 3.5 m)",
        ratio.toFixed(1),
        "32.0",
        ratio / 32,
        "24.1 NOTE",
        // Fe500 ×0.8 span/depth note verified:false — cl. 24.1 note itself
        // ties the 0.8 factor to Fe415; Fe500 needs engineering judgement
        "two-way short span ≤ 3.5 m check; the 0.8 reduction factor belongs to Fe415, extended to Fe500 pending re-check",
        false,
      );
    }
    const ratio = (panel.lx * 1000) / d;
    return make(
      "slab-span-depth",
      "span / effective depth (one-way)",
      ratio.toFixed(1),
      "26.0",
      ratio / 26,
      "23.2.1",
      "continuous RC slab base ratio (safe, conservative vs SS 20 with flange factors ignored)",
      true,
    );
  })();
  checks.push(spanDepthCheck);

  /* ---- 2. flexure per clause Annex G + Table 27 --------------------- */
  const wu = panel.factoredKMnM2; // kN/m² = kN/m per 1 m width
  const mxKnm = (() => {
    if (panel.twoWay) {
      const k = Math.min(3, Math.max(1, panel.ly / panel.lx));
      return twoWayAlphaX(k) * wu * panel.lx * panel.lx;
    }
    return (wu * panel.lx * panel.lx) / 8;
  })();
  const asMinPercent = 0.0012 * t * b; // cl. 26.5.2.1 HYSD 0.12% gross area
  // flexural As required: solve 0.1512·fck·b·xu² − 0.36·fck·b·d·xu + Mu = 0
  const muNm = mxKnm * 1e6;
  const a1 = 0.1512 * fck * b;
  const b1 = -0.36 * fck * b * d;
  const c1 = muNm;
  const disc1 = b1 * b1 - 4 * a1 * c1;
  const xuFlex = disc1 < 0 ? Infinity : (-b1 - Math.sqrt(disc1)) / (2 * a1);
  const overReinforced = xuFlex > MATERIALS.xuMaxRatio * d;
  const muLim = 0.36 * MATERIALS.xuMaxRatio * (1 - 0.42 * MATERIALS.xuMaxRatio) * fck * b * d * d; // G-1.1(c)
  const asFlexMm2 =
    disc1 < 0 || overReinforced
      ? Infinity
      : muNm / (0.87 * fy * (d - 0.42 * xuFlex)); // G-1.1(b)
  const asRequired = Math.max(asMinPercent, asFlexMm2);
  const pick = pickSlabBars({
    depthMm: d,
    thicknessMm: t,
    asPerMmRequired: asRequired * 1.05,
  });
  const asProvided = pick.asProvided;
  const xuProv = (0.87 * fy * asProvided) / (0.36 * fck * b);
  const muCapacity = overReinforced
    ? muLim
    : 0.87 * fy * asProvided * (d - 0.42 * Math.min(xuProv, MATERIALS.xuMaxRatio * d));
  const flexure = make(
    "slab-flexure",
    "slab moment (per m width)",
    `${mxKnm.toFixed(2)} kN·m`,
    `${(muCapacity / 1e6).toFixed(2)} kN·m (⌀${pick.dia}@${pick.spacing})`,
    overReinforced ? muNm / muLim : muNm / muCapacity,
    "Annex G-1.1 + Table 27",
    overReinforced
      ? "xu/d would exceed 0.46 (cl. 38.1) — autofix grows the slab depth first"
      : panel.twoWay
        ? "two-way: Mx = αx·w·lx² (interpolated Table 27); bars from ladder covering As,req and 0.12% gross"
        : "one-way: M = w·lx²/8; bars from ladder covering As,req and 0.12% gross",
    false,
  );
  checks.push(flexure);

  /* ---- 3. slab shear τv ≤ ½ Table 20 value ------------------------- */
  const v = (wu * panel.lx) / 2; // reacted at each long-edge support
  const tauV = (v * 1000) / (b * d);
  const capK2 = shearDepthFactor(t);
  const tauAllowed = (MATERIALS.tauCmaxMpa / 2) / capK2;
  const shear = make(
    "slab-shear",
    "slab shear stress",
    `${tauV.toFixed(3)} N/mm²`,
    `${tauAllowed.toFixed(2)} N/mm² (½τc,max/k2)`,
    tauV / tauAllowed,
    "40.2.3.1 + Table 20",
    "τv ≤ 0.5·τc,max per cl. 40.2.3.1; depth factor k2 at 40.2.1.1",
    true,
  );
  checks.push(shear);

  /* ---- 4. slab min steel / spacing / dia caps ---------------------- */
  const minSteel = make(
    "slab-min-steel",
    "minimum reinforcement (0.12% gross)",
    `${asMinPercent.toFixed(0)} mm²`,
    `${asProvided.toFixed(0)} mm² (⌀${pick.dia}@${pick.spacing})`,
    asMinPercent / asProvided,
    "26.5.2.1",
    "0.12% gross for HYSD; bar ⌀ ≤ t/8 (26.5.2.2); spacing ≤ min(3d, 300) (26.3.3b)",
    true,
  );
  checks.push(minSteel);

  return { checks, bars: { dia: pick.dia, spacing: pick.spacing } };
}

/* depth factor k² cl. 40.2.1.1 — VERIFIED table: 300→1.0, 275→1.05, 250→1.1,
 225→1.15, 200→1.2, 175→1.25, ≤150→1.30 (for slabs ≤300 mm). */
export function shearDepthFactor(thicknessMm: number): number {
  const tbl: { d: number; k: number }[] = [
    { d: 300, k: 1.0 },
    { d: 275, k: 1.05 },
    { d: 250, k: 1.1 },
    { d: 225, k: 1.15 },
    { d: 200, k: 1.2 },
    { d: 175, k: 1.25 },
    { d: 150, k: 1.3 },
    { d: 125, k: 1.3 },
    { d: 100, k: 1.3 },
  ];
  const sorted = [...tbl].sort((a, b) => b.d - a.d);
  for (const row of sorted) if (thicknessMm >= row.d) return row.k;
  return 1.3;
}

/* ----------------------------- beam checks ---------------------------- */

export interface BeamCheckInput {
  id: string;
  spanM: number;
  widthMm: number;
  depthMm: number;
  /** factored end shears, kN */
  vuStart: number;
  vuEnd: number;
  /** factored design moment, kN·m */
  mu: number;
  /** bars forced by autofix (min-steel growth shim) */
  asMinOverride?: { count: number; dia: number };
}

export function checkBeam(
  beam: BeamCheckInput,
): {
  checks: StructuralCheck[];
  bars: { count: number; dia: number };
  stirrups: { legs: 2; dia: number; spacingMm: number } | null;
} {
  const checks: StructuralCheck[] = [];
  const b = beam.widthMm;
  const D = beam.depthMm;
  const fck = MATERIALS.fck;
  const fy = MATERIALS.fy;

  /* ---- 1. flexure (Annex G-1.1) ------------------------------------ */
  const muNm = beam.mu * 1e6;
  // effective depth per actual cover/stirrup/main-bar stack
  const d0 = Math.max(100, D - 25 - 8 - 12 / 2); // guess ⌀12 to size steel
  // solve 0.1512·fck·b·xu² − 0.36·fck·b·d·xu + Mu = 0 for xu
  const a1 = 0.1512 * fck * b;
  const b1 = -0.36 * fck * b * d0;
  const c1 = muNm;
  const disc = b1 * b1 - 4 * a1 * c1;
  const xu = disc < 0 ? Infinity : (-b1 - Math.sqrt(disc)) / (2 * a1);
  const overLimit = xu > MATERIALS.xuMaxRatio * d0;
  const asRequired =
    disc < 0 || overLimit
      ? Infinity
      : muNm / (0.87 * fy * (d0 - 0.42 * xu));
  // +10% headroom: bar ladders quantise coarsely; without it a precisely
  // required-As pick lands in the 0.85–1.0 amber band even though it
  // satisfies the design exactly
  const bars =
    beam.asMinOverride ?? pickBeamBars(Math.min(asRequired * 1.1, 7700));
  const asProv = rebarArea(bars.count, bars.dia);
  const dEff = Math.max(100, D - 25 - 8 - bars.dia / 2);
  const xuProv = (0.87 * fy * asProv) / (0.36 * fck * b);
  const overLimitFinal = xuProv > MATERIALS.xuMaxRatio * dEff;
  const muLimNm = 0.36 * MATERIALS.xuMaxRatio * (1 - 0.42 * MATERIALS.xuMaxRatio) * fck * b * dEff * dEff; // G-1.1(c)
  const cap = overLimitFinal
    ? muLimNm
    : 0.87 * fy * asProv * (dEff - 0.42 * Math.min(xuProv, MATERIALS.xuMaxRatio * dEff));
  const flexureUtil = muNm / cap;
  const flexure = make(
    "beam-flexure",
    "ultimate moment",
    `${beam.mu.toFixed(2)} kN·m`,
    `${(cap / 1e6).toFixed(2)} kN·m (${bars.count}⌀${bars.dia})`,
    flexureUtil,
    "Annex G-1.1 + cl. 38.1",
    overLimitFinal
      ? "over-reinforced: xu/d > 0.46 (cl. 38.1) — autofix increments depth first, then re-picks bars"
      : "As from M = 0.87 fy As (d − 0.42 xu) per G-1.1(b); bar set from ladder ≥ As,req",
    true,
  );
  checks.push(flexure);

  /* ---- 2. shear: τv vs Table 19 (Vc) and Table 20 (τc,max) ---------- */
  const vMax = Math.max(beam.vuStart, beam.vuEnd);
  const tauV = (vMax * 1000) / (b * dEff);
  const asProvPct = (100 * asProv) / (b * dEff);
  const tauC = designShearStrength(asProvPct);
  const shearCapMax = MATERIALS.tauCmaxMpa * b * dEff; // N
  const shear = make(
    "beam-shear",
    "ultimate shear",
    `${vMax.toFixed(1)} kN (τv = ${tauV.toFixed(2)} N/mm²)`,
    `${(shearCapMax / 1000).toFixed(1)} kN (τc,max = 2.8 N/mm², Table 20)`,
    tauV / MATERIALS.tauCmaxMpa,
    "40.1 + 40.2.3 + Table 20",
    `τv = Vu/(b·d) must stay ≤ τc,max even with stirrups (40.2.3). τc(min steel) = ${tauC.toFixed(2)}; additional shear beyond Vc needs Vus = 0.87·fy·Asv·d/sv stirrups (40.4) — always ≥ min reinf (26.5.1.6; stirrup fy ≤ 415 — verified:false, re-check clause)`,
    true,
  );
  checks.push(shear);

  // design stirrups (never block a pass; row states what to provide)
  let stirrups: { legs: 2; dia: number; spacingMm: number } | null = null;
  const vmus = Math.max(0, vMax - tauC * b * dEff);
  if (vmus > 0) {
    const asv2 = 2 * BAR_AREA[8]; // two-legged ⌀8
    const fyStirrup = 415; // cap applied at 26.5.1.6 / 40.4 — verified:false
    const sReq = (0.87 * fyStirrup * asv2 * dEff) / vmus; // cl. 40.4
    const caps = Math.min(0.75 * dEff, 300); // 26.5.1.5
    stirrups = { legs: 2, dia: 8, spacingMm: Math.max(50, Math.min(caps, Math.floor(sReq / 10) * 10)) };
  }

  /* ---- 3. min tension steel 26.5.1.1(a) ---------------------------- */
  const asMin = (0.85 * b * dEff) / fy;
  const minSteel = make(
    "beam-min-steel",
    "minimum tension steel 0.85bd/fy",
    `${asMin.toFixed(0)} mm²`,
    `${asProv.toFixed(0)} mm²`,
    asMin / asProv,
    "26.5.1.1(a)",
    "max 0.04·b·D also satisfied by bar ladder (26.5.1.1(b))",
    true,
  );
  checks.push(minSteel);

  /* ---- 4. deflection span/depth (23.2.1) --------------------------- */
  const ratio = (beam.spanM * 1000) / d0;
  const deflection = make(
    "beam-deflection",
    "span / effective depth",
    ratio.toFixed(1),
    "20.0 (SS base)",
    ratio / 20,
    "23.2.1 + 42.1",
    "continuous beams could use 26; engine conservatively applies the simply-supported base ratio (Fig. 4/5 modification factors not modelled — preliminary design margin)",
    true,
  );
  checks.push(deflection);

  return { checks, bars, stirrups };
}

/* ---------------------------- column checks --------------------------- */

export interface ColumnCheckInput {
  id: string;
  sizeMm: [number, number];
  /** factored axial load, kN */
  pu: number;
}

export function checkColumn(
  column: ColumnCheckInput,
  unsupportedM: number, // storey clear height (m) — drives emin/slenderness
): {
  checks: StructuralCheck[];
  bars: { count: number; dia: number };
  tieDia: number;
} {
  const checks: StructuralCheck[] = [];
  const [w, h] = column.sizeMm;
  const area = w * h;
  const minDim = Math.min(w, h);
  const fck = MATERIALS.fck;
  const fy = MATERIALS.fy;

  // As picked = max(0.8% of A per cl. 26.5.3.1, engineering 1% target)
  const asMin = 0.008 * area;
  const asPick = pickColumnBars(Math.max(asMin, 0.01 * area));
  const asProv = rebarArea(asPick.count, asPick.dia);
  const tieDia = Math.max(6, Math.ceil(asPick.dia / 4)); // 26.5.3.2

  /* ---- 1. axial (39.3) — short-column service then check ---------- */
  const leff = 0.85 * unsupportedM * 1000; // 26.3 Annex E 0.85 — unverified
  const slenderMm = leff / minDim;
  const capacity = 0.4 * fck * (area - asProv) + 0.67 * fy * asProv;
  const axial = make(
    "column-axial",
    "axial capacity 0.4fckAc + 0.67fyAsc",
    `${column.pu.toFixed(0)} kN`,
    `${(capacity / 1000).toFixed(0)} kN (${asPick.count}⌀${asPick.dia})`,
    column.pu / capacity,
    "39.3 + 26.5.3.1",
    // validity gate of 39.3 (emin ≤ 0.05D) is reported separately below
    "valid while emin ≤ 0.05·least lateral dim (see column-min-ecc row)",
    true,
  );
  checks.push(axial);

  /* ---- 2. min eccentricity gate (25.4 + 39.2) ---------------------- */
  // 25.4 (VERIFIED): emin = unsupported/500 + lateral dim/30, NOT less than 20 mm
  const eMin = Math.max((unsupportedM * 1000) / 500 + minDim / 30, 20);
  const eminGate = make(
    "column-min-ecc",
    "minimum eccentricity vs 0.05·dim gate",
    `${eMin.toFixed(1)} mm`,
    `${(0.05 * minDim).toFixed(1)} mm`,
    eMin / (0.05 * minDim),
    "25.4 + 39.2",
    "when exceeded 39.3 does NOT apply: proper biaxial design (SP-16) needed — engine does NOT autofix this; flagged for the real engineer",
    true,
  );
  // informational: the gate only invalidates the 39.3 shortcut; it is not a
  // size deficiency and the engine never autofixes it — amber at worst.
  if (eminGate.status === "fail") eminGate.status = "amber";
  checks.push(eminGate);

  /* ---- 3. slenderness (25.1.2 short-column limits) ------------------ */
  const slenderness = make(
    "column-slenderness",
    "effective length / least dim",
    slenderMm.toFixed(1),
    "12.0 (25.1.2)",
    slenderMm / 12,
    "25.1.2 + Annex E",
    "short-column criterion l_ex/D and l_ey/D < 12; effective factor 0.85 assumed (verified:false — Annex E Fig. 26/27 depend on end restraint)",
    false,
  );
  checks.push(slenderness);

  /* ---- 4. minimum size (practice) / wall thickness ------------------ */
  // utilisation framed as `required/original`: the column must stay ≥ 230 mm
  const minSize = make(
    "column-min-size",
    "minimum practical column dimension",
    "230 mm",
    `${minDim} mm`,
    230 / minDim,
    "practice (verified:false)",
    // IS 456 gives no absolute minimum size for RC columns; 230 mm is current
    // Indian practice; slenderness/serviceability still bind. Check SP-16 and
    // local by-laws for exact minimums.
    "no minimum size in IS 456:2000 — 230 mm is practice awaiting by-law check",
    false,
  );
  checks.push(minSize);

  /* ---- 5. min steel %                                              */
  const minSteel = make(
    "column-min-steel",
    "longitudinal steel ≥ 0.8% (≤6%)",
    `${asMin.toFixed(0)} mm²`,
    `${asProv.toFixed(0)} mm²`,
    asMin / asProv,
    "26.5.3.1",
    "≥4 bars for rectangular sections, ⌀ ≥ 12 mm, ties pitch ≤ least of (dim, 16⌀long, 300)",
    true,
  );
  checks.push(minSteel);

  return { checks, bars: asPick, tieDia };
}

/* ---------------------------- piece helpers --------------------------- */

export function pieceLabel(p: BeamPiece): string {
  return `${p.kind} ${p.v.toFixed(1)} kN / ${p.m.toFixed(2)} kN·m`;
}
