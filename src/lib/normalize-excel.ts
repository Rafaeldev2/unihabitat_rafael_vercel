import type { Asset, AssetAdmin } from "./types";
import * as XLSX from "xlsx";
import { defaultMapUrlForClient } from "./map-default";
import { mergeExcelRawMaps } from "./supabase/db";

function cellRawForMap(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Cabeceras y valores tal como en la hoja (ancho completo, antes/después de offset). */
function buildRawRowFromFullSheet(fullRows: unknown[][], rowIndex: number): Record<string, string> {
  if (rowIndex < 1 || rowIndex >= fullRows.length) return {};
  const header = fullRows[0] as unknown[];
  const row = fullRows[rowIndex] as unknown[];
  const maxLen = Math.max(header.length, row.length);
  const out: Record<string, string> = {};
  for (let c = 0; c < maxLen; c++) {
    const hk = String(header[c] ?? "").trim();
    const key = hk || `Columna ${c + 1}`;
    out[key] = cellRawForMap(row[c]);
  }
  return out;
}

function emptyAdm(): AssetAdmin {
  return {
    pip: "—", lin: "—", cat: "—", car: "—", cli: "—", id1: "—", con: "—", aid: "—", loans: "—",
    tcol: "—", scol: "—", ccaa: "—", prov: "—", city: "—", zip: "—", addr: "—", finca: "—", reg: "—",
    cref: "—", ejud: "—", ejmap: "—", eneg: "—", ob: "—", sub: "—", deu: "—", cprev: "—", cpost: "—",
    dtot: "—", pest: "—", str: "—", liq: "—", avj: "—", mmap: "—", buck: "—", lbuck: "—", smf: "—",
    rsub: "—", conn: "—", conn2: "—",
  };
}

function toNum(v: unknown): number | null {
  if (v == null || v === "" || v === "—") return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (v instanceof Date) return null;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : null;
}

function s(v: unknown): string {
  if (v == null || v === "") return "—";
  if (v instanceof Date) return "—";
  const str = String(v).trim();
  return str || "—";
}

function tipToTipC(tip: string): string {
  const t = tip.toUpperCase();
  if (t.includes("GARAJE") || t.includes("PARKING") || t.includes("GARAGE") || t.includes("PLAZA")) return "tp-park";
  if (t.includes("TRASTERO")) return "tp-tras";
  if (t.includes("LOCAL") || t.includes("COMERCIAL")) return "tp-local";
  return "tp-viv";
}

function faseToFaseC(fase: string): string {
  const f = fase.toUpperCase();
  if (f.includes("DEMANDA") || f.includes("SUBASTA") || f.includes("CONVOCAD") || f.includes("PUBLICAD")) return "fp-pub";
  if (f.includes("SUSPEND") || f.includes("PENDIENTE") || f.includes("NO JUDICIAL")) return "fp-sus";
  if (f.includes("SEGUIMIENTO")) return "fp-seg";
  if (f.includes("RESERV") || f.includes("NEGOCIACI")) return "fp-res";
  return "fp-nd";
}

/** Normaliza valores crudos de tipología (inglés/variantes) al catálogo estándar español. */
export function normalizeTipo(raw: string): string {
  if (!raw || raw === "—") return "Vivienda";
  const u = raw.toUpperCase().trim();
  if (u.includes("PARKING") || u.includes("GARAJE") || u.includes("GARAGE") || u.includes("PLAZA")) return "Garaje";
  if (u.includes("TRASTERO") || u === "STORAGE") return "Trastero";
  if (u.includes("LOCAL") || u.includes("COMERCIAL") || u === "COMMERCIAL") return "Comercial";
  if (u.includes("NAVE")) return "Nave";
  if (u.includes("OFICINA") || u === "OFFICE") return "Oficina";
  if (u.includes("EDIFICIO") || u === "BUILDING") return "Edificio";
  if (u.includes("SUELO INDUSTRIAL") || u === "INDUSTRIAL LAND") return "Suelo Industrial";
  if (u.includes("SUELO") || u === "LAND" || u === "PLOT") return "Suelo";
  if (u.includes("OBRA SIN FINALIZAR") || u.includes("UNFINISHED")) return "Obra Sin Finalizar";
  if (u.includes("CASA") || u.includes("CHALET") || u === "HOUSE" || u === "DETACHED HOUSE" || u === "TERRACED HOUSE") return "Casa / Chalet";
  if (u.includes("PISO") || u === "FLAT" || u === "APARTMENT") return "Piso";
  if (u.includes("VIVIENDA") || u === "RESIDENTIAL" || u === "DWELLING") return "Vivienda";
  return raw;
}

/**
 * Proveedor 1 — columnas fijas:
 * 0=Data Ref, 1=Portfolio, 2=UF, 3=Main Local, 4=Lien, 5=ID Prinex, 6=ID Prinex Corto,
 * 7=CD Referencia Catastral, 8=Dirección Completa, 9=CP, 10=Municipio, 11=Provincia,
 * 12=CCAA, 13=Tipo Inmueble, 14=Juzgado, 15=Código Proc., 16=Última Fase, 17=Importe Reclamado, 18=Tasación
 */
function parseProveedor1(rows: unknown[][], defaultMap: string, sheetLabel: string, fullRows: unknown[][]): Asset[] {
  const assets: Asset[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const id = s(row[2]);      // UF
    if (!id || id === "—") continue;
    const raw = buildRawRowFromFullSheet(fullRows, r);
    const portfolio = s(row[1]);
    const catRef = s(row[7]);
    const fullAddr = s(row[8]);
    const cp = s(row[9]);
    const pob = s(row[10]);
    const prov = s(row[11]);
    const ccaa = s(row[12]);
    const tip = s(row[13]);
    const fase = s(row[16]);
    const precio = toNum(row[17]) ?? toNum(row[18]);

    const adm = emptyAdm();
    adm.car = portfolio;
    adm.aid = id;
    adm.cref = catRef;
    adm.addr = fullAddr;
    adm.prov = prov.toUpperCase();
    adm.city = pob;
    adm.zip = cp;
    adm.ccaa = ccaa.toUpperCase();
    adm.ejmap = fase;
    adm.deu = precio != null ? `${precio.toLocaleString("es-ES")} €` : "—";
    adm.dtot = adm.deu;

    assets.push({
      id, cat: "—",
      prov, pob, cp, addr: fullAddr,
      tip, tipC: tipToTipC(tip),
      fase, faseC: faseToFaseC(fase),
      precio, fav: false, chk: false, sqm: null,
      tvia: "—", nvia: "—", num: "—", esc: "—", pla: "—", pta: "—",
      map: defaultMap, catRef,
      clase: "—", uso: "—", bien: tip,
      supC: "—", supG: "—", coef: "—", ccaa,
      fullAddr, desc: fullAddr,
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm, pub: false,
      excelRaw: { [sheetLabel]: raw },
    });
  }
  return assets;
}

/**
 * Proveedor 2 — columnas fijas:
 * 0=ID PIPEDRIVE, 1=ID LINKEDIN, 2=CATEGORIA, 3=Cart., 4=CLIENTE, 5=Connection ID,
 * 6=Contract ID, 7=Asset ID, 8=Nº Loans, 9=Type of Collateral, 10=Subtype of Collateral,
 * 11=CCAA, 12=Asset Province, 13=Asset City, 14=ZIP Code, 15=Asset Address, 16=Nº Finca,
 * 17=Nº Registro, 18=Cadastral Reference, 19=Estado Judicial, 20=Estado Judicial Mapeo,
 * 21=Estado Negociación, 22=OB, 23=TIPO_SUBASTA, 24=DEU_TOT, 25=CARGAS PREVIAS,
 * 26=CARGAS POSTERIORES, 27=Connection Aux, 28=DEUDA TOTAL, 29=PRECIO ESTIMADO,
 * 30=MAIN STRATEGY, 31=LIQUIDEZ, 32=AVANCE JUDICIAL, 33=Mapeo Municipios,
 * 34=BUCKET LIQUIDEZ, 35=LOCALIZACIÓN BUCKETS, 36=STATUS MF, 37=Resultado Subasta,
 * 38=CONTACT - ASSET, 39=CONN - CONTRACT - ASSET
 */
function parseProveedor2(rows: unknown[][], defaultMap: string, sheetLabel: string, fullRows: unknown[][]): Asset[] {
  const assets: Asset[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const id = s(row[7]);  // Asset ID
    if (!id || id === "—") continue;
    const raw = buildRawRowFromFullSheet(fullRows, r);
    const cat = s(row[2]);
    const cartera = s(row[3]);
    const ccaa = s(row[11]);
    const prov = s(row[12]);
    const city = s(row[13]);
    const zip = s(row[14]);
    const addr = s(row[15]);
    const catRef = s(row[18]);
    const ejud = s(row[19]);
    const ejmap = s(row[20]);
    const eneg = s(row[21]);
    const ob = toNum(row[22]);
    const sub = s(row[23]);
    const deuTot = toNum(row[24]);
    const cprev = toNum(row[25]);
    const cpost = toNum(row[26]);
    const deudaTotal = toNum(row[28]);
    const precioEst = toNum(row[29]);
    const precio = precioEst ?? deudaTotal;
    const tcol = s(row[9]);
    const scol = s(row[10]);
    const tip = normalizeTipo(scol);

    const adm = emptyAdm();
    adm.pip = s(row[0]);
    adm.lin = s(row[1]);
    adm.cat = cat;
    adm.car = cartera;
    adm.cli = s(row[4]);
    adm.id1 = s(row[5]);
    adm.con = s(row[6]);
    adm.aid = id;
    adm.loans = s(row[8]);
    adm.tcol = tcol;
    adm.scol = scol;
    adm.ccaa = ccaa.toUpperCase();
    adm.prov = prov.toUpperCase();
    adm.city = city;
    adm.zip = zip;
    adm.addr = addr;
    adm.finca = s(row[16]);
    adm.reg = s(row[17]);
    adm.cref = catRef;
    adm.ejud = ejud;
    adm.ejmap = ejmap;
    adm.eneg = eneg;
    adm.ob = ob != null ? `${ob.toLocaleString("es-ES")} €` : "—";
    adm.sub = sub;
    adm.deu = deuTot != null ? `${deuTot.toLocaleString("es-ES")} €` : "—";
    adm.cprev = cprev != null ? `${cprev.toLocaleString("es-ES")} €` : "—";
    adm.cpost = cpost != null ? `${cpost.toLocaleString("es-ES")} €` : "—";
    adm.dtot = deudaTotal != null ? `${deudaTotal.toLocaleString("es-ES")} €` : "—";
    adm.pest = precioEst != null ? `${precioEst.toLocaleString("es-ES")} €` : "—";
    adm.str = s(row[30]);
    adm.liq = s(row[31]);
    adm.avj = s(row[32]);
    adm.mmap = s(row[33]);
    adm.buck = s(row[34]);
    adm.lbuck = s(row[35]);
    adm.smf = s(row[36]);
    adm.rsub = s(row[37]);
    adm.conn = s(row[38]);
    adm.conn2 = s(row[39]);

    assets.push({
      id, cat,
      prov, pob: city, cp: zip, addr,
      tip, tipC: tipToTipC(tip),
      fase: ejmap, faseC: faseToFaseC(ejmap),
      precio, fav: false, chk: false, sqm: null,
      tvia: "—", nvia: "—", num: "—", esc: "—", pla: "—", pta: "—",
      map: defaultMap, catRef,
      clase: "—", uso: tcol, bien: scol,
      supC: "—", supG: "—", coef: "—", ccaa,
      fullAddr: addr, desc: addr,
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm, pub: false,
      excelRaw: { [sheetLabel]: raw },
    });
  }
  return assets;
}

/**
 * Proveedor 3 — columnas fijas:
 * 0=Cartera, 1=NDG, 2=reference_code, 3=parcel, 4=property_type, 5=province,
 * 6=city, 7=ADRESS, 8=Nº, 9=ZIP, 10=SQM, 11=REFERENCIA CATASTRAL,
 * 12=GVB, 13=AUCTION BASE, 14=legaltype, 15=legalphase, 16=Nuevo, 17=ref cat
 */
function parseProveedor3(rows: unknown[][], defaultMap: string, sheetLabel: string, fullRows: unknown[][]): Asset[] {
  const assets: Asset[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const id = s(row[1]);  // NDG
    if (!id || id === "—") continue;
    const raw = buildRawRowFromFullSheet(fullRows, r);
    const cartera = s(row[0]);
    const propType = s(row[4]);
    const prov = s(row[5]);
    const city = s(row[6]);
    const adress = s(row[7]);
    const num = s(row[8]);
    const zip = s(row[9]);
    const sqm = toNum(row[10]);
    const catRef = s(row[11]) !== "—" ? s(row[11]) : s(row[17]);
    const gvb = toNum(row[12]);
    const legalphase = s(row[15]);

    const tip = normalizeTipo(propType);

    const numStr = num !== "—" ? ` ${num}` : "";
    const fullAddr = [adress + numStr, zip, city].filter(v => v && v !== "—").join(", ");

    const adm = emptyAdm();
    adm.car = cartera;
    adm.aid = id;
    adm.cref = catRef;
    adm.prov = prov.toUpperCase();
    adm.city = city;
    adm.zip = zip;
    adm.addr = adress + numStr;
    adm.deu = gvb != null ? `${gvb.toLocaleString("es-ES")} €` : "—";
    adm.dtot = adm.deu;
    adm.pest = adm.deu;
    adm.ejmap = legalphase;

    assets.push({
      id, cat: "—",
      prov, pob: city, cp: zip, addr: fullAddr,
      tip, tipC: tipToTipC(tip),
      fase: legalphase, faseC: faseToFaseC(legalphase),
      precio: gvb, fav: false, chk: false, sqm,
      tvia: "—", nvia: adress, num, esc: "—", pla: "—", pta: "—",
      map: defaultMap, catRef,
      clase: "—", uso: "—", bien: tip,
      supC: sqm != null ? `${sqm} m²` : "—",
      supG: "—", coef: "—", ccaa: "—",
      fullAddr, desc: fullAddr,
      ownerName: "—", ownerTel: "—", ownerMail: "—",
      adm, pub: false,
      excelRaw: { [sheetLabel]: raw },
    });
  }
  return assets;
}

/**
 * Enriquecido — columnas fijas:
 * 0=Referencia, 1=Clase, 2=Uso, 3=Bien, 4=Provincia, 5=Municipio, 6=CP,
 * 7=Dirección Completa, 8=Tipo de Vía, 9=Nombre de Vía, 10=Número, 11=Escalera,
 * 12=Planta, 13=Puerta, 14=Sup. Construida, 15=Sup. Gráfica, 16=Longitud, 17=Latitud,
 * 18=Antigüedad, 19=Coeficiente, 20=Descripción Activo, 21=URL Imagen
 */
function parseEnriquecido(rows: unknown[][], defaultMap: string): Map<string, Partial<Asset>> {
  const geoKey = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim() ?? "" : "";
  const byRef = new Map<string, Partial<Asset>>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const ref = s(row[0]);
    if (!ref || ref === "—") continue;
    const lat = s(row[17]);
    const lon = s(row[16]);
    const supC = toNum(row[14]);
    const supG = toNum(row[15]);
    const urlImg = s(row[21]);
    const mapUrl =
      urlImg !== "—" && urlImg.startsWith("http")
        ? urlImg
        : lat !== "—" && lon !== "—" && geoKey
          ? `https://maps.geoapify.com/v1/staticmap?center=lonlat:${lon},${lat}&zoom=15&width=600&height=400&style=osm-bright&apiKey=${encodeURIComponent(geoKey)}`
          : lat !== "—" && lon !== "—"
            ? `https://staticmap.openstreetmap.de/staticmap?center=${encodeURIComponent(lat)},${encodeURIComponent(lon)}&zoom=15&size=600x400`
            : defaultMap;

    const latNum = toNum(row[17]);
    const lonNum = toNum(row[16]);

    byRef.set(ref, {
      catRef: ref,
      clase: s(row[1]),
      uso: s(row[2]),
      bien: s(row[3]),
      prov: s(row[4]),
      pob: s(row[5]),
      cp: s(row[6]),
      fullAddr: s(row[7]),
      tvia: s(row[8]),
      nvia: s(row[9]),
      num: s(row[10]),
      esc: s(row[11]),
      pla: s(row[12]),
      pta: s(row[13]),
      supC: supC != null ? `${supC} m²` : "—",
      supG: supG != null ? `${supG} m²` : "—",
      sqm: supC,
      age: s(row[18]),
      coef: s(row[19]),
      desc: s(row[20]),
      map: mapUrl,
      lat: latNum,
      lng: lonNum,
    });
  }
  return byRef;
}

