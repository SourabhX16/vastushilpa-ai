/** Concrete structural constants — all verified:false unless noted. */

/** Practical column size ladder (mm×mm) — growing steps for autofix. */
export const COLUMN_SIZE_LADDER_MM: [number, number][] = [
  [230, 230],
  [300, 300],
  [350, 350],
  [450, 450],
];

/** Beam width kept constant (matches the 9" wall band). */
export const BEAM_WIDTH_MM = 230;

/** Slab depth increments (mm) for autofix. */
export const SLAB_THK_STEP_MM = 5;
export const SLAB_THK_MAX_MM = 350;

/** Beam depth increments (mm) for autofix. */
export const BEAM_DEPTH_STEP_MM = 25;
export const BEAM_DEPTH_MAX_MM = 900;

/** Rebar bar diameter options for columns (main bars). */
export const COLUMN_BAR_LADDER: { count: number; dia: number }[] = [
  { count: 4, dia: 12 },
  { count: 4, dia: 16 },
  { count: 4, dia: 20 },
  { count: 4, dia: 25 },
  { count: 6, dia: 16 },
  { count: 6, dia: 20 },
  { count: 6, dia: 25 },
  { count: 8, dia: 20 },
  { count: 8, dia: 25 },
];
