import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/types";
import {
  buildCatFilterOptions,
  buildProvFilterOptions,
  buildPobFilterOptions,
  buildTipFilterOptions,
  buildFaseFilterOptions,
  assetMatchesListFilters,
  matchesFilterValue,
  uniqueFilterOptions,
  type AssetListFilters,
} from "@/lib/asset-filters";

const SHARED_FILTER_SYMBOLS = [
  "buildCatFilterOptions",
  "buildProvFilterOptions",
  "buildPobFilterOptions",
  "buildTipFilterOptions",
  "buildFaseFilterOptions",
  "assetMatchesListFilters",
] as const;

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "ASSET-1",
    cat: "NPL",
    prov: "Alicante",
    pob: "Alicante",
    cp: "03001",
    addr: "C/ Test",
    tip: "PISO",
    tipC: "tp-piso",
    fase: "Publicado",
    faseC: "fp-pub",
    precio: 100000,
    fav: false,
    chk: false,
    sqm: 80,
    tvia: "CALLE",
    nvia: "TEST",
    num: "1",
    esc: "—",
    pla: "—",
    pta: "—",
    map: null,
    lat: null,
    lng: null,
    catRef: "—",
    clase: "URBANO",
    uso: "Residencial",
    bien: "VIVIENDA",
    supC: "80 m²",
    supG: "—",
    coef: "—",
    ccaa: "Comunidad Valenciana",
    fullAddr: "C/ Test, Alicante",
    desc: "—",
    ownerName: "—",
    ownerTel: "—",
    ownerMail: "—",
    adm: {
      pip: "—",
      lin: "—",
      cat: "NPL",
      car: "—",
      cli: "—",
      id1: "—",
      con: "—",
      aid: "ASSET-1",
      loans: "—",
      tcol: "—",
      scol: "—",
      ccaa: "—",
      prov: "—",
      city: "—",
      zip: "—",
      addr: "—",
      finca: "—",
      reg: "—",
      cref: "—",
      ejud: "—",
      ejmap: "—",
      eneg: "—",
      ob: "—",
      sub: "—",
      deu: "—",
      cprev: "—",
      cpost: "—",
      dtot: "—",
      pest: "—",
      str: "—",
      liq: "—",
      avj: "—",
      mmap: "—",
      buck: "—",
      lbuck: "—",
      smf: "—",
      rsub: "—",
      conn: "—",
      conn2: "—",
    },
    pub: true,
    ...overrides,
  } as Asset;
}

/** Réplica de cómo /admin y /portal construyen sus listas filtradas. */
function filterAdminAssets(assets: Asset[], filters: AssetListFilters): Asset[] {
  return assets.filter((a) => assetMatchesListFilters(a, filters));
}

function filterPortalAssets(assets: Asset[], filters: AssetListFilters): Asset[] {
  const publicAssets = assets.filter((a) => a.pub);
  return publicAssets.filter((a) => assetMatchesListFilters(a, filters));
}

function buildAdminFilterOptions(assets: Asset[], fProv = "") {
  return {
    cat: buildCatFilterOptions(assets),
    prov: buildProvFilterOptions(assets),
    pob: buildPobFilterOptions(assets, fProv),
    tip: buildTipFilterOptions(assets),
    fase: buildFaseFilterOptions(assets),
  };
}

function buildPortalFilterOptions(assets: Asset[], fProv = "") {
  const publicAssets = assets.filter((a) => a.pub);
  return {
    cat: buildCatFilterOptions(publicAssets),
    prov: buildProvFilterOptions(publicAssets),
    pob: buildPobFilterOptions(publicAssets, fProv),
    tip: buildTipFilterOptions(publicAssets),
    fase: buildFaseFilterOptions(publicAssets),
  };
}

const FIXTURE_ASSETS: Asset[] = [
  makeAsset({ id: "A1", cat: "NPL", prov: "Alicante", pob: "Alicante", tip: "piso", fase: "Publicado", pub: true }),
  makeAsset({ id: "A2", cat: "REO", prov: "ALICANTE", pob: "ALICANTE/ALACANT", tip: "PISO", fase: "PUBLICADO", pub: true }),
  makeAsset({ id: "A3", cat: "CDR", prov: "A Coruña", pob: "Ferrol", tip: "LOCAL", fase: "En venta", pub: true }),
  makeAsset({ id: "A4", cat: "NPL", prov: "A CORUÑA", pob: "FERROL", tip: "local", fase: "En venta", pub: false }),
  makeAsset({ id: "A5", cat: "NPL", prov: "Albacete", pob: "Bonete", tip: "VIVIENDA", fase: "—", pub: true }),
  makeAsset({ id: "A6", cat: "—", prov: "—", pob: "—", tip: "—", fase: "—", pub: true }),
];

