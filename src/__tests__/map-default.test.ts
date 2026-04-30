import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPlaceholderMapUrl, shouldBackfillMapFromAddress, defaultMapUrlForClient, OSM_FALLBACK_MAP } from "@/lib/map-default";

describe("map-default", () => {
  describe("isPlaceholderMapUrl", () => {
    it("considera placeholder cuando la URL está vacía o nula", () => {
      expect(isPlaceholderMapUrl(null)).toBe(true);
      expect(isPlaceholderMapUrl(undefined)).toBe(true);
      expect(isPlaceholderMapUrl("")).toBe(true);
      expect(isPlaceholderMapUrl("   ")).toBe(true);
    });

    it("detecta el placeholder Geoapify de Madrid (zoom=6)", () => {
      const madrid =
        "https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.7038,40.4168&zoom=6&width=600&height=400&style=osm-bright&apiKey=k";
      expect(isPlaceholderMapUrl(madrid)).toBe(true);
    });

    it("detecta el placeholder OSM de Madrid (zoom=6)", () => {
      expect(isPlaceholderMapUrl(OSM_FALLBACK_MAP)).toBe(true);
    });

    it("NO marca como placeholder un mapa Geoapify real (zoom 15 sobre otro punto)", () => {
      const real =
        "https://maps.geoapify.com/v1/staticmap?center=lonlat:-5.179,36.807&zoom=15&width=600&height=400&style=osm-bright&apiKey=k";
      expect(isPlaceholderMapUrl(real)).toBe(false);
    });

    it("acepta URLs URI-encoded (decodificación interna)", () => {
      const encoded = encodeURI(
        "https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.7038,40.4168&zoom=6&apiKey=k",
      );
      expect(isPlaceholderMapUrl(encoded)).toBe(true);
    });
  });

  describe("shouldBackfillMapFromAddress", () => {
    const baseAddr = { addr: "C/ Real 1", pob: "Granada", prov: "Granada", cp: "18001" };

    it("dispara backfill cuando el mapa es placeholder", () => {
      expect(
        shouldBackfillMapFromAddress({ ...baseAddr, map: OSM_FALLBACK_MAP, lat: null, lng: null }),
      ).toBe(true);
    });

    it("dispara backfill cuando lat/lng son nulos y la dirección es utilizable", () => {
      expect(
        shouldBackfillMapFromAddress({ ...baseAddr, map: undefined, lat: null, lng: null }),
      ).toBe(true);
    });

    it("NO dispara backfill cuando ya hay coordenadas reales", () => {
      const real =
        "https://maps.geoapify.com/v1/staticmap?center=lonlat:-3.6,37.1&zoom=15&apiKey=k";
      expect(
        shouldBackfillMapFromAddress({ ...baseAddr, map: real, lat: 37.1, lng: -3.6 }),
      ).toBe(false);
    });

    it("dispara backfill cuando solo falta el mapa (placeholder) aunque la dirección esté vacía", () => {
      // El backfill se considera barato (solo intentar geocodificar): si el
      // mapa es placeholder, lo intentamos aunque la dirección esté en
      // "—". El geocoder devolverá null y el activo se queda igual.
      expect(
        shouldBackfillMapFromAddress({
          addr: "—",
          pob: "—",
          prov: "—",
          cp: "—",
          map: undefined,
          lat: null,
          lng: null,
        }),
      ).toBe(true);
    });
  });

  describe("defaultMapUrlForClient", () => {
    const orig = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    beforeEach(() => { delete process.env.NEXT_PUBLIC_GEOAPIFY_KEY; });
    afterEach(() => { if (orig) process.env.NEXT_PUBLIC_GEOAPIFY_KEY = orig; });

    it("devuelve OSM fallback cuando no hay clave Geoapify pública", () => {
      expect(defaultMapUrlForClient()).toBe(OSM_FALLBACK_MAP);
    });

    it("devuelve URL Geoapify (apiKey codificado) cuando la clave está presente", () => {
      process.env.NEXT_PUBLIC_GEOAPIFY_KEY = "abc 123";
      const url = defaultMapUrlForClient();
      expect(url).toContain("maps.geoapify.com");
      expect(url).toContain("apiKey=abc%20123");
      expect(url).toContain("zoom=6");
    });
  });
});