function enrichAssets(assets: Asset[], enriquecido: Map<string, Partial<Asset>>): Asset[] {
  return assets.map(a => {
    const enr = enriquecido.get(a.catRef) ?? enriquecido.get(a.adm.cref);
    if (!enr) return a;
    return { ...a, ...enr, adm: { ...a.adm, cref: enr.catRef ?? a.adm.cref } } as Asset;
  });
}

function isEmptyAdmVal(v: string): boolean {
  return v === "—" || v === "" || v == null;
}

/** Une dos bloques adm: gana el valor “útil” de cualquiera de los dos (misma fila en varias hojas). */
function mergeAdmPreferNonEmpty(a: AssetAdmin, b: AssetAdmin): AssetAdmin {
  const keys = Object.keys(a) as (keyof AssetAdmin)[];
  const out = { ...a };
  for (const k of keys) {
    const av = String(a[k]);
    const bv = String(b[k]);
    if (!isEmptyAdmVal(bv)) out[k] = b[k];
    else if (!isEmptyAdmVal(av)) out[k] = a[k];
    else out[k] = "—";
  }
  return out;
}

/** Mismo activo (id) aparece en varias hojas: combinar sin perder CRM de Proveedor 2 ni datos de 1/3. */
function mergeAssetsSameId(prev: Asset, curr: Asset): Asset {
  const adm = mergeAdmPreferNonEmpty(prev.adm, curr.adm);
  const excelRaw = mergeExcelRawMaps(prev.excelRaw, curr.excelRaw);
  const pickStr = (p: string, c: string) => (c && c !== "—" ? c : p && p !== "—" ? p : c || p || "—");
  return {
    ...prev,
    ...curr,
    cat: pickStr(prev.cat, curr.cat),
    prov: pickStr(prev.prov, curr.prov),
    pob: pickStr(prev.pob, curr.pob),
    cp: pickStr(prev.cp, curr.cp),
    addr: pickStr(prev.addr, curr.addr),
    tip: pickStr(prev.tip, curr.tip),
    fase: pickStr(prev.fase, curr.fase),
    tipC: curr.tip && curr.tip !== "—" ? curr.tipC : prev.tipC,
    faseC: curr.fase && curr.fase !== "—" ? curr.faseC : prev.faseC,
    precio: curr.precio != null ? curr.precio : prev.precio,
    sqm: curr.sqm != null ? curr.sqm : prev.sqm,
    catRef: pickStr(prev.catRef, curr.catRef),
    desc: pickStr(prev.desc, curr.desc),
    ccaa: pickStr(prev.ccaa, curr.ccaa),
    fullAddr: pickStr(prev.fullAddr, curr.fullAddr),
    map: curr.map && curr.map !== prev.map ? curr.map : prev.map || curr.map,
    adm,
    ...(excelRaw ? { excelRaw } : {}),
  };
}