describe("uniqueFilterOptions", () => {
  it("deduplica variantes de provincia y prefiere etiqueta con minúsculas", () => {
    expect(uniqueFilterOptions(["ALICANTE", "Alicante", "A CORUÑA", "A Coruña"])).toEqual([
      "A Coruña",
      "Alicante",
    ]);
  });

  it("ignora valores vacíos y em dash", () => {
    expect(uniqueFilterOptions(["—", "", "  ", "NPL"])).toEqual(["NPL"]);
  });
});

describe("assetMatchesListFilters", () => {
  it("empareja provincia y población sin distinguir mayúsculas ni tildes", () => {
    const asset = makeAsset({ prov: "ALICANTE", pob: "ALICANTE/ALACANT" });
    expect(
      assetMatchesListFilters(asset, { prov: "Alicante", pob: "Alicante/Alacant" }),
    ).toBe(true);
  });

  it("filtra tipología en mayúsculas como en admin", () => {
    const asset = makeAsset({ tip: "piso" });
    expect(assetMatchesListFilters(asset, { tipo: "PISO" })).toBe(true);
    expect(assetMatchesListFilters(asset, { tipo: "LOCAL" })).toBe(false);
  });
});

describe("paridad admin vs portal", () => {
  it("portal devuelve el mismo subconjunto que admin restringido a activos publicados", () => {
    const filters: AssetListFilters = {
      cat: "NPL",
      prov: "Alicante",
      pob: "Alicante",
      tipo: "PISO",
      fase: "Publicado",
    };

    const adminIds = filterAdminAssets(FIXTURE_ASSETS, filters).map((a) => a.id).sort();
    const portalIds = filterPortalAssets(FIXTURE_ASSETS, filters).map((a) => a.id).sort();
    const expectedIds = adminIds.filter((id) => FIXTURE_ASSETS.find((a) => a.id === id)?.pub);

    expect(portalIds).toEqual(expectedIds);
  });

  it("cada opción del portal existe en admin con la misma clave normalizada", () => {
    const admin = buildAdminFilterOptions(FIXTURE_ASSETS, "Alicante");
    const portal = buildPortalFilterOptions(FIXTURE_ASSETS, "Alicante");

    for (const key of ["cat", "prov", "pob", "tip", "fase"] as const) {
      for (const portalOpt of portal[key]) {
        const hasAdminEquivalent = admin[key].some((adminOpt) =>
          key === "tip"
            ? adminOpt.toUpperCase() === portalOpt.toUpperCase()
            : matchesFilterValue(adminOpt, portalOpt),
        );
        expect(hasAdminEquivalent, `portal.${key}="${portalOpt}"`).toBe(true);
      }
    }
  });

  it("genera las mismas opciones deduplicadas cuando el dataset es solo publicado", () => {
    const publishedOnly = FIXTURE_ASSETS.filter((a) => a.pub);
    const admin = buildAdminFilterOptions(publishedOnly);
    const portal = buildPortalFilterOptions(FIXTURE_ASSETS);

    expect(portal).toEqual(admin);
  });

  it("filtra población por provincia con la misma lógica en admin y portal", () => {
    const adminPob = buildPobFilterOptions(FIXTURE_ASSETS, "A Coruña");
    const portalPob = buildPobFilterOptions(
      FIXTURE_ASSETS.filter((a) => a.pub),
      "A CORUÑA",
    );

    expect(portalPob).toEqual(["Ferrol"]);
    expect(adminPob).toEqual(["Ferrol"]);
    expect(portalPob).toEqual(adminPob);
  });
});

describe("páginas admin y portal", () => {
  it.each([
    ["admin", "admin/page.tsx"],
    ["portal", "portal/page.tsx"],
  ] as const)("/%s importa los mismos helpers de asset-filters", (_label, relPath) => {
    const src = readFileSync(resolve(__dirname, "../app", relPath), "utf8");

    expect(src).toContain('@/lib/asset-filters');
    for (const symbol of SHARED_FILTER_SYMBOLS) {
      expect(src, `${relPath} debe importar ${symbol}`).toContain(symbol);
    }
  });
});
