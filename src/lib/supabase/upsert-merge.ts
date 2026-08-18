import { assetToRow, mergeExcelRawMaps } from "@/lib/supabase/db";
import { buildStaticMapUrl } from "@/lib/catastro/geoapify";
import { buildPublicSlug } from "@/lib/public-slug";
import type { Asset, Propiedad } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = Record<string, any>;

const EMPTY_VALS = new Set(["—", ""]);
const PRESERVE_FIELDS = new Set(["id", "created_at", "updated_at"]);

function isEmptyVal(v: unknown): boolean {
  if (v == null) return true;
  return typeof v === "string" && EMPTY_VALS.has(v.trim());
}

/** Campos donde el valor ya guardado gana al entrante del Excel. */
function keepExisting(key: string, inVal: unknown, exVal: unknown): boolean {
  if (key === "fav") return true;
  if ((key === "lat" || key === "lng") && inVal == null && exVal != null) return true;
  if (key === "map" && isEmptyVal(inVal) && !isEmptyVal(exVal)) return true;
  return isEmptyVal(inVal);
}

/** Fusión fill-empty: el Excel solo rellena huecos, nunca borra datos existentes. */
export function mergeRowPreferNonEmpty(existing: DbRow, incoming: DbRow): DbRow {
  const merged: DbRow = { ...existing };
  for (const key of Object.keys(incoming)) {
    if (PRESERVE_FIELDS.has(key)) continue;
    if (key === "pub") {
      if (incoming[key] === true) merged[key] = true;
      continue;
    }
    if (keepExisting(key, incoming[key], existing[key])) continue;
    merged[key] = incoming[key];
  }
  return merged;
}

function isProviderStaticMapUrl(m: string): boolean {
  const u = m.toLowerCase();
  return u.includes("maps.geoapify.com") || u.includes("staticmap.openstreetmap.de");
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Regenera el mapa estático salvo que el usuario haya puesto una URL propia. */
export function applyMapFromLatLng(row: DbRow): void {
  const la = toFiniteNumber(row.lat);
  const lo = toFiniteNumber(row.lng);
  if (la == null || lo == null) return;
  const current = String(row.map ?? "").trim();
  if (current && !isProviderStaticMapUrl(current)) return;
  const fallback = `https://staticmap.openstreetmap.de/staticmap?center=${encodeURIComponent(String(la))},${encodeURIComponent(String(lo))}&zoom=15&size=600x400`;
  row.map = buildStaticMapUrl(String(lo), String(la)) || fallback;
}

export interface DedupResult<T> {
  deduped: T[];
  duplicates: Record<string, number>;
}

function dedupById<T extends { id: string }>(
  items: T[],
  merge: (prev: T, next: T) => T,
): DedupResult<T> {
  const byId = new Map<string, T>();
  const order: string[] = [];
  const duplicates: Record<string, number> = {};
  for (const item of items) {
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, item);
      order.push(item.id);
      continue;
    }
    byId.set(item.id, merge(prev, item));
    duplicates[item.id] = (duplicates[item.id] ?? 1) + 1;
  }
  return { deduped: order.map((id) => byId.get(id)!), duplicates };
}

export function dedupAssetsById(assets: Asset[]): DedupResult<Asset> {
  return dedupById(assets, (prev, next) => ({ ...prev, ...next }));
}

export function dedupPropiedadesById(propiedades: Propiedad[]): DedupResult<Propiedad> {
  return dedupById(propiedades, (prev, next) => ({
    ...prev,
    ...next,
    excelRaw: mergeExcelRawMaps(prev.excelRaw, next.excelRaw),
  }));
}

/** Slug estable: conserva el ya publicado y evita colisiones dentro del batch. */
export function resolveAssetSlug(a: Asset, existing: DbRow | undefined, taken: Set<string>): string {
  const keepSlug = existing?.public_slug ? String(existing.public_slug) : a.publicSlug;
  if (keepSlug) taken.delete(keepSlug);
  const slug = buildPublicSlug({ id: a.id, tip: a.tip, pob: a.pob, publicSlug: keepSlug }, taken);
  taken.add(slug);
  return slug;
}

export function buildAssetUpsertRow(a: Asset, existing: DbRow | undefined, publicSlug: string): DbRow {
  const incoming = assetToRow(a);
  incoming.public_slug = publicSlug;
  if (!incoming.referencia) {
    incoming.referencia = a.referencia || existing?.referencia || a.id.split("__")[1] || a.id;
  }
  const merged = existing ? mergeRowPreferNonEmpty(existing, incoming) : incoming;
  merged.public_slug = publicSlug;
  if (!merged.referencia) merged.referencia = incoming.referencia;
  applyMapFromLatLng(merged);
  return merged;
}