type SheetFormat = "prov1" | "prov2" | "prov3" | "enriquecido" | "unknown";

/**
 * Heurística de columnas: dado el header crudo de una hoja, devuelve un mapa
 * { campoAsset → índiceColumna }. Cubre los nombres de cabecera más comunes
 * en español e inglés (UF, NDG, Asset ID, Provincia, Municipio, CP, Dirección,
 * Tipo, Precio, Referencia Catastral, Cartera, Cliente, etc.).
 *
 * No reemplaza al parser estructurado — se usa como red de seguridad para
 * rellenar campos que quedaron en "—" cuando el archivo trae columnas
 * reordenadas o con nombres ligeramente distintos.
 */
type HeaderField =
  | "id" | "addr" | "fullAddr" | "prov" | "pob" | "cp" | "ccaa"
  | "tip" | "fase" | "precio" | "sqm" | "catRef" | "clase" | "uso" | "bien"
  | "ownerName" | "ownerTel" | "ownerMail"
  | "car" | "cli" | "pip" | "pub" | "ejud" | "eneg" | "cat";

function inferHeaderColumns(headerRow: unknown[]): Partial<Record<HeaderField, number>> {
  const cols: Partial<Record<HeaderField, number>> = {};
  const set = (k: HeaderField, idx: number) => { if (cols[k] === undefined) cols[k] = idx; };

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").toUpperCase().trim();
    if (!h) continue;

    if (cols.id === undefined && /\b(UF|NDG|ASSET ID|ID PRINEX|ID ACTIVO|REFERENCIA(?! CATASTRAL)|CONTRACT ID|DATA REF|^ID$|^ID\s|CODIGO ACTIVO)\b/.test(h)) {
      set("id", c);
      continue;
    }
    if (/(REFERENCIA CATASTRAL|CAT\.? ?REF|CD REFERENCIA|CADASTRAL)/.test(h)) set("catRef", c);
    else if (/(DIRECCION COMPLETA|DIRECCIÓN COMPLETA|DIR\. COMPLETA|FULL ADDRESS)/.test(h)) set("fullAddr", c);
    else if (/^DIRECCION$|^DIRECCIÓN$|^ADDR(ESS)?$|^DOMICILIO$|^ADRESS$|^DIRECCION_/.test(h)) set("addr", c);
    else if (/^PROV(INCIA|INCE)?$|ASSET PROVINCE|^PROV\s/.test(h)) set("prov", c);
    else if (/^MUNICIPIO$|^POBLACION$|^POBLACIÓN$|^CIUDAD$|^LOCALIDAD$|^CITY$|^TOWN$|MUNICIPI/.test(h)) set("pob", c);
    else if (/(CODIGO POSTAL|CÓDIGO POSTAL|^CP$|POSTAL CODE|^ZIP$|C\.P\.|^CP\s)/.test(h)) set("cp", c);
    else if (/^CCAA$|COMUNIDAD AUTONOMA|COMUNIDAD AUTÓNOMA/.test(h)) set("ccaa", c);
    else if (/^TIPO( INMUEBLE)?$|TIPOLOGIA|TIPOLOGÍA|^TYPE$|PROPERTY TYPE/.test(h)) set("tip", c);
    else if (/(^FASE$|ESTADO PROCESO|PROCEDIMIENTO|ULTIMA FASE|ÚLTIMA FASE|FASE JUDICIAL|^STATUS$)/.test(h)) set("fase", c);
    else if (/(PRECIO|IMPORTE|VALOR|^PRICE$|TASACI[OÓ]N|SUBASTA|VALOR ESTIMADO)/.test(h)) set("precio", c);
    else if (/(M2|M²|SUPERFICIE|^SQM$|AREA(?! BASE)|METROS)/.test(h)) set("sqm", c);
    else if (/^CLASE$|^CLASS$/.test(h)) set("clase", c);
    else if (/^USO$|^USE$/.test(h)) set("uso", c);
    else if (/^BIEN$|^GOOD$|^PROPERTY$/.test(h)) set("bien", c);
    else if (/(PROPIETARIO|OWNER NAME|^OWNER$|^NOMBRE$|TITULAR)/.test(h)) set("ownerName", c);
    else if (/(TELEFONO|TELÉFONO|^TEL$|^PHONE$|MOVIL|MÓVIL)/.test(h)) set("ownerTel", c);
    else if (/(EMAIL|CORREO|MAIL)/.test(h)) set("ownerMail", c);
    else if (/(CARTERA|PORTFOLIO)/.test(h)) set("car", c);
    else if (/(CLIENTE|^CLIENT$)/.test(h)) set("cli", c);
    else if (/(PIPEDRIVE)/.test(h)) set("pip", c);
    else if (/(PUBLICAR|PUBLICADO|PUBLISH)/.test(h)) set("pub", c);
    else if (/(JUZGADO|JUDICIAL|EJECUCION|EJECUCIÓN)/.test(h)) set("ejud", c);
    else if (/(NEGOCIACION|NEGOCIACIÓN|NEGOTIATION)/.test(h)) set("eneg", c);
    else if (/(CATEGORIA|CATEGORY|^CAT$|^NPL$|^REO$)/.test(h)) set("cat", c);
  }
  return cols;
}

