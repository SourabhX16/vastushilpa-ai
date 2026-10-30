import type {
  AyadiConstants,
  AyadiDerivedCheck,
  AyadiFormulaConfig,
} from "../engine/types";

/**
 * AYADI FORMULA CONFIG — DATA, NOT PROCEDURE.
 *
 * STATUS: EVERY ENTRY IS verified: false.
 * These formulas were transcribed from memory of secondary sources
 * (vastu calculators, consultant blogs and summaries that *cite*
 * Manasara / Mayamata / Manushyalaya Chandrika / Sthapati tradition).
 * They have NOT been checked against the primary texts. Do not present
 * them as authentic traditional data; the engine marks them unverified.
 *
 * WHERE TO VERIFY (primary/authoritative):
 * - Manasara (P.K. Acharya's "Architecture of Manasara", the Ayadi chapter)
 * - Mayamata (Bruno Dagens translation, the site-measurement chapters)
 * - Manushyalaya Chandrika (Kerala tradition; chain of Ayam/Yoni/Nakshatra/
 *   Vara/Tithi in a DIFFERENT form than the one encoded here)
 * - Samarangana Sutradhara (alternative multipliers reported)
 *
 * KNOWN VARIATION POINTS (also recorded per-entry in `variants`):
 * - The unit system: hasta vs angula, and the hasta's physical length
 *   (45.7-52.4 cm historically; 18 in / 45.72 cm is a modern convention).
 * - Whether formulas use (L*B) jointly, or a single "sutra" measure.
 * - Whether the remainder is reduced once (mod divisor) and then again
 *   (mod class count) — as encoded here — or differently.
 * - The auspicious-set assignment per class (some sources flip parity
 *   for Vyaya; the encoding below uses the "same auspicious set for
 *   Aaya and Vyaya, income must exceed expenditure" rule instead).
 * - Vara/Nakshatra/Tithi: often a reduction CHAIN from the Aaya/Yoni
 *   remainders; several incompatible instructions circulate.
 *
 * CLASS-NAME LIST used for the 8-fold tables (Aaya/Vyaya/Yoni):
 * Dhwaja, Dhuma, Simha, Shwan, Vrisha, Khara, Gaja, Kaka.
 * This iconic list is wide-spread for Yoni; whether it applies to
 * Aaya/Vyaya tables unchanged is exactly the kind of thing to verify.
 */

const TODO_SOURCE = "TODO: cite Manasara / Mayamata / relevant text";

export const AYADI_CONSTANTS: AyadiConstants = {
  /** 1 hasta = 18 in = 45.72 cm — modern convention; historically variable. */
  hastaFeet: 1.5,
  hastaMeters: 0.4572,
  source:
    "TODO: verify hasta length (varies by text and era; 45.72 cm is the common modern convention)",
  verified: false,
};

/**
 * Result tables. Index semantics (ENCODING CONVENTION, see top comment):
 * row index i corresponds to remainder r = (product * multiplier) % divisor
 * reduced again mod 8 (or 27/30) — so r=0 maps to row 0 (Dhwaja / Ashwini).
 * Some sources treat a 0 remainder differently; flagged in `variants`.
 */
