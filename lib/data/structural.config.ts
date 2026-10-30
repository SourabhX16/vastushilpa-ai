import type { SeismicZone } from "@/lib/engine/types";

/**
 * Single source of truth for every structural design assumption.
 *
 * Each entry must state its IS 456:2000 / IS 875 source clause so the engine
 * can cite it in checks and reports. `verified` reflects how the clause was
 * obtained — only clauses read directly from the IS 456:2000 full text
 * (downloaded official PDF via law.resource.org) are marked verified: true.
 * Anything from practice/secondary memory is verified: false and the comment
 * states exactly what to check.
 */
export interface StructuralAssumption {
  id: string;
  label: string;
  value: string;
  source: string;
  verified: boolean;
}

export const STRUCTURAL_ASSUMPTIONS: StructuralAssumption[] = [
  {
    id: "grade",
    label: "Concrete grade",
    value: "M20",
    source: "IS 456:2000 cl. 6.1.2, Table 5",
    // VERIFIED CLAUSE TEXT: Table 5 gives min grades for reinforced concrete:
    // Mild exposure = M20, Moderate = M25, Severe = M30, Very severe = M35,
    // Extreme = M40. CONFLICT with our config: M20 + Moderate exposure is NOT
    // code-compliant — rc grade must be M25 for Moderate, or exposure must be
    // reclassified as Mild (see cover/* entries).
    verified: false,
  },
  {
    id: "steel-grade",
    label: "Reinforcement grade",
    value: "Fe500",
    source: "IS 456:2000 cl. 36.3 / 3.4 (design values)",
    // XXX NOTE: forces below computed with fy=500. If Fe415 is supplied the
    // beam flexural capacities differ modestly; column axial capacity uses
    // 0.67 fy — check final supply grade with the builder.
    verified: false,
  },
  {
    id: "exposure",
    label: "Exposure condition",
    value: "Moderate",
    source: "IS 456:2000 cl. 8.2.3",
    // cl. 8.2.3 defines classes by environment severity descriptions.
    // Check: whether Indian residential sheltered exposure qualifies Mild
    // (which would allow M20 + smaller covers per Table 16).
    verified: false,
  },
  {
    id: "cover-slab",
    label: "Slab nominal cover",
    value: "20 mm",
    source: "IS 456:2000 Table 16 (Mild = 20 mm)",
    // CONFLICT: Table 16 gives 30 mm for Moderate exposure. 20 mm assumed with
    // grade M20 only holds if exposure is Mild. Same conflict as `grade`.
    // If Moderate stands, use 30 mm. Check wording of cl. 8.2.3.
    verified: false,
  },
  {
    id: "cover-beam",
    label: "Beam nominal cover",
    value: "25 mm",
    source: "practice; not stated in IS 456:2000 as 'beam cover'",
    // Table 16 does not give member-wise covers, only exposure classes.
    // Beam cover universally taken ~50 mm minus stirrup allowance; 25 mm is a
    // pragmatic effective-depth assumption. Check: common practice tables and
    // IRC/SP documents; nominal cover per Table 16 by exposure is the binding
    // value (30 mm if Moderate).
    verified: false,
  },
  {
    id: "cover-column",
    label: "Column nominal cover",
    value: "40 mm",
    source: "IS 456:2000 cl. 26.4.2.1",
    // VERIFIED: 26.4.2.1 states 40 mm minimum for columns unless ≤200 mm
    // section with bars ≤12 mm (then 25 mm allowed).
    verified: true,
  },
  {
    id: "cover-footing",
    label: "Footing nominal cover",
    value: "50 mm",
    source: "IS 456:2000 cl. 26.4.2.2",
    // VERIFIED: 26.4.2.2 states minimum 50 mm for footings cast against earth.
    verified: true,
  },
  {
    id: "wall-density",
    label: "Brick masonry unit weight",
    value: "19 kN/m³",
    source: "IS 875 (Part 1):1987 Table 1 (~18.7–19.6)",
    // Check: exact upper/lower bound row for brick masonry in IS 875-1 Table 1.
    verified: false,
  },
  {
    id: "wall-outer",
    label: "Exterior wall thickness",
    value: "230 mm (9 brick)",
    source: "practice for load-bearing envelope",
    // Frame design; walls non-load-bearing. Check: local practice in project
    // city ( Ahmedabad/Bhopal etc. ) — 230 mm typical for exterior.
    verified: false,
  },
  {
    id: "wall-inner",
    label: "Interior wall thickness",
    value: "115 mm (4.5 brick)",
    source: "practice for partition walls",
    // Check: local practice; partitions sometimes 100 mm block.
    verified: false,
  },
  {
    id: "partition-allowance",
    label: "Partition load allowance",
    value: "1.0 kN/m² on slabs crossed by interior walls",
    source:
      "IS 875 (Part 2):1987 cl. 3.1.2 — not less than one-third the weight per metre run of finished partition, subject to minimum 1.0 kN/m²",
    // VERIFIED CLAUSE TEXT: 3.1.2 says uniformly distributed load per m² of
    // floor ≥ 1/3 × (partition weight per metre run), min 1.0 kN/m², valid
    // while partition weight ≤ 4 kN per metre length. For 115 mm brick
    // partitions (≈2.2 kN/m with 19 kN/m³) the min 1.0 kN/m² governs.
    verified: true,
  },
  {
    id: "ll-residential",
    label: "Floor live load (residential)",
    value: "2.0 kN/m²",
    source: "IS 875 (Part 2):1987 Table 1",
    // VERIFIED: Table 1 dwellings row: all rooms 2.0 kN/m² (staircases and
    // balconies 3.0 kN/m² noted separately in the report).
    verified: true,
  },
  {
    id: "ll-roof",
    label: "Roof live load (accessible)",
    value: "1.5 kN/m²",
    source: "IS 875 (Part 2):1987 Table 2",
    // VERIFIED: Table 2 roofs with access provided (residential terrace is
    // accessed by occupants): 1.5 kN/m².
    verified: true,
  },
  {
    id: "finish-load",
    label: "Floor finish",
    value: "1.0 kN/m²",
    source: "IS 875 (Part 2):1987 cl. 3.3 / practice",
    // cl. 3.3 references finishes; 1.0–1.5 kN/m² customary. Check: exact
    // recommended value in IS 875-2 clause 3.3 text.
    verified: false,
  },
  {
    id: "gamma-f",
    label: "Load factor (DL + LL)",
    value: "1.5",
    source: "IS 456:2000 cl. 36.4.1, Table 18",
    // VERIFIED: Table 18 shows γf = 1.5 for DL and LL together (DL+LL combo).
    verified: true,
  },
  {
    id: "sbc",
    label: "Soil bearing capacity",
    value: "150 kN/m² (ASSUMED)",
    source: "not sourced — soil investigation required",
    // NOT FROM CODE. Placeholder for bearing-capacity estimate only; the
    // foundation sizes engine outputs are indicative until a geotechnical
    // report or local soil data is supplied. MUST be replaced per site.
    verified: false,
  },
  {
    id: "storey-height",
    label: "Storey height",
    value: "3.0 m clear + slab",
    source: "assumption (residential typical)",
    // Drives wall loads and column slenderness/eccentricity. Check: project
    // brief or per-city bylaws for allowable height.
    verified: false,
  },
  {
    id: "seismic-city",
    label: "Seismic zone source",
    value: "per selected city",
    source: "lib/data/cities.ts (IS 1893-1:2016 Annex A mapping, unverified)",
    // Engine reads seismicZone from the selected city and emits advisory
    // notes. Zone affects only advisory framing (tie beams, bands).
    verified: false,
  },
];

/** Advisory note shown once zone is known (zone II–V). */
export function seismicNote(zone: SeismicZone | undefined): string | undefined {
  switch (zone) {
    case "II":
      return "Seismic Zone II (lowest hazard in India): provide seismic layout care per IS 1893-1 — plinth tie beam recommended, ductile detailing per IS 13920 in columns (practice).";
    case "III":
      return "Seismic Zone III (moderate): plinth tie beam strongly recommended, column ties tightened near supports, masonry lintel bands per IS 4326 (practice).";
    case "IV":
      return "Seismic Zone IV (high): braced/ductile detailing recommended; load-path asymmetry (re improvised Bhramasthan opening) to be reviewed by engineer (practice).";
    case "V":
      return "Seismic Zone V (highest): this preliminary design is NOT adequate alone — foundation and lateral system require full design by a structural engineer per IS 1893-1 (practice).";
    default:
      return undefined;
  }
}