/**
 * Rellena (sin sobrescribir) los campos del Asset que quedaron en "—" usando
 * los valores que aparecen en la fila bajo la columna inferida por header.
 * Conservador: nunca pisa un valor real ya extraído por el parser estructurado.
 */
function augmentAssetFromHeaders(
  asset: Asset,
  cols: Partial<Record<HeaderField, number>>,
  row: unknown[],
): void {
  const cell = (key: HeaderField): string => {
    const idx = cols[key];
    if (idx == null) return "";
    return s(row[idx]);
  };
  const isMissing = (v: unknown): boolean =>
    v == null || v === "" || v === "—" || (typeof v === "string" && v.trim() === "");

  if (isMissing(asset.addr)) {
    const v = cell("addr") || cell("fullAddr");
    if (v && v !== "—") asset.addr = v;
  }
  if (isMissing(asset.fullAddr)) {
    const v = cell("fullAddr") || cell("addr");
    if (v && v !== "—") asset.fullAddr = v;
  }
  if (isMissing(asset.prov)) {
    const v = cell("prov");
    if (v && v !== "—") asset.prov = v;
  }
  if (isMissing(asset.pob)) {
    const v = cell("pob");
    if (v && v !== "—") asset.pob = v;
  }
  if (isMissing(asset.cp)) {
    const v = cell("cp");
    if (v && v !== "—") asset.cp = v;
  }
  if (isMissing(asset.ccaa)) {
    const v = cell("ccaa");
    if (v && v !== "—") asset.ccaa = v;
  }
  if (isMissing(asset.catRef)) {
    const v = cell("catRef");
    if (v && v !== "—") {
      asset.catRef = v;
      if (isMissing(asset.adm.cref)) asset.adm.cref = v;
    }
  }
  if (isMissing(asset.clase)) {
    const v = cell("clase");
    if (v && v !== "—") asset.clase = v;
  }
  if (isMissing(asset.uso)) {
    const v = cell("uso");
    if (v && v !== "—") asset.uso = v;
  }
  if (isMissing(asset.bien)) {
    const v = cell("bien");
    if (v && v !== "—") asset.bien = v;
  }
  if (asset.precio == null) {
    const v = cell("precio");
    const n = toNum(v);
    if (n != null) asset.precio = n;
  }
  if (asset.sqm == null) {
    const v = cell("sqm");
    const n = toNum(v);
    if (n != null) asset.sqm = n;
  }
  if (isMissing(asset.tip) || asset.tip === "Vivienda") {
    const v = cell("tip");
    if (v && v !== "—") {
      const norm = normalizeTipo(v);
      asset.tip = norm;
      asset.tipC = tipToTipC(norm);
    }
  }
  if (isMissing(asset.ownerName)) {
    const v = cell("ownerName");
    if (v && v !== "—") asset.ownerName = v;
  }
  if (isMissing(asset.ownerTel)) {
    const v = cell("ownerTel");
    if (v && v !== "—") asset.ownerTel = v;
  }
  if (isMissing(asset.ownerMail)) {
    const v = cell("ownerMail");
    if (v && v !== "—") asset.ownerMail = v;
  }
  if (isMissing(asset.cat)) {
    const v = cell("cat");
    if (v && v !== "—") asset.cat = v;
  }
  // adm fields
  if (isMissing(asset.adm.car)) {
    const v = cell("car");
    if (v && v !== "—") asset.adm.car = v;
  }
  if (isMissing(asset.adm.cli)) {
    const v = cell("cli");
    if (v && v !== "—") asset.adm.cli = v;
  }
  if (isMissing(asset.adm.pip)) {
    const v = cell("pip");
    if (v && v !== "—") asset.adm.pip = v;
  }
  if (isMissing(asset.adm.ejud)) {
    const v = cell("ejud");
    if (v && v !== "—") asset.adm.ejud = v;
  }
  if (isMissing(asset.adm.eneg)) {
    const v = cell("eneg");
    if (v && v !== "—") asset.adm.eneg = v;
  }
  // Pub
  const pubVal = cell("pub").toUpperCase().trim();
  if (["SI", "SÍ", "SIM", "YES", "TRUE", "1"].includes(pubVal)) {
    asset.pub = true;
    asset.fase = "Publicado";
    asset.faseC = "fp-pub";
  }
}

