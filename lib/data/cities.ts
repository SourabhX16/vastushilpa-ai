import type { CityData } from "../engine/types";

/**
 * CITY DATA — ALL ENTRIES verified: false.
 *
 * VALUES YOU MUST DOUBLE-CHECK before shipping anything but a prototype:
 *
 * 1. climateZone  — assigned from memory of the NBC 2016 climate map
 *   (hot-dry / warm-humid / composite / temperate / cold). Boundary cities
 *   are exactly where misclassification happens: Jaipur (composite vs
 *   hot-dry), Ahmedabad (hot-dry vs composite), Pune (composite vs
 *   warm-humid), Shimla (cold). Verify each against NBC 2016 Part? map.
 *
 * 2. seismicZone  — to IS 1893 (Part 1):2016 zoning. Reasonably confident:
 *   Guwahati V, Delhi IV, Shimla IV, Mumbai III, Kolkata III, Chennai III,
 *   Ahmedabad III. Watch: Lucknow (III vs II), Pune (II vs III), Jaipur (II),
 *   Bhopal/Indore (II vs III). Verify against the official zone map /
 *   Table 2 of IS 1893 Part 1:2016.
 *
 * 3. Coordinates — city-centre approximations, good enough for sun-path only.
 *
 * 4. Temps / humidity / rainfall — ballpark from memory of IMD climate
 *   normals (publication: "Climatological Normals 1991-2020" or the older
 *   1991-2020? normals). They are treated as design-BASIS estimates only;
 *   verify each against IMD normals. Winter values are means of the coldest
 *   month, summer of the hottest month; definitions vary by source.
 *
 * 5. prevailingWind — single-vector simplification. Most of India reverses
 *   wind with the SW monsoon (June–Sep) / NE monsoon (Oct–Dec on the east
 *   coast). A one-direction field cannot represent that; the engine should
 *   treat this as the summer-prevailing direction until richer data exists.
 *
 * Every entry below repeats this in `source`.
 */

const SOURCE_CITY =
  "TODO: verify against IMD climatological normals, NBC 2016 climate map and IS 1893 (Part 1):2016 zone map (compiled from general knowledge, unverified)";

