import type { Asset } from "@/lib/types";
import type { CatastroDnprcParsed } from "./dnp";

function parseNumMaybe(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dash(v: string): string {
  const t = v?.trim() ?? "";
  return t || "—";
}

/**
 * Convierte la respuesta DNP al mismo shape que produce la hoja Enriquecido en normalize-excel.
 */
export function catastroParsedToPartialAsset(
  row: CatastroDnprcParsed,
  mapUrl: string
): Partial<Asset> {
  const supCNum = parseNumMaybe(row.superficieConstruida);
  const supGNum = parseNumMaybe(row.superficieGrafica);
  const partial: Partial<Asset> = {
    catRef: row.referencia,
    clase: dash(row.clase),
    uso: dash(row.uso),
    bien: dash(row.bien),
    prov: dash(row.provincia),
    pob: dash(row.municipio),
    cp: dash(row.codigoPostal),
    fullAddr: dash(row.direccionCompleta),
    tvia: dash(row.tipoVia),
    nvia: dash(row.nombreVia),
    num: dash(row.numero),
    esc: dash(row.escalera),
    pla: dash(row.planta),
    pta: dash(row.puerta),
    supC: supCNum != null ? `${supCNum} m²` : "—",
    supG: supGNum != null ? `${supGNum} m²` : "—",
    sqm: supCNum,
    age: dash(row.antiguedad),
    coef: dash(row.coeficiente),
    desc: dash(row.descripcion),
  };
  if (mapUrl.trim()) partial.map = mapUrl;
  return partial;
}