const FORMAT_ANCHORS: { format: SheetFormat; col0: string; verify: string[] }[] = [
  { format: "prov2", col0: "ID PIPEDRIVE", verify: ["ASSET ID", "ASSET PROVINCE"] },
  { format: "prov1", col0: "DATA REF",     verify: ["UF", "PROVINCIA"] },
  { format: "prov3", col0: "CARTERA",      verify: ["NDG", "ADRESS"] },
  { format: "enriquecido", col0: "REFERENCIA", verify: ["CLASE", "USO", "BIEN"] },
];

function detectFormatByHeader(header: unknown[]): { format: SheetFormat; offset: number } {
  const upper = header.map(h => String(h ?? "").toUpperCase().trim());

  for (const { format, col0, verify } of FORMAT_ANCHORS) {
    const idx = upper.findIndex(h => h.includes(col0));
    if (idx === -1) continue;
    const rest = upper.slice(idx);
    if (verify.every(k => rest.some(h => h.includes(k)))) {
      return { format, offset: idx };
    }
  }
  return { format: "unknown", offset: 0 };
}

function shiftRows(rows: unknown[][], offset: number): unknown[][] {
  if (offset === 0) return rows;
  return rows.map(r => (r as unknown[]).slice(offset));
}

export interface ParseExcelResult {
  assets: Asset[];
  sheetDiag: { sheet: string; format: SheetFormat; rows: number }[];
}

