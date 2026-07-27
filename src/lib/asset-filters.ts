import type { Asset } from "./types";
import { FASE_INTERNA_OPTIONS } from "./fase-interna";

/** Clave de comparación insensible a mayúsculas y tildes (p. ej. Alicante = ALICANTE). */
export function filterOptionKey(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/** Opciones únicas para selects; prefiere etiqueta con minúsculas sobre TODO MAYÚSCULAS. */
export function uniqueFilterOptions(values: (string | undefined | null)[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const v = (raw ?? "").trim();
    if (!v || v === "—") continue;
    const key = filterOptionKey(v);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, v);
      continue;
    }
    const prevAllCaps = prev === prev.toUpperCase();
    const vAllCaps = v === v.toUpperCase();
    if (prevAllCaps && !vAllCaps) byKey.set(key, v);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export function matchesFilterValue(value: string | undefined, filter: string): boolean {
  if (!filter) return true;
  return filterOptionKey(value ?? "") === filterOptionKey(filter);
}

function usableFieldValues(values: (string | undefined | null)[]): string[] {
  return values
    .map((v) => (v ?? "").trim())
    .filter((v) => v && v !== "—");
}

/** Categorías derivadas de las propiedades asociadas (CDR/NPL). */
export function buildCatFilterOptions(assets: Asset[]): string[] {
  const all: string[] = [];
  for (const a of assets) for (const p of a.propiedades) all.push(p.categoria);
  return uniqueFilterOptions(all);
}

export function buildProvFilterOptions(assets: Asset[]): string[] {
  return uniqueFilterOptions(assets.map((a) => a.prov));
}

export function buildPobFilterOptions(assets: Asset[], fProv: string): string[] {
  const src = fProv
    ? assets.filter((a) => matchesFilterValue(a.prov, fProv))
    : assets;
  return uniqueFilterOptions(src.map((a) => a.pob));
}

export function buildTipFilterOptions(assets: Asset[]): string[] {
  return [...new Set(usableFieldValues(assets.map((a) => a.tip)).map((t) => t.toUpperCase()))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

export const ESTADO_PUBLICADO = "Publicado";
export const ESTADO_SUSPENDIDO = "Suspendido";

/** Etiqueta de publicación del inmueble en el portal/admin. */
export function assetEstadoLabel(a: Asset): string {
  return a.pub ? ESTADO_PUBLICADO : ESTADO_SUSPENDIDO;
}

/** Estado de publicación: Publicado o Suspendido según `asset.pub`. */
export function buildEstadoFilterOptions(assets: Asset[]): string[] {
  const opts: string[] = [];
  if (assets.some((a) => a.pub)) opts.push(ESTADO_PUBLICADO);
  if (assets.some((a) => !a.pub)) opts.push(ESTADO_SUSPENDIDO);
  return opts.sort((a, b) => a.localeCompare(b, "es"));
}

/** Fases para el filtro Situación: enum fijo + valores legacy presentes en datos. */
export function buildFaseFilterOptions(assets: Asset[]): string[] {
  const fromData: string[] = [];
  for (const a of assets) for (const p of a.propiedades) fromData.push(p.faseInterna);
  return uniqueFilterOptions([...FASE_INTERNA_OPTIONS, ...fromData]);
}

export function buildProcesoFilterOptions(assets: Asset[]): string[] {
  const all: string[] = [];
  for (const a of assets) for (const p of a.propiedades) all.push(p.proceso);
  return uniqueFilterOptions(all);
}

export const DEUDA_CON = "Con deuda";
export const DEUDA_SIN = "Sin deuda";

export function buildDeudaFilterOptions(assets: Asset[]): string[] {
  let con = false;
  let sin = false;
  for (const a of assets) {
    for (const p of a.propiedades) {
      if (p.deuda != null && p.deuda > 0) con = true;
      else sin = true;
    }
    if (a.propiedades.length === 0) sin = true;
  }
  const opts: string[] = [];
  if (con) opts.push(DEUDA_CON);
  if (sin) opts.push(DEUDA_SIN);
  return opts;
}

function assetHasDeuda(a: Asset): boolean {
  return a.propiedades.some((p) => p.deuda != null && p.deuda > 0);
}

export interface AssetListFilters {
  cat?: string;
  prov?: string;
  pob?: string;
  tipo?: string;
  estado?: string;
  fase?: string;
  proceso?: string;
  deuda?: string;
}

export interface AssetFilterOptionSet {
  cat: string[];
  prov: string[];
  pob: string[];
  tip: string[];
  estado: string[];
  fase: string[];
  proceso: string[];
  deuda: string[];
}

type FilterOptionField = keyof AssetListFilters;

/** Activos que cumplen los filtros activos, excluyendo el campo cuyas opciones se construyen. */
export function assetsForFilterOptions(
  assets: Asset[],
  active: AssetListFilters,
  except: FilterOptionField,
): Asset[] {
  const scoped: AssetListFilters = { ...active };
  delete scoped[except];
  return assets.filter((a) => assetMatchesListFilters(a, scoped));
}

/** Opciones en cascada: cada select se calcula con el resto de filtros ya aplicados. */
export function buildAssetListFilterOptions(
  assets: Asset[],
  active: AssetListFilters = {},
): AssetFilterOptionSet {
  const fProv = active.prov ?? "";
  return {
    cat: buildCatFilterOptions(assetsForFilterOptions(assets, active, "cat")),
    prov: buildProvFilterOptions(assetsForFilterOptions(assets, active, "prov")),
    pob: buildPobFilterOptions(assetsForFilterOptions(assets, active, "pob"), fProv),
    tip: buildTipFilterOptions(assetsForFilterOptions(assets, active, "tipo")),
    estado: buildEstadoFilterOptions(assetsForFilterOptions(assets, active, "estado")),
    fase: buildFaseFilterOptions(assetsForFilterOptions(assets, active, "fase")),
    proceso: buildProcesoFilterOptions(assetsForFilterOptions(assets, active, "proceso")),
    deuda: buildDeudaFilterOptions(assetsForFilterOptions(assets, active, "deuda")),
  };
}

/** Inmuebles visibles en el portal: todo el catálogo para staff, solo publicados para visitantes. */
export function portalCatalogAssets(assets: Asset[], isStaff: boolean): Asset[] {
  return isStaff ? assets : assets.filter((a) => a.pub);
}

export function countAssetsMatchingListFilters(
  assets: Asset[],
  filters: AssetListFilters,
): number {
  return assets.filter((a) => assetMatchesListFilters(a, filters)).length;
}

/** Misma lógica de filtrado que el listado principal de /admin. */
export function assetMatchesListFilters(a: Asset, f: AssetListFilters): boolean {
  if (f.cat) {
    const matches = a.propiedades.some((p) => matchesFilterValue(p.categoria, f.cat!));
    if (!matches) return false;
  }
  if (f.prov && !matchesFilterValue(a.prov, f.prov)) return false;
  if (f.pob && !matchesFilterValue(a.pob, f.pob)) return false;
  if (f.tipo && (a.tip ?? "").toUpperCase() !== f.tipo) return false;
  if (f.estado && !matchesFilterValue(assetEstadoLabel(a), f.estado)) return false;
  if (f.fase) {
    const matches = a.propiedades.some((p) => matchesFilterValue(p.faseInterna, f.fase!));
    if (!matches) return false;
  }
  if (f.proceso) {
    const matches = a.propiedades.some((p) => matchesFilterValue(p.proceso, f.proceso!));
    if (!matches) return false;
  }
  if (f.deuda) {
    const has = assetHasDeuda(a);
    if (f.deuda === DEUDA_CON && !has) return false;
    if (f.deuda === DEUDA_SIN && has) return false;
  }
  return true;
}
