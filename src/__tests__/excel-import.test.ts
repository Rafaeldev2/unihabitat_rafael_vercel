import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  parseExcelFile,
  type ParseExcelResult,
  parseExcelHeuristic,
  parseWithMapping,
  mergeHeuristicIntoMapped,
  dedupAssetsByIdWithCount,
} from "@/lib/normalize-excel";
import type { Asset, AssetAdmin } from "@/lib/types";

const FIXTURES_DIR = join(__dirname, "fixtures");

function fixturePath(name: string): string {
  return join(FIXTURES_DIR, name);
}

function hasFixture(name: string): boolean {
  return existsSync(fixturePath(name));
}

function loadFixture(name: string): File {
  const buf = readFileSync(fixturePath(name));
  return new File([new Uint8Array(buf)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function makeXlsxFile(sheets: Record<string, (string | number | null)[][]>, fileName = "synth.xlsx"): File {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// Los .xlsx con datos reales del cliente están en .gitignore (datos sensibles).
// Estos tests sólo se ejecutan si los fixtures existen localmente; en CI los
// "tests sintéticos" abajo cubren la lógica esencial sin necesidad de los datos.
const realFixturesPresent =
  hasFixture("ejemplo-datos-2.xlsx") &&
  hasFixture("prueba-5.xlsx") &&
  hasFixture("prueba-subida-100.xlsx");

describe.skipIf(!realFixturesPresent)("parseExcelFile — regresión de archivos reales", () => {
  it("Ejemplo datos 2.xlsx (3 hojas Proveedor con offset=5) parsea todas las filas", async () => {
    const file = loadFixture("ejemplo-datos-2.xlsx");
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;

    // Ningún parser silencioso debe descartar filas con ID válido. El offset
    // detectado debe ser 5 en las tres hojas (cinco columnas extra
    // Propietario/Telefono/mail/Publicar/Categoria al inicio).
    const provDiag = result.sheetDiag.filter((d) => d.format !== "unknown");
    expect(provDiag.length).toBe(3);
    for (const d of provDiag) {
      expect(d.offset).toBe(5);
      // Permitimos que filas vacías al final de la hoja no cuenten, pero la
      // mayoría debe parsear. Antes de este fix, prov1 y prov3 devolvían 0
      // assets porque leían la columna equivocada del id.
      expect(d.parsed).toBeGreaterThanOrEqual(d.rows - 1);
    }

    // Algunos IDs concretos del archivo (verificados por inspección manual).
    const ids = new Set(result.assets.map((a) => a.id));
    expect(ids.has("UF34938")).toBe(true);   // prov1 row 2
    expect(ids.has("BROK00792")).toBe(true); // prov3 row 2
  });

  it("Prueba 5.xlsx (Hoja1) sigue siendo parseable tras el cambio", async () => {
    const file = loadFixture("prueba-5.xlsx");
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;
    // El archivo no usa nombres Proveedor; cae en detectFormatByHeader.
    // No verificamos un count exacto — solo que el formato siga detectándose
    // igual que antes (offset>0 ó format reconocido) cuando aplicable.
    expect(result.sheetDiag.length).toBeGreaterThan(0);
  });

  it("Prueba subida 100 activos.xlsx (Hoja1, layout prov2) parsea con offset=5", async () => {
    const file = loadFixture("prueba-subida-100.xlsx");
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;

    const main = result.sheetDiag[0];
    expect(main).toBeDefined();
    expect(main.format).toBe("prov2");
    expect(main.offset).toBe(5);
    // 100 filas + cabecera; el parser debe extraer la mayoría.
    expect(main.parsed).toBeGreaterThanOrEqual(95);
  });
});

describe("parseExcelFile — sintéticos", () => {
  it("heuristica fusiona huecos IA: cat y dirección vienen del parse por cabeceras", async () => {
    const header = [
      "Categoría",
      "Dirección",
      "ID1",
      "Property Type",
      "Town",
      "Province",
      "ZIP",
      "Precio",
    ];
    const row = [
      "Sinergia CRM",
      "Calle Inventada 123",
      "MERGE-UNIT-TEST",
      "vivienda_bloque_piso",
      "Las Rozas",
      "Madrid",
      "28230",
      150000,
    ];
    const file = makeXlsxFile({ Sheet1: [header, row] });
    const h = await parseExcelHeuristic(file);
    expect(h.assets.length).toBe(1);
    const heuristic = h.assets[0];
    expect(heuristic.id).toBe("MERGE-UNIT-TEST");
    expect(heuristic.cat).toBe("Sinergia CRM");
    expect(heuristic.addr).toBe("Calle Inventada 123");

    const fromAiGap = {
      ...heuristic,
      cat: "—",
      addr: "—",
      fullAddr: "—",
    };
    const merged = mergeHeuristicIntoMapped([fromAiGap], [heuristic]);
    expect(merged[0].cat).toBe(heuristic.cat);
    expect(merged[0].addr).toBe(heuristic.addr);
  });

  it("hoja con nombre PROVEEDOR 1 y columnas con offset 3 detecta el offset", async () => {
    // Tres columnas extra antes del layout canónico de Proveedor 1.
    const header = [
      "Extra1", "Extra2", "Extra3",
      "Data Ref", "Portfolio", "UF", "Main Local", "Lien", "ID Prinex", "ID Prinex Corto",
      "CD Referencia Catastral", "Dirección Completa", "CP", "Municipio", "Provincia",
      "CCAA", "Tipo Inmueble", "Juzgado", "Código Proc", "Última Fase", "Importe Reclamado", "Tasación",
    ];
    const row1 = [
      "x", "y", "z",
      "2024-01-01", "PORTAFOLIO", "TEST-UF-001", "ML", "L", "PRX", "PRX-S",
      "1234567AB1234A0001ZZ", "Calle Test 1", "28001", "Madrid", "Madrid",
      "Madrid", "Vivienda", "Juz 1", "001", "Subasta", 100000, 90000,
    ];
    const file = makeXlsxFile({ "Proveedor 1": [header, row1] });
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;
    const diag = result.sheetDiag[0];
    expect(diag.format).toBe("prov1");
    expect(diag.offset).toBe(3);
    expect(diag.parsed).toBe(1);
    expect(result.assets[0]?.id).toBe("TEST-UF-001");
  });

  it("hoja PROVEEDOR 1 sin offset (layout canónico) sigue parseando con offset=0", async () => {
    const header = [
      "Data Ref", "Portfolio", "UF", "Main Local", "Lien", "ID Prinex", "ID Prinex Corto",
      "CD Referencia Catastral", "Dirección Completa", "CP", "Municipio", "Provincia",
      "CCAA", "Tipo Inmueble", "Juzgado", "Código Proc", "Última Fase", "Importe Reclamado", "Tasación",
    ];
    const row1 = [
      "2024-01-01", "PORTAFOLIO", "TEST-CANONICAL", "ML", "L", "PRX", "PRX-S",
      "1234567AB1234A0001ZZ", "Calle Test 1", "28001", "Madrid", "Madrid",
      "Madrid", "Vivienda", "Juz 1", "001", "Subasta", 100000, 90000,
    ];
    const file = makeXlsxFile({ "Proveedor 1": [header, row1] });
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;
    expect(result.sheetDiag[0].offset).toBe(0);
    expect(result.sheetDiag[0].parsed).toBe(1);
    expect(result.assets[0]?.id).toBe("TEST-CANONICAL");
  });

  it("parseExcelHeuristic deduplica filas con el mismo id (evita ON CONFLICT en upsert)", async () => {
    const header = ["ID1", "Provincia", "Localidad", "Precio"];
    const file = makeXlsxFile({
      Hoja1: [
        header,
        ["DUP-A", "Madrid", "Madrid", 100000],
        ["DUP-B", "Barcelona", "Barcelona", 200000],
        ["DUP-A", "Madrid", "Las Rozas", 110000], // mismo id que la primera
      ],
    });
    const h = await parseExcelHeuristic(file);
    expect(h.assets.length).toBe(2);
    const ids = h.assets.map(a => a.id).sort();
    expect(ids).toEqual(["DUP-A", "DUP-B"]);
    // El segundo valor (no vacío) gana para los campos string en el merge.
    const dupA = h.assets.find(a => a.id === "DUP-A")!;
    expect(dupA.pob).toBe("Las Rozas");
  });

  it("parseWithMapping deduplica filas con el mismo id", async () => {
    const file = makeXlsxFile({
      Hoja1: [
        ["Codigo", "Provincia", "Municipio"],
        ["X-1", "Madrid", "Madrid"],
        ["X-2", "Barcelona", "Barcelona"],
        ["X-1", "Madrid", "Alcalá"], // duplicado
      ],
    });
    const assets = await parseWithMapping(file, { 0: "id", 1: "prov", 2: "pob" });
    expect(assets.length).toBe(2);
    expect(new Set(assets.map(a => a.id))).toEqual(new Set(["X-1", "X-2"]));
  });

  it("mergeHeuristicIntoMapped no duplica cuando mappedAssets contiene el mismo id dos veces", () => {
    const makeAsset = (id: string, prov: string): Asset => ({
      id,
      cat: "—", prov, pob: "—", cp: "—", addr: "—",
      tip: "Vivienda", tipC: "tp-viv", fase: "—", faseC: "fp-nd",
      precio: null, fav: false, chk: false, sqm: null,
      tvia: "—", nvia: "—", num: "—", esc: "—", pla: "—", pta: "—",
      map: "", catRef: "—", clase: "—", uso: "—", bien: "—",
      supC: "—", supG: "—", coef: "—", ccaa: "—",
      fullAddr: "—", desc: "—",
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm: {
        pip: "—", lin: "—", cat: "—", car: "—", cli: "—", id1: "—", con: "—", aid: id, loans: "—",
        tcol: "—", scol: "—", ccaa: "—", prov: "—", city: "—", zip: "—", addr: "—", finca: "—", reg: "—",
        cref: "—", ejud: "—", ejmap: "—", eneg: "—", ob: "—", sub: "—", deu: "—", cprev: "—", cpost: "—",
        dtot: "—", pest: "—", str: "—", liq: "—", avj: "—", mmap: "—", buck: "—", lbuck: "—", smf: "—",
        rsub: "—", conn: "—", conn2: "—",
      } satisfies AssetAdmin,
      pub: false,
    });
    const merged = mergeHeuristicIntoMapped(
      [makeAsset("A", "Madrid"), makeAsset("A", "Barcelona"), makeAsset("B", "Sevilla")],
      [],
    );
    expect(merged.length).toBe(2);
    expect(merged.map(a => a.id).sort()).toEqual(["A", "B"]);
  });

  it("dedupAssetsByIdWithCount reporta el conteo de duplicatas", () => {
    const make = (id: string): Asset => ({
      id,
      cat: "—", prov: "—", pob: "—", cp: "—", addr: "—",
      tip: "Vivienda", tipC: "tp-viv", fase: "—", faseC: "fp-nd",
      precio: null, fav: false, chk: false, sqm: null,
      tvia: "—", nvia: "—", num: "—", esc: "—", pla: "—", pta: "—",
      map: "", catRef: "—", clase: "—", uso: "—", bien: "—",
      supC: "—", supG: "—", coef: "—", ccaa: "—",
      fullAddr: "—", desc: "—",
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm: {
        pip: "—", lin: "—", cat: "—", car: "—", cli: "—", id1: "—", con: "—", aid: id, loans: "—",
        tcol: "—", scol: "—", ccaa: "—", prov: "—", city: "—", zip: "—", addr: "—", finca: "—", reg: "—",
        cref: "—", ejud: "—", ejmap: "—", eneg: "—", ob: "—", sub: "—", deu: "—", cprev: "—", cpost: "—",
        dtot: "—", pest: "—", str: "—", liq: "—", avj: "—", mmap: "—", buck: "—", lbuck: "—", smf: "—",
        rsub: "—", conn: "—", conn2: "—",
      } satisfies AssetAdmin,
      pub: false,
    });
    const { assets, duplicates } = dedupAssetsByIdWithCount([
      make("A"), make("A"), make("A"), make("B"), make("C"), make("C"),
    ]);
    expect(assets.length).toBe(3);
    expect(duplicates.get("A")).toBe(3);
    expect(duplicates.get("C")).toBe(2);
    expect(duplicates.has("B")).toBe(false);
  });

  it("filas con ID vacío son contadas en (rows - parsed) para diagnóstico", async () => {
    const header = [
      "Data Ref", "Portfolio", "UF", "Main Local", "Lien", "ID Prinex", "ID Prinex Corto",
      "CD Referencia Catastral", "Dirección Completa", "CP", "Municipio", "Provincia",
      "CCAA", "Tipo Inmueble", "Juzgado", "Código Proc", "Última Fase", "Importe Reclamado", "Tasación",
    ];
    const goodRow = ["2024-01-01", "P", "ID-OK", "x", "x", "x", "x", "ref", "addr", "28001", "M", "M", "M", "Vivienda", "j", "p", "f", 100, 90];
    const badRow = ["2024-01-01", "P", "", "x", "x", "x", "x", "ref", "addr", "28001", "M", "M", "M", "Vivienda", "j", "p", "f", 100, 90];
    const file = makeXlsxFile({ "Proveedor 1": [header, goodRow, badRow] });
    const result = (await parseExcelFile(file, { diag: true })) as ParseExcelResult;
    const diag = result.sheetDiag[0];
    expect(diag.rows).toBe(2);
    expect(diag.parsed).toBe(1);
  });
});