/**
 * Fallback sin Claude: parsea cualquier hoja Excel usando ÚNICAMENTE la
 * heurística de cabeceras (inferHeaderColumns). Pensado para cuando el
 * formato no encaja con ningún proveedor conocido y la detección IA no está
 * disponible (clave inválida, sin internet, etc.).
 *
 * Para cada fila no vacía produce un Asset:
 *  - id desde la columna inferida como id; si no hay, "RAW-{sheet}-{row}"
 *  - estructura mínima rellenada desde cabeceras (prov, pob, cp, addr,
 *    catRef, tip, precio, etc.)
 *  - fila completa preservada en excelRaw
 *
 * Garantía: nunca devuelve [] si el archivo tenía filas con datos. Cada
 * fila se guarda — el usuario puede re-mapear desde la sección "Datos Excel".
 */
export function parseExcelHeuristic(
  file: File,
): Promise<{ assets: Asset[]; totalRows: number; sheets: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const defaultMap = defaultMapUrlForClient();
        const assets: Asset[] = [];
        const sheets: string[] = [];
        let totalRows = 0;

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          });
          if (rows.length < 2) continue;
          sheets.push(sheetName);

          const headerRow = rows[0] as unknown[];
          const cols = inferHeaderColumns(headerRow);

          const sheetSlug = sheetName
            .toUpperCase()
            .replace(/\s+/g, "-")
            .replace(/[^A-Z0-9-]/g, "")
            .slice(0, 32) || "SHEET";

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as unknown[];
            const isEmpty = row.every((c) => c == null || String(c).trim() === "");
            if (isEmpty) continue;
            totalRows++;

            const cell = (key: HeaderField): string => {
              const idx = cols[key];
              if (idx == null) return "";
              return s(row[idx]);
            };

            const explicitId = cell("id");
            const firstNonEmpty = row
              .map((c) => String(c ?? "").trim())
              .find((c) => c !== "");
            const id =
              explicitId && explicitId !== "—" && explicitId.length <= 64
                ? explicitId
                : firstNonEmpty && firstNonEmpty.length <= 64
                  ? firstNonEmpty
                  : `RAW-${sheetSlug}-${r}`;

            const raw = buildRawRowFromFullSheet(rows, r);

            const tipRaw = cell("tip");
            const tip = tipRaw ? normalizeTipo(tipRaw) : "Vivienda";
            const faseRaw = cell("fase");
            const pubVal = cell("pub").toUpperCase().trim();
            const isPub = ["SI", "SÍ", "SIM", "YES", "TRUE", "1"].includes(pubVal);

            const prov = cell("prov");
            const pob = cell("pob");
            const cp = cell("cp");
            const addr = cell("addr");
            const fullAddr = cell("fullAddr");
            const catRef = cell("catRef");
            const ccaa = cell("ccaa");

            const adm = emptyAdm();
            adm.aid = id;
            const carRaw = cell("car"); if (carRaw && carRaw !== "—") adm.car = carRaw;
            const cliRaw = cell("cli"); if (cliRaw && cliRaw !== "—") adm.cli = cliRaw;
            const pipRaw = cell("pip"); if (pipRaw && pipRaw !== "—") adm.pip = pipRaw;
            const ejudRaw = cell("ejud"); if (ejudRaw && ejudRaw !== "—") adm.ejud = ejudRaw;
            const enegRaw = cell("eneg"); if (enegRaw && enegRaw !== "—") adm.eneg = enegRaw;
            if (prov && prov !== "—") adm.prov = prov.toUpperCase();
            if (pob && pob !== "—") adm.city = pob;
            if (cp && cp !== "—") adm.zip = cp;
            if (addr && addr !== "—") adm.addr = addr;
            if (catRef && catRef !== "—") adm.cref = catRef;
            const catRaw = cell("cat"); if (catRaw && catRaw !== "—") adm.cat = catRaw;

            assets.push({
              id,
              cat: catRaw || "—",
              prov: prov || "—",
              pob: pob || "—",
              cp: cp || "—",
              addr: addr || fullAddr || "—",
              tip,
              tipC: tipToTipC(tip),
              fase: isPub ? "Publicado" : faseRaw || "Suspendido",
              faseC: isPub ? "fp-pub" : faseToFaseC(faseRaw || ""),
              precio: toNum(cell("precio")),
              fav: false,
              chk: false,
              sqm: toNum(cell("sqm")),
              tvia: "—",
              nvia: "—",
              num: "—",
              esc: "—",
              pla: "—",
              pta: "—",
              map: defaultMap,
              catRef: catRef || "—",
              clase: cell("clase") || "—",
              uso: cell("uso") || "—",
              bien: cell("bien") || "—",
              supC: "—",
              supG: "—",
              coef: "—",
              ccaa: ccaa || "—",
              fullAddr: fullAddr || addr || "—",
              desc: fullAddr || addr || "—",
              ownerName: cell("ownerName") || "—",
              ownerTel: cell("ownerTel") || "—",
              ownerMail: cell("ownerMail") || "—",
              adm,
              pub: isPub,
              excelRaw: { [sheetName]: raw },
            });
          }
        }

        resolve({ assets, totalRows, sheets });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error en parseo heurístico"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}

