import { COLUMN_SIZE_LADDER_MM } from "./constants";

/** Per-member size bookkeeping shared between loads, checks and autofix. */
export interface SizesState {
  slabThk: Map<string, number>;
  beamDepth: Map<string, number>;
  columnSize: Map<string, [number, number]>;
  /** min-steel bar growth shim (overrides the automatic pick) */
  beamBarOverride: Map<string, { count: number; dia: number }>;
}

export function nextColumnSize(cur: [number, number]): [number, number] {
  for (const size of COLUMN_SIZE_LADDER_MM) {
    if (size[0] > cur[0] || size[1] > cur[1]) return size;
  }
  return cur;
}
