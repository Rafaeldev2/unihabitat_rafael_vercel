import COUNTRY_CODES, { type CountryCode } from "./country-codes";

export function formatPhoneNumber(value: string, format: string): string {
  const digits = value.replace(/\D/g, "");
  let result = "";
  let di = 0;
  for (let i = 0; i < format.length && di < digits.length; i++) {
    if (format[i] === "X") {
      result += digits[di++];
    } else {
      result += format[i];
      if (di < digits.length) continue;
      break;
    }
  }
  return result;
}

export function maxDigitsForFormat(format: string): number {
  return format.replace(/[^X]/g, "").length;
}

export function findCountry(countryIso: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.country === countryIso);
}

export function filterCountries(search: string): CountryCode[] {
  if (!search) return COUNTRY_CODES;
  const q = search.toLowerCase();
  return COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.country.toLowerCase().includes(q)
  );
}

export function buildFullPhone(code: string, phone: string): string {
  return phone ? `${code} ${phone}` : "";
}
