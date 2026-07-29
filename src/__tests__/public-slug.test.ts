import { describe, it, expect } from "vitest";
import {
  slugifySegment,
  opaqueSuffixFromId,
  buildPublicSlug,
  assetPortalHref,
  assetPrivateHref,
  publicAssetPath,
} from "@/lib/public-slug";

describe("public-slug", () => {
  it("slugifySegment normaliza acentos y caracteres especiales", () => {
    expect(slugifySegment("Valdemoro")).toBe("valdemoro");
    expect(slugifySegment("Piso")).toBe("piso");
    expect(slugifySegment("A Coruña")).toBe("a-coruna");
  });

  it("buildPublicSlug no incluye referencia catastral ni ID1", () => {
    const slug = buildPublicSlug({
      id: "ESC-HO-01-1682__7106909UK5370N0001QF",
      tip: "PISO",
      pob: "Valdemoro",
    });
    expect(slug).toMatch(/^piso-valdemoro-[a-f0-9]{6}$/);
    expect(slug).not.toContain("7106909");
    expect(slug).not.toContain("ESC-HO");
    expect(slug).not.toContain("__");
  });

  it("reutiliza publicSlug existente si no está tomado", () => {
    const slug = buildPublicSlug({
      id: "A__B",
      tip: "PISO",
      pob: "Madrid",
      publicSlug: "piso-madrid-abc123",
    });
    expect(slug).toBe("piso-madrid-abc123");
  });

  it("resuelve colisiones con sufijo extra", () => {
    const base = buildPublicSlug({ id: "X__Y", tip: "PISO", pob: "Madrid" });
    const taken = new Set([base]);
    const alt = buildPublicSlug({ id: "X__Y", tip: "PISO", pob: "Madrid" }, taken);
    expect(alt).not.toBe(base);
    expect(alt.startsWith("piso-madrid-")).toBe(true);
  });

  it("opaqueSuffixFromId es estable", () => {
    expect(opaqueSuffixFromId("same-id")).toBe(opaqueSuffixFromId("same-id"));
    expect(opaqueSuffixFromId("a")).not.toBe(opaqueSuffixFromId("b"));
  });

  it("assetPortalHref y assetPrivateHref usan slug canónico", () => {
    const a = { id: "legacy-id", publicSlug: "piso-valdemoro-k7m4qx" };
    expect(assetPortalHref(a)).toBe(publicAssetPath("piso-valdemoro-k7m4qx"));
    expect(assetPrivateHref(a)).toBe("/portal/privado/inmueble/piso-valdemoro-k7m4qx");
    expect(assetPortalHref({ id: "only-id" })).toBe("/portal/only-id");
  });
});