export function parseExcelFile(file: File): Promise<Asset[]>;
export function parseExcelFile(file: File, opts: { diag: true }): Promise<ParseExcelResult>;
export function parseExcelFile(file: File, opts?: { diag?: boolean }): Promise<Asset[] | ParseExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        if (!data) { reject(new Error("No se pudo leer el archivo")); return; }
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const defaultMap = defaultMapUrlForClient();
        const all: Asset[] = [];
        let enriquecidoMap = new Map<string, Partial<Asset>>();
        const extraColumns = new Map<string, Record<string, string>>();
        const sheetDiag: { sheet: string; format: SheetFormat; rows: number }[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
          if (rows.length < 2) { sheetDiag.push({ sheet: sheetName, format: "unknown", rows: 0 }); continue; }
          const name = sheetName.toUpperCase().replace(/\s+/g, " ").trim();

          let format: SheetFormat = "unknown";
          let offset = 0;

          if (name.includes("PROVEEDOR 1") || name.includes("PROVEEDOR1")) {
            format = "prov1";
          } else if (name.includes("PROVEEDOR 2") || name.includes("PROVEEDOR2")) {
            format = "prov2";
          } else if (name.includes("PROVEEDOR 3") || name.includes("PROVEEDOR3")) {
            format = "prov3";
          } else if (name.includes("ENRIQUECIDO")) {
            format = "enriquecido";
          } else {
            const detected = detectFormatByHeader(rows[0] as unknown[]);
            format = detected.format;
            offset = detected.offset;
          }

          sheetDiag.push({ sheet: sheetName, format, rows: rows.length - 1 });

          const shifted = shiftRows(rows, offset);
          const header = (rows[0] as unknown[]).map(h => String(h ?? "").toUpperCase().trim());

          switch (format) {
            case "prov1":
              all.push(...parseProveedor1(shifted, defaultMap, sheetName, rows));
              break;
            case "prov2": {
              all.push(...parseProveedor2(shifted, defaultMap, sheetName, rows));
              if (offset > 0) {
                for (let r = 1; r < rows.length; r++) {
                  const row = rows[r] as unknown[];
                  const id = s((shifted[r] as unknown[])?.[7]);
                  if (!id || id === "—") continue;
                  const extra: Record<string, string> = {};
                  for (let c = 0; c < offset; c++) {
                    const key = header[c] || `COL${c}`;
                    extra[key] = s(row[c]);
                  }
                  extraColumns.set(id, extra);
                }
              }
              break;
            }
            case "prov3":
              all.push(...parseProveedor3(shifted, defaultMap, sheetName, rows));
              break;
            case "enriquecido":
              enriquecidoMap = parseEnriquecido(shifted, defaultMap);
              break;
            default:
              break;
          }

          // Bug 1 fix: post-pass augmentation. For sheets where the structured
          // parser ran (prov1/2/3) but column ordering or naming caused some
          // fields to land as "—", re-read the row through header heuristics
          // and fill ONLY the gaps. Never overrides values the parser captured.
          if (format !== "unknown" && format !== "enriquecido") {
            const shiftedHeader = (shifted[0] ?? []) as unknown[];
            const cols = inferHeaderColumns(shiftedHeader);
            if (Object.keys(cols).length > 0) {
              const byIdSheet = new Map<string, Asset>();
              for (const a of all) byIdSheet.set(a.id, a);
              for (let r = 1; r < shifted.length; r++) {
                const row = shifted[r] as unknown[];
                if (!row) continue;
                // Identify the row's id via the heuristic header. If parser
                // used a different col, the heuristic should still find it
                // (same header text → same column).
                const idCellIdx = cols.id;
                if (idCellIdx == null) continue;
                const candidateId = s(row[idCellIdx]);
                if (!candidateId || candidateId === "—") continue;
                const asset = byIdSheet.get(candidateId);
                if (!asset) continue;
                augmentAssetFromHeaders(asset, cols, row);
              }
            }
          }
        }

        const enriched = enrichAssets(all, enriquecidoMap);

        const byId = new Map<string, Asset>();
        for (const a of enriched) {
          const prev = byId.get(a.id);
          if (!prev) byId.set(a.id, a);
          else byId.set(a.id, mergeAssetsSameId(prev, a));
        }

        for (const [id, extra] of extraColumns) {
          const asset = byId.get(id);
          if (!asset) continue;
          if (extra.PROPIETARIO && extra.PROPIETARIO !== "—") asset.ownerName = extra.PROPIETARIO;
          if (extra.TELEFONO && extra.TELEFONO !== "—") asset.ownerTel = extra.TELEFONO;
          if (extra.MAIL && extra.MAIL !== "—") asset.ownerMail = extra.MAIL;
          const pubKey = Object.keys(extra).find(k => k.includes("PUBLICAR"));
          if (pubKey) {
            const pv = extra[pubKey].toUpperCase().trim();
            if (pv === "SI" || pv === "SIM" || pv === "SÍ" || pv === "YES" || pv === "TRUE" || pv === "1") {
              asset.pub = true;
            }
          }
          if (extra.CATEGORIA && extra.CATEGORIA !== "—") asset.cat = extra.CATEGORIA;
        }

        // Scan ALL sheets for PUBLICAR column (handles any format, not just prov2 with offset)
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
          if (rows.length < 2) continue;
          const header = (rows[0] as unknown[]).map(h => String(h ?? "").toUpperCase().trim());

          const pubColIdx = header.findIndex(h => h.includes("PUBLICAR"));
          if (pubColIdx === -1) continue;

          // Try to identify the ID column used by this sheet
          const idCandidates = ["UF", "ASSET ID", "NDG", "ID"];
          let idColIdx = -1;
          for (const candidate of idCandidates) {
            const idx = header.findIndex(h => h === candidate || h.includes(candidate));
            if (idx !== -1) { idColIdx = idx; break; }
          }
          if (idColIdx === -1) continue;

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as unknown[];
            const id = s(row[idColIdx]);
            if (!id || id === "—") continue;
            const asset = byId.get(id);
            if (!asset) continue;
            const pubVal = String(row[pubColIdx] ?? "").toUpperCase().trim();
            if (pubVal === "SI" || pubVal === "SIM" || pubVal === "SÍ" || pubVal === "YES" || pubVal === "TRUE" || pubVal === "1") {
              asset.pub = true;
            }
          }
        }

        // Sync pub with fase/faseC: published assets should show "Publicado"
        for (const asset of byId.values()) {
          if (asset.pub) {
            asset.fase = "Publicado";
            asset.faseC = "fp-pub";
          }
        }

        const assets = Array.from(byId.values());
        resolve(opts?.diag ? { assets, sheetDiag } : assets);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error al procesar el Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}