export const CITIES: CityData[] = [
  {
    id: "bhopal",
    name: "Bhopal",
    latitude: 23.26,
    longitude: 77.41,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 36,
    avgWinterTempC: 19,
    avgRelativeHumidityPct: 55,
    annualRainfallMm: 1100,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Double-check seismic (II vs III) and winter mean.",
  },
  {
    id: "indore",
    name: "Indore",
    latitude: 22.72,
    longitude: 75.86,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 36,
    avgWinterTempC: 18,
    avgRelativeHumidityPct: 55,
    annualRainfallMm: 950,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Double-check seismic (II vs III).",
  },
  {
    id: "delhi",
    name: "Delhi",
    latitude: 28.61,
    longitude: 77.21,
    climateZone: "composite",
    seismicZone: "IV",
    avgSummerTempC: 40,
    avgWinterTempC: 15,
    avgRelativeHumidityPct: 55,
    annualRainfallMm: 800,
    prevailingWind: "W",
    source: SOURCE_CITY,
    verified: false,
    notes: "Winds reverse seasonally (NW winter, SE monsoon); winter can dip far below the mean.",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    latitude: 19.08,
    longitude: 72.88,
    climateZone: "warm-humid",
    seismicZone: "III",
    avgSummerTempC: 32,
    avgWinterTempC: 24,
    avgRelativeHumidityPct: 78,
    annualRainfallMm: 2200,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
  },
  {
    id: "chennai",
    name: "Chennai",
    latitude: 13.08,
    longitude: 80.27,
    climateZone: "warm-humid",
    seismicZone: "III",
    avgSummerTempC: 37,
    avgWinterTempC: 24,
    avgRelativeHumidityPct: 70,
    annualRainfallMm: 1300,
    prevailingWind: "SE",
    source: SOURCE_CITY,
    verified: false,
    notes: "NE monsoon (Oct-Dec) brings the bulk of rain; year-round rainfall number is a rough combined figure.",
  },
  {
    id: "bengaluru",
    name: "Bengaluru",
    latitude: 12.97,
    longitude: 77.59,
    climateZone: "temperate",
    seismicZone: "II",
    avgSummerTempC: 33,
    avgWinterTempC: 18,
    avgRelativeHumidityPct: 60,
    annualRainfallMm: 900,
    prevailingWind: "W",
    source: SOURCE_CITY,
    verified: false,
    notes: "Temperate vs warm-humid boundary; verify. Rainfall varies widely across the city.",
  },
  {
    id: "kolkata",
    name: "Kolkata",
    latitude: 22.57,
    longitude: 88.36,
    climateZone: "warm-humid",
    seismicZone: "III",
    avgSummerTempC: 35,
    avgWinterTempC: 18,
    avgRelativeHumidityPct: 76,
    annualRainfallMm: 1600,
    prevailingWind: "S",
    source: SOURCE_CITY,
    verified: false,
  },
  {
    id: "jaipur",
    name: "Jaipur",
    latitude: 26.91,
    longitude: 75.79,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 40,
    avgWinterTempC: 16,
    avgRelativeHumidityPct: 45,
    annualRainfallMm: 650,
    prevailingWind: "W",
    source: SOURCE_CITY,
    verified: false,
    notes: "Composite vs hot-dry boundary; verify against NBC map.",
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    latitude: 17.39,
    longitude: 78.49,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 38,
    avgWinterTempC: 22,
    avgRelativeHumidityPct: 55,
    annualRainfallMm: 850,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
  },
  {
    id: "pune",
    name: "Pune",
    latitude: 18.52,
    longitude: 73.86,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 35,
    avgWinterTempC: 20,
    avgRelativeHumidityPct: 60,
    annualRainfallMm: 700,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Double-check seismic (II vs III) and climate (composite vs warm-humid).",
  },
  {
    id: "ahmedabad",
    name: "Ahmedabad",
    latitude: 23.02,
    longitude: 72.57,
    climateZone: "hot-dry",
    seismicZone: "III",
    avgSummerTempC: 42,
    avgWinterTempC: 23,
    avgRelativeHumidityPct: 50,
    annualRainfallMm: 750,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Hot-dry vs composite boundary; verify. Zone III per common lists - verify.",
  },
  {
    id: "lucknow",
    name: "Lucknow",
    latitude: 26.85,
    longitude: 80.95,
    climateZone: "composite",
    seismicZone: "III",
    avgSummerTempC: 40,
    avgWinterTempC: 15,
    avgRelativeHumidityPct: 65,
    annualRainfallMm: 1000,
    prevailingWind: "W",
    source: SOURCE_CITY,
    verified: false,
    notes: "Double-check seismic (III vs II) and prevailing wind.",
  },
  {
    id: "nagpur",
    name: "Nagpur",
    latitude: 21.15,
    longitude: 79.09,
    climateZone: "composite",
    seismicZone: "II",
    avgSummerTempC: 40,
    avgWinterTempC: 20,
    avgRelativeHumidityPct: 55,
    annualRainfallMm: 1200,
    prevailingWind: "SW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Summer peaks are among the highest in India; mean may understate design temperature.",
  },
  {
    id: "shimla",
    name: "Shimla",
    latitude: 31.1,
    longitude: 77.17,
    climateZone: "cold",
    seismicZone: "IV",
    avgSummerTempC: 25,
    avgWinterTempC: 7,
    avgRelativeHumidityPct: 60,
    annualRainfallMm: 1400,
    prevailingWind: "NW",
    source: SOURCE_CITY,
    verified: false,
    notes: "Cold (cloudy) classification per NBC; zone IV vs V verify. Snowfall above ~2000 m not represented.",
  },
  {
    id: "guwahati",
    name: "Guwahati",
    latitude: 26.14,
    longitude: 91.74,
    climateZone: "warm-humid",
    seismicZone: "V",
    avgSummerTempC: 34,
    avgWinterTempC: 17,
    avgRelativeHumidityPct: 78,
    annualRainfallMm: 1700,
    prevailingWind: "NE",
    source: SOURCE_CITY,
    verified: false,
    notes: "Zone V is certain for NE India; wind direction needs verification.",
  },
];

export function getCityById(id: string): CityData | undefined {
  return CITIES.find((c) => c.id === id);
}
