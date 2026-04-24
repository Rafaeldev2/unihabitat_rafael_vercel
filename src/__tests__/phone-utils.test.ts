import { describe, it, expect } from "vitest";
import {
  formatPhoneNumber,
  maxDigitsForFormat,
  findCountry,
  filterCountries,
  buildFullPhone,
} from "@/lib/phone-utils";

describe("formatPhoneNumber", () => {
  it("formats a Spanish number correctly", () => {
    expect(formatPhoneNumber("612345678", "XXX XX XX XX")).toBe("612 34 56 78");
  });

  it("formats a US number correctly", () => {
    expect(formatPhoneNumber("2125551234", "XXX XXX XXXX")).toBe("212 555 1234");
  });

  it("formats a partial number without trailing space", () => {
    expect(formatPhoneNumber("612", "XXX XX XX XX")).toBe("612");
  });

  it("formats a partial number mid-group", () => {
    expect(formatPhoneNumber("61234", "XXX XX XX XX")).toBe("612 34");
  });

  it("strips non-digit characters from input", () => {
    expect(formatPhoneNumber("6-12 34.56", "XXX XX XX XX")).toBe("612 34 56");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhoneNumber("", "XXX XX XX XX")).toBe("");
  });

  it("handles format with leading single digit group", () => {
    expect(formatPhoneNumber("612345678", "X XX XX XX XX")).toBe("6 12 34 56 78");
  });

  it("truncates digits beyond format capacity", () => {
    const result = formatPhoneNumber("12345678901234", "XXX XXX XXXX");
    expect(result).toBe("123 456 7890");
  });
});

describe("maxDigitsForFormat", () => {
  it("counts digit slots in Spanish format", () => {
    expect(maxDigitsForFormat("XXX XX XX XX")).toBe(9);
  });

  it("counts digit slots in US format", () => {
    expect(maxDigitsForFormat("XXX XXX XXXX")).toBe(10);
  });

  it("counts digit slots in UK format", () => {
    expect(maxDigitsForFormat("XXXX XXXXXX")).toBe(10);
  });
});

describe("findCountry", () => {
  it("finds Spain by ISO code", () => {
    const result = findCountry("ES");
    expect(result).toBeDefined();
    expect(result!.code).toBe("+34");
    expect(result!.name).toBe("España");
  });

  it("finds US by ISO code", () => {
    const result = findCountry("US");
    expect(result).toBeDefined();
    expect(result!.code).toBe("+1");
  });

  it("returns undefined for unknown ISO", () => {
    expect(findCountry("ZZ")).toBeUndefined();
  });
});

describe("filterCountries", () => {
  it("returns all countries for empty search", () => {
    const result = filterCountries("");
    expect(result.length).toBeGreaterThan(100);
  });

  it("filters by country name (case-insensitive)", () => {
    const result = filterCountries("españa");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].country).toBe("ES");
  });

  it("filters by dial code", () => {
    const result = filterCountries("+34");
    expect(result.some((c) => c.country === "ES")).toBe(true);
  });

  it("filters by ISO code", () => {
    const result = filterCountries("es");
    expect(result.some((c) => c.country === "ES")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const result = filterCountries("zzzzzzzzz");
    expect(result).toHaveLength(0);
  });

  it("finds multiple results for partial match", () => {
    const result = filterCountries("co");
    expect(result.length).toBeGreaterThanOrEqual(2); // Colombia, Congo, Corea, Costa Rica, etc.
  });
});

describe("buildFullPhone", () => {
  it("combines code and phone", () => {
    expect(buildFullPhone("+34", "612 34 56 78")).toBe("+34 612 34 56 78");
  });

  it("returns empty string when phone is empty", () => {
    expect(buildFullPhone("+34", "")).toBe("");
  });
});