export const AYADI_CONFIG: AyadiFormulaConfig[] = [
  {
    key: "aaya",
    name: "Aaya (आय)",
    nameEn: "Income",
    formulaText:
      "Aaya = (lengthHasta x widthHasta x 8) mod 12, reduced again mod 8 to index the 8-fold table",
    multiplier: 8,
    divisor: 12,
    classCount: 8,
    resultTable: [
      { label: "Dhwaja", meaning: "Flag — auspicious (verify meaning)", auspicious: true },
      { label: "Dhuma", meaning: "Smoke — (verify meaning)", auspicious: false },
      { label: "Simha", meaning: "Lion — auspicious (verify meaning)", auspicious: true },
      { label: "Shwan", meaning: "Dog — (verify meaning)", auspicious: false },
      { label: "Vrisha", meaning: "Bull — auspicious (verify meaning)", auspicious: true },
      { label: "Khara", meaning: "Donkey — (verify meaning)", auspicious: false },
      { label: "Gaja", meaning: "Elephant — auspicious (verify meaning)", auspicious: true },
      { label: "Kaka", meaning: "Crow — (verify meaning)", auspicious: false },
    ],
    evaluates: true,
    variants:
      "Most secondary sources: Aaya = (L x B x 8)/12 matched to an 8-class table. Implementations differ on whether the remainder (mod 12) is reduced again mod 8 (as this config encodes) or the quotient/other quantity is used. Some texts compute Aaya from a single directional measure, not the area.",
    source: TODO_SOURCE,
    verified: false,
  },
  {
    key: "vyaya",
    name: "Vyaya (व्यय)",
    nameEn: "Expenditure",
    formulaText:
      "Vyaya = (lengthHasta x widthHasta x 1) mod 12, reduced again mod 8 to index the 8-fold table",
    multiplier: 1,
    divisor: 12,
    classCount: 8,
    resultTable: [
      { label: "Dhwaja", meaning: "Flag — auspicious (verify meaning)", auspicious: true },
      { label: "Dhuma", meaning: "Smoke — (verify meaning)", auspicious: false },
      { label: "Simha", meaning: "Lion — auspicious (verify meaning)", auspicious: true },
      { label: "Shwan", meaning: "Dog — (verify meaning)", auspicious: false },
      { label: "Vrisha", meaning: "Bull — auspicious (verify meaning)", auspicious: true },
      { label: "Khara", meaning: "Donkey — (verify meaning)", auspicious: false },
      { label: "Gaja", meaning: "Elephant — auspicious (verify meaning)", auspicious: true },
      { label: "Kaka", meaning: "Crow — (verify meaning)", auspicious: false },
    ],
    evaluates: true,
    variants:
      "Encoded as the simplest secondary form: Vyaya = (L x B)/12 with the SAME auspicious classes as Aaya, plus the derived rule 'Aaya >= Vyaya'. Other sources give multipliers other than 1, or flip the auspicious parity for Vyaya (even classes good), or derive Vyaya from Aaya's remainder directly. The parity-flipped variant CANNOT co-exist with the Aaya x 8/12 encoding above (the classes make a pass impossible), so it is recorded here as a variant to verify, not encoded.",
    source: TODO_SOURCE,
    verified: false,
  },
  {
    key: "yoni",
    name: "Yoni (योनि)",
    nameEn: "Site demigod / sign",
    formulaText:
      "Yoni = (lengthHasta x widthHasta x 9) mod 12, reduced again mod 8 to index the 8-fold table",
    multiplier: 9,
    divisor: 12,
    classCount: 8,
    resultTable: [
      { label: "Dhwaja (flag)", meaning: "Auspicious yoni (widely repeated list)", auspicious: true },
      { label: "Dhuma (smoke)", meaning: "Inauspicious yoni (verify)", auspicious: false },
      { label: "Simha (lion)", meaning: "Auspicious yoni (widely repeated list)", auspicious: true },
      { label: "Shwan (dog)", meaning: "Inauspicious yoni (verify)", auspicious: false },
      { label: "Vrisha (bull)", meaning: "Auspicious yoni (widely repeated list)", auspicious: true },
      { label: "Khara (donkey)", meaning: "Inauspicious yoni (verify)", auspicious: false },
      { label: "Gaja (elephant)", meaning: "Auspicious yoni (widely repeated list)", auspicious: true },
      { label: "Kaka (crow)", meaning: "Inauspicious yoni (verify)", auspicious: false },
    ],
    evaluates: true,
    variants:
      "The 8 yoni names (Dhwaja, Dhuma, Simha, Shwan, Vrisha, Khara, Gaja, Kaka) are the widely repeated list; the auspicious set Dhwaja/Simha/Vrisha/Gaja is also wide-spread. The formula (L x B x 9)/12 is the commonly circulated secondary form; other sources use different multipliers or compute Yoni from a reduced remainders chain. Additionally, many sources require the yoni to relate to the plot's facing direction — that geometric rule is NOT encoded here (to be added with facing-aware rules later).",
    source: TODO_SOURCE,
    verified: false,
  },
  {
    key: "nakshatra",
    name: "Nakshatra (नक्षत्र)",
    nameEn: "Birth star of the dwelling",
    formulaText:
      "Nakshatra = (lengthHasta x widthHasta x 8) mod 27, indexing the 27 stars",
    multiplier: 8,
    divisor: 27,
    classCount: 27,
    resultTable: [
      { label: "Ashwini", meaning: "Match with householder's Janma Nakshatra (matching logic not digitized - TODO)", auspicious: false },
      { label: "Bharani", meaning: "Match with householder's Janma Nakshatra (not digitized)", auspicious: false },
      { label: "Krittika", meaning: "Match (not digitized)", auspicious: false },
      { label: "Rohini", meaning: "Match (not digitized)", auspicious: false },
      { label: "Mrigashira", meaning: "Match (not digitized)", auspicious: false },
      { label: "Ardra", meaning: "Match (not digitized)", auspicious: false },
      { label: "Punarvasu", meaning: "Match (not digitized)", auspicious: false },
      { label: "Pushya", meaning: "Match (not digitized)", auspicious: false },
      { label: "Ashlesha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Magha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Purva Phalguni", meaning: "Match (not digitized)", auspicious: false },
      { label: "Uttara Phalguni", meaning: "Match (not digitized)", auspicious: false },
      { label: "Hasta", meaning: "Match (not digitized)", auspicious: false },
      { label: "Chitra", meaning: "Match (not digitized)", auspicious: false },
      { label: "Swati", meaning: "Match (not digitized)", auspicious: false },
      { label: "Vishakha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Anuradha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Jyeshtha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Mula", meaning: "Match (not digitized)", auspicious: false },
      { label: "Purva Ashadha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Uttara Ashadha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Shravana", meaning: "Match (not digitized)", auspicious: false },
      { label: "Dhanishta", meaning: "Match (not digitized)", auspicious: false },
      { label: "Shatabhisha", meaning: "Match (not digitized)", auspicious: false },
      { label: "Purva Bhadrapada", meaning: "Match (not digitized)", auspicious: false },
      { label: "Uttara Bhadrapada", meaning: "Match (not digitized)", auspicious: false },
      { label: "Revati", meaning: "Match (not digitized)", auspicious: false },
    ],
    evaluates: false,
    variants:
      "Encoded as the simple secondary form (L x B x 8) mod 27. Other sources reduce mod 12 first, then map to the star, or use a chain from the Yoni remainder. Auspiciousness depends on matching the householder's birth star — that rule is not digitized in this prototype, so evaluated=false and no star is scored.",
    source: TODO_SOURCE,
    verified: false,
  },
  {
    key: "vara",
    name: "Vara (वार)",
    nameEn: "Weekday rule",
    formulaText:
      "NOT DIGITIZED — the text-derived rule for Vara from plot dimensions is not reproduced here to avoid inventing one",
    multiplier: null,
    divisor: null,
    classCount: 7,
    resultTable: [
      { label: "Ravi (Sunday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Soma (Monday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Mangal (Tuesday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Budh (Wednesday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Guru (Thursday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Shukra (Friday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
      { label: "Shani (Saturday)", meaning: "Auxiliary weekday table (verify)", auspicious: false },
    ],
    evaluates: false,
    variants:
      "Of the commonly cited six, most circulating sources describe Vara/Nakshatra/Tithi as a reduction chain whose anchors differ across texts (some tie it to the intended construction start date rather than plot dimensions alone). No formula is encoded rather than inventing one. evaluated=false.",
    source: TODO_SOURCE,
    verified: false,
  },
  {
    key: "tithi",
    name: "Tithi (तिथि)",
    nameEn: "Lunar-day rule",
    formulaText:
      "NOT DIGITIZED — the text-derived rule for Tithi from plot dimensions is not reproduced here to avoid inventing one",
    multiplier: null,
    divisor: null,
    classCount: 30,
    resultTable: [
      { label: "Shukla 1 (Pratipada)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 2 (Dwitiya)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 3 (Tritiya)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 4 (Chaturthi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 5 (Panchami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 6 (Shashthi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 7 (Saptami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 8 (Ashtami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 9 (Navami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 10 (Dashami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 11 (Ekadashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 12 (Dwadashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 13 (Trayodashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 14 (Chaturdashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Shukla 15 (Purnima)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 1 (Pratipada)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 2 (Dwitiya)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 3 (Tritiya)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 4 (Chaturthi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 5 (Panchami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 6 (Shashthi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 7 (Saptami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 8 (Ashtami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 9 (Navami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 10 (Dashami)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 11 (Ekadashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 12 (Dwadashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 13 (Trayodashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 14 (Chaturdashi)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
      { label: "Krishna 15 (Amavasya)", meaning: "Auxiliary tithi table (verify)", auspicious: false },
    ],
    evaluates: false,
    variants: "See Vara — same chain caveat. evaluated=false.",
    source: TODO_SOURCE,
    verified: false,
  },
];

export const AYADI_DERIVED_CHECKS: AyadiDerivedCheck[] = [
  {
    key: "aayaMinusVyaya",
    description:
      "Common secondary rule: income must not be less than expenditure. PROXY ENCODING: the 8-class position (1..8) of Aaya must be >= that of Vyaya. The proxy's numeric authority is unverified.",
    calculation: "aayaClassIndex >= vyayaClassIndex",
    source: TODO_SOURCE,
    verified: false,
  },
];
