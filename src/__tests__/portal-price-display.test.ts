import { describe, expect, it } from "vitest";
import { getPortalPriceDisplay } from "@/lib/utils";

describe("getPortalPriceDisplay", () => {
  it("NPL muestra Deuda (no precio de oferta)", () => {
    const d = getPortalPriceDisplay({
      precio: 0,
      propiedades: [{ categoria: "NPL", deuda: 150000 }],
    });
    expect(d.kind).toBe("deuda");
    expect(d.label).toBe("Deuda");
    expect(d.value).toContain("150");
  });

  it("CDR con precio muestra Precio", () => {
    const d = getPortalPriceDisplay({
      precio: 99000,
      propiedades: [{ categoria: "CDR", deuda: null }],
    });
    expect(d.kind).toBe("precio");
    expect(d.label).toBe("Precio");
    expect(d.value).toContain("99");
  });

  it("CDR sin precio → Haz tu Oferta", () => {
    const d = getPortalPriceDisplay({
      precio: 0,
      propiedades: [{ categoria: "CDR" }],
    });
    expect(d.kind).toBe("oferta");
    expect(d.value).toBe("Haz tu Oferta");
  });
});