/** Devuelve las primeras `maxRows` filas de cada hoja sin parsear, para enviar a Claude. */
export function extractRawPreview(
  file: File,
  maxRows = 5,
): Promise<{ sheetName: string; rows: string[][] }[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { reject(new Error("No se pudo leer el archivo")); return; }
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const sheets: { sheetName: string; rows: string[][] }[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const all: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
          const rows = all.slice(0, maxRows).map((r) => (r as unknown[]).map((c) => String(c ?? "")));
          if (rows.length > 0) sheets.push({ sheetName, rows });
        }

        resolve(sheets);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error al leer preview del Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Parsea un Excel usando un mapeo de columnas proporcionado por Claude.
 * `mapping` es un diccionario colIndex → fieldName (ej. { 0: "id", 3: "prov", 5: "precio" }).
 * Soporta campos planos de Asset y campos "adm.xxx" para AssetAdmin.
 */
export function parseWithMapping(
  file: File,
  mapping: Record<number, string>,
): Promise<Asset[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { reject(new Error("No se pudo leer el archivo")); return; }
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const defaultMap = defaultMapUrlForClient();
        const assets: Asset[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
          if (rows.length < 2) continue;

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as unknown[];
            const fields: Record<string, string> = {};
            const admFields: Record<string, string> = {};

            for (const [colStr, fieldName] of Object.entries(mapping)) {
              const col = parseInt(colStr, 10);
              const val = s(row[col]);
              if (fieldName.startsWith("adm.")) {
                admFields[fieldName.slice(4)] = val;
              } else {
                fields[fieldName] = val;
              }
            }

            const id = fields.id;
            if (!id || id === "—") continue;

            const raw = buildRawRowFromFullSheet(rows, r);

            const tip = fields.tip ?? "Vivienda";
            const fase = fields.fase ?? "—";
            const precio = toNum(fields.precio);

            const adm = emptyAdm();
            for (const [k, v] of Object.entries(admFields)) {
              if (k in adm) (adm as unknown as Record<string, string>)[k] = v;
            }
            if (fields.addr) adm.addr = fields.addr;
            if (fields.prov) adm.prov = fields.prov.toUpperCase();
            if (fields.pob) adm.city = fields.pob;
            if (fields.cp) adm.zip = fields.cp;
            if (fields.catRef) adm.cref = fields.catRef;

            const pubRaw = (fields.pub ?? "").toUpperCase().trim();
            const pub = pubRaw === "SI" || pubRaw === "SIM" || pubRaw === "SÍ" || pubRaw === "YES" || pubRaw === "TRUE" || pubRaw === "1";

            assets.push({
              id,
              cat: fields.cat ?? "—",
              prov: fields.prov ?? "—",
              pob: fields.pob ?? "—",
              cp: fields.cp ?? "—",
              addr: fields.addr ?? "—",
              tip,
              tipC: tipToTipC(tip),
              fase: pub ? "Publicado" : fase,
              faseC: pub ? "fp-pub" : faseToFaseC(fase),
              precio,
              fav: false,
              chk: false,
              sqm: toNum(fields.sqm),
              tvia: fields.tvia ?? "—",
              nvia: fields.nvia ?? "—",
              num: fields.num ?? "—",
              esc: fields.esc ?? "—",
              pla: fields.pla ?? "—",
              pta: fields.pta ?? "—",
              map: defaultMap,
              catRef: fields.catRef ?? "—",
              clase: fields.clase ?? "—",
              uso: fields.uso ?? "—",
              bien: fields.bien ?? tip,
              supC: fields.supC ?? "—",
              supG: fields.supG ?? "—",
              coef: fields.coef ?? "—",
              ccaa: fields.ccaa ?? "—",
              fullAddr: fields.fullAddr ?? fields.addr ?? "—",
              desc: fields.desc ?? fields.addr ?? "—",
              ownerName: fields.ownerName ?? "—",
              ownerTel: fields.ownerTel ?? "—",
              ownerMail: fields.ownerMail ?? "—",
              adm,
              pub,
              excelRaw: { [sheetName]: raw },
            });
          }
        }

        resolve(assets);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error al parsear con mapeo"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}
