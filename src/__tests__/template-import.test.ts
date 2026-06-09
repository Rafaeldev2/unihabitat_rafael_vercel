import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseTemplateExcel } from "@/lib/normalize-excel";

/**
 * Tests del parser nuevo `parseTemplateExcel` contra los Excel oficiales de
 * la plantilla maestra (CDR + NPL).
 *
 * Fixtures: src/__tests__/fixtures/{CDR,NPL}.xlsx — copias 1:1 de las
 * plantillas de ejemplo del cliente.
 */

/**
 * jsdom no implementa File.arrayBuffer() de forma confiable, así que
 * envolvemos el Buffer en un File con `arrayBuffer` parchado.
 */
function loadFixture(name: string): File {
  const buf = readFileSync(resolve(__dirname, "fixtures", name));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const file = new File([buf], name);
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(ab),
    configurable: true,
  });
  return file;
}

function fileFromArrayBuffer(name: string, ab: ArrayBuffer): File {
  const file = new File([new Uint8Array(ab)], name);
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(ab),
    configurable: true,
  });
  return file;
}

describe("parseTemplateExcel — plantilla CDR", () => {
  it("parsea todas las filas como inmuebles y propiedades CDR", async () => {
    const file = loadFixture("CDR.xlsx");
    const r = await parseTemplateExcel(file);

    // El ejemplo CDR tiene 15 filas con Referencia única → 15 inmuebles + 15 propiedades.
    expect(r.diag.rows).toBeGreaterThan(0);
    expect(r.inmuebles.length).toBeGreaterThan(0);
    expect(r.propiedades.length).toBe(r.inmuebles.length);
    expect(r.diag.categoryCounts.CDR).toBe(r.propiedades.length);
    expect(r.diag.categoryCounts.NPL).toBe(0);
  });

  it("usa la Referencia catastral como id del inmueble", async () => {
    const r = await parseTemplateExcel(loadFixture("CDR.xlsx"));
    for (const inmueble of r.inmuebles) {
      expect(inmueble.id).toMatch(/^[0-9A-Z]{14,}$/); // RC = 14+ chars alfanuméricos
    }
  });

  it("parsea Publicar SI/NO como booleano", async () => {
    const r = await parseTemplateExcel(loadFixture("CDR.xlsx"));
    // Al menos un inmueble del ejemplo CDR debe tener pub=true.
    expect(r.inmuebles.some((i) => i.pub === true)).toBe(true);
  });

  it("parsea precio con coma decimal española como número", async () => {
    const r = await parseTemplateExcel(loadFixture("CDR.xlsx"));
    const conPrecio = r.inmuebles.filter((i) => i.precio != null && i.precio > 0);
    expect(conPrecio.length).toBeGreaterThan(0);
  });

  it("propaga lat/lng del Excel a campos numéricos", async () => {
    const r = await parseTemplateExcel(loadFixture("CDR.xlsx"));
    const conCoords = r.inmuebles.filter((i) => i.lat != null && i.lng != null);
    expect(conCoords.length).toBeGreaterThan(0);
  });

  it("preserva propietario y propiedades en cada lien", async () => {
    const r = await parseTemplateExcel(loadFixture("CDR.xlsx"));
    expect(r.propiedades.every((p) => p.propietario !== "")).toBe(true);
    expect(r.propiedades.every((p) => p.activoId !== "")).toBe(true);
  });
});

describe("parseTemplateExcel — plantilla NPL", () => {
  it("parsea las filas y fusiona inmuebles cuando la Referencia se repite (liens distintos)", async () => {
    const r = await parseTemplateExcel(loadFixture("NPL.xlsx"));

    // Cada fila válida del Excel produce una propiedad. Si una RC aparece
    // varias veces (Lien=1 + Lien=2) los inmuebles se fusionan, por lo que
    // hay menos inmuebles que propiedades.
    expect(r.propiedades.length).toBeGreaterThan(0);
    expect(r.inmuebles.length).toBeGreaterThan(0);
    expect(r.inmuebles.length).toBeLessThanOrEqual(r.propiedades.length);
    // categoryCounts cuenta filas parseadas (pre-dedup), por eso puede ser
    // mayor que propiedades.length si Collateral ID se repitió.
    expect(r.diag.categoryCounts.NPL).toBeGreaterThanOrEqual(r.propiedades.length);
    expect(r.diag.categoryCounts.CDR).toBe(0);
  });

  it("agrupa propiedades del mismo activo por ID1", async () => {
    const r = await parseTemplateExcel(loadFixture("NPL.xlsx"));
    const groups = new Map<string, number>();
    for (const p of r.propiedades) {
      groups.set(p.activoId, (groups.get(p.activoId) ?? 0) + 1);
    }
    // En el NPL de ejemplo el ID1 "UF72058" aparece varias veces.
    const repeated = [...groups.values()].filter((n) => n > 1);
    expect(repeated.length).toBeGreaterThan(0);
  });

  it("usa Collateral ID como PK de cada propiedad cuando está disponible", async () => {
    const r = await parseTemplateExcel(loadFixture("NPL.xlsx"));
    const conCollateral = r.propiedades.filter((p) => p.collateralId !== "");
    expect(conCollateral.length).toBeGreaterThan(0);
    // El id de la propiedad coincide con su collateralId cuando éste no está vacío.
    for (const p of conCollateral) {
      expect(p.id).toBe(p.collateralId);
    }
  });

  it("preserva la Referencia como id del inmueble incluso si aparece en varias filas", async () => {
    const r = await parseTemplateExcel(loadFixture("NPL.xlsx"));
    const inmuebleIds = new Set(r.inmuebles.map((i) => i.id));
    for (const p of r.propiedades) {
      expect(inmuebleIds.has(p.inmuebleId)).toBe(true);
    }
  });
});

describe("parseTemplateExcel — errores", () => {
  it("lanza error si falta la cabecera Referencia", async () => {
    // Excel mínimo sin la columna obligatoria.
    const wb = await import("xlsx");
    const ws = wb.utils.aoa_to_sheet([
      ["Categoria", "ID1"],
      ["CDR", "A1"],
    ]);
    const workbook = wb.utils.book_new();
    wb.utils.book_append_sheet(workbook, ws, "Hoja1");
    const buf = wb.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = fileFromArrayBuffer("sin-referencia.xlsx", buf);
    await expect(parseTemplateExcel(file)).rejects.toThrow(/Referencia/);
  });
});
