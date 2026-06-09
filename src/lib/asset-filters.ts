import type { Asset } from "./types";

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

/** Fases derivadas de las propiedades asociadas. */
export function buildFaseFilterOptions(assets: Asset[]): string[] {
  const all: string[] = [];
  for (const a of assets) for (const p of a.propiedades) all.push(p.faseInterna);
  return uniqueFilterOptions(all);
}

export interface AssetListFilters {
  cat?: string;
  prov?: string;
  pob?: string;
  tipo?: string;
  fase?: string;
}

export interface AssetFilterOptionSet {
  cat: string[];
  prov: string[];
  pob: string[];
  tip: string[];
  fase: string[];
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
    fase: buildFaseFilterOptions(assetsForFilterOptions(assets, active, "fase")),
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
  if (f.fase) {
    const matches = a.propiedades.some((p) => matchesFilterValue(p.faseInterna, f.fase!));
    if (!matches) return false;
  }
  return true;
}
