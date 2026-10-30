import { describe, expect, it } from "vitest";
import { parsePlotDescription } from "./parse-plot";

describe("parsePlotDescription", () => {
  it("parses the canonical example: East-facing 30x40, 3BHK, Bhopal", () => {
    const result = parsePlotDescription("East-facing 30x40, 3BHK, Bhopal");
    expect(result.patch).toMatchObject({
      length: 40,
      width: 30,
      unit: "ft",
      facing: "E",
      city: "bhopal",
      bedrooms: 3,
    });
    expect(result.understood.join(" ")).toContain("Facing: East");
    expect(result.missing).toEqual([]);
  });

  it("assigns the longer side to length regardless of word order", () => {
    const result = parsePlotDescription("40 by 25 ft house facing West");
    expect(result.patch.length).toBe(40);
    expect(result.patch.width).toBe(25);
    expect(result.patch.facing).toBe("W");
    expect(result.patch.buildingType).toBe("residential");
  });

  it("detects the unit when metres are written out", () => {
    const result = parsePlotDescription("30 x 40 meters plot in Mumbai");
    expect(result.patch.unit).toBe("m");
    expect(result.patch.city).toBe("mumbai");
  });

  it("defaults to feet when no unit is given", () => {
    const result = parsePlotDescription("60x40 4bhk Lucknow");
    expect(result.patch.unit).toBe("ft");
  });

  it("recognises compound facings before single directions", () => {
    expect(parsePlotDescription("north east facing 30x40").patch.facing).toBe("NE");
    expect(parsePlotDescription("south-west facing 30x40").patch.facing).toBe("SW");
    expect(parsePlotDescription("NE 30x40").patch.facing).toBe("NE");
  });

  it("picks up optional features without inventing them", () => {
    const result = parsePlotDescription("40x30 east 3bhk Delhi with pooja room and parking");
    expect(result.patch.poojaRoom).toBe(true);
    expect(result.patch.parking).toBe(true);
    expect(result.patch.elderlyGroundFloor).toBeUndefined();
  });

  it("never guesses: reports missing fields instead", () => {
    const result = parsePlotDescription("a big lovely plot");
    expect(result.patch).toEqual({});
    expect(result.missing.length).toBeGreaterThanOrEqual(3);
    expect(result.missing.some((m) => m.toLowerCase().includes("dimensions"))).toBe(true);
    expect(result.missing.some((m) => m.toLowerCase().includes("facing"))).toBe(true);
    expect(result.missing.some((m) => m.toLowerCase().includes("city"))).toBe(true);
  });

  it("keeps unsupported building types as residential and says so", () => {
    const result = parsePlotDescription("30x40 school building in Pune");
    expect(result.patch.buildingType).toBeUndefined();
    expect(result.notes.some((n) => n.includes("School"))).toBe(true);
  });

  it("handles * and × separators", () => {
    expect(parsePlotDescription("30*40").patch).toMatchObject({ length: 40, width: 30 });
    expect(parsePlotDescription("30 × 40").patch).toMatchObject({ length: 40, width: 30 });
  });

  it("rejects non-positive dimensions instead of applying them", () => {
    const result = parsePlotDescription("0 x 0 plot");
    expect(result.patch.length).toBeUndefined();
    expect(result.patch.width).toBeUndefined();
    expect(result.missing.some((m) => m.includes("not usable"))).toBe(true);
  });

  it("clamps excessive bedrooms and reports it", () => {
    const result = parsePlotDescription("30x40, 9BHK, Chennai");
    expect(result.patch.bedrooms).toBe(5);
    expect(result.notes.some((n) => n.includes("clamped"))).toBe(true);
  });
});
