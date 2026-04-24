import { describe, it, expect } from "vitest";
import COUNTRY_CODES from "@/lib/country-codes";

describe("COUNTRY_CODES", () => {
  it("should have at least 150 countries", () => {
    expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(150);
  });

  it("every entry should have required fields", () => {
    for (const c of COUNTRY_CODES) {
      expect(c.code).toMatch(/^\+\d+$/);
      expect(c.country).toMatch(/^[A-Z]{2}$/);
      expect(c.flag).toBeTruthy();
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.format).toMatch(/^[X ]+$/);
    }
  });

  it("every format should have at least 4 digit slots", () => {
    for (const c of COUNTRY_CODES) {
      const digits = c.format.replace(/[^X]/g, "").length;
      expect(digits).toBeGreaterThanOrEqual(4);
    }
  });

  it("should not have duplicate country ISO codes (except shared codes like +1, +7)", () => {
    const seen = new Set<string>();
    for (const c of COUNTRY_CODES) {
      const key = c.country;
      expect(seen.has(key), `Duplicate country ISO: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("should have Spain (ES) as the first entry", () => {
    expect(COUNTRY_CODES[0].country).toBe("ES");
    expect(COUNTRY_CODES[0].code).toBe("+34");
  });

  it("should include all major regions", () => {
    const countries = COUNTRY_CODES.map((c) => c.country);
    // Europe
    expect(countries).toContain("ES");
    expect(countries).toContain("GB");
    expect(countries).toContain("FR");
    expect(countries).toContain("DE");
    // Americas
    expect(countries).toContain("US");
    expect(countries).toContain("MX");
    expect(countries).toContain("BR");
    expect(countries).toContain("AR");
    // Asia
    expect(countries).toContain("CN");
    expect(countries).toContain("JP");
    expect(countries).toContain("IN");
    // Africa
    expect(countries).toContain("NG");
    expect(countries).toContain("ZA");
    expect(countries).toContain("EG");
    // Middle East
    expect(countries).toContain("AE");
    expect(countries).toContain("SA");
    // Oceania
    expect(countries).toContain("AU");
    expect(countries).toContain("NZ");
  });
});
