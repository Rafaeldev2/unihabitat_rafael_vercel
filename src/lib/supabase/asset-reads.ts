import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchAllPaginated, fetchAllByIds } from "@/lib/supabase/paginate";
import {
  attachPropiedades,
  rowToAsset, rowToAssetPublic, rowToPropiedad, rowToPropiedadPublic,
} from "@/lib/supabase/db";
import type { Asset, Propiedad } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Client = Awaited<ReturnType<typeof createClient>>;
type PropiedadMapper = (r: Row) => Propiedad;

async function readPropiedadesByInmueble(sb: Client, ids: string[]): Promise<Row[]> {
  if (ids.length === 0) return [];
  return fetchAllByIds<Row>(
    "propiedades.byInmuebleId",
    () => sb.from("propiedades").select("*"),
    "inmueble_id",
    ids,
  );
}

async function withPropiedades(sb: Client, inmuebles: Asset[], toPropiedad: PropiedadMapper): Promise<Asset[]> {
  if (inmuebles.length === 0) return inmuebles;
  const rows = await readPropiedadesByInmueble(sb, inmuebles.map((a) => a.id));
  return attachPropiedades(inmuebles, rows.map(toPropiedad));
}

/** Ids de inmueble que comparten `activo_id` (agrupación ID1). */
async function inmuebleIdsForActivo(sb: Client, activoId: string): Promise<string[]> {
  const { data, error } = await sb.from("propiedades").select("inmueble_id").eq("activo_id", activoId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r: Row) => r.inmueble_id as string).filter(Boolean))];
}

async function readAssetRowsByIds(sb: Client, ids: string[], onlyPublic = false): Promise<Row[]> {
  if (ids.length === 0) return [];
  return fetchAllByIds<Row>(
    "assets.byId",
    () => (onlyPublic ? sb.from("assets").select("*").eq("pub", true) : sb.from("assets").select("*")),
    "id",
    ids,
  );
}

async function readOneAsset(sb: Client, column: string, value: string, toAsset: (r: Row) => Asset, toPropiedad: PropiedadMapper): Promise<Asset | null> {
  const { data, error } = await sb.from("assets").select("*").eq(column, value).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const asset = toAsset(data);
  const { data: props, error: pErr } = await sb.from("propiedades").select("*").eq("inmueble_id", asset.id);
  if (pErr) throw new Error(pErr.message);
  asset.propiedades = (props ?? []).map(toPropiedad);
  return asset;
}

export async function readAllAssets(): Promise<Asset[]> {
  const sb = await createServiceClient();
  const rows = await fetchAllPaginated<Row>("fetchAssets", () =>
    sb.from("assets").select("*").order("created_at", { ascending: false }),
  );
  return rows.map(rowToAsset);
}

export async function readPublicAssets(): Promise<Asset[]> {
  const sb = await createClient();
  const rows = await fetchAllPaginated<Row>("fetchPublicAssets", () =>
    sb.from("assets").select("*").eq("pub", true).order("created_at", { ascending: false }),
  );
  return withPropiedades(sb, rows.map(rowToAssetPublic), rowToPropiedadPublic);
}

export async function readAssetsByIds(ids: string[]): Promise<Asset[]> {
  const sb = await createServiceClient();
  const rows = await readAssetRowsByIds(sb, ids);
  return rows.map(rowToAssetPublic);
}

export async function readPublicAssetsByActivoId(activoId: string): Promise<Asset[]> {
  const sb = await createClient();
  const ids = await inmuebleIdsForActivo(sb, activoId);
  const rows = await readAssetRowsByIds(sb, ids, true);
  return withPropiedades(sb, rows.map(rowToAssetPublic), rowToPropiedadPublic);
}

export async function readAssetsByActivoIdForAdmin(activoId: string, excludeId?: string): Promise<Asset[]> {
  const sb = await createServiceClient();
  const ids = (await inmuebleIdsForActivo(sb, activoId)).filter((id) => id !== excludeId);
  const rows = await readAssetRowsByIds(sb, ids);
  return withPropiedades(sb, rows.map(rowToAsset), rowToPropiedad);
}

export async function readAssetById(id: string): Promise<Asset | null> {
  const sb = await createClient();
  return readOneAsset(sb, "id", id, rowToAssetPublic, rowToPropiedadPublic);
}

export async function readAssetByPublicSlug(slug: string): Promise<Asset | null> {
  const sb = await createClient();
  return readOneAsset(sb, "public_slug", slug, rowToAssetPublic, rowToPropiedadPublic);
}

export async function readAssetByIdForAdmin(id: string): Promise<Asset | null> {
  const sb = await createServiceClient();
  return readOneAsset(sb, "id", id, rowToAsset, rowToPropiedad);
}

export async function readAllPropiedades(): Promise<Propiedad[]> {
  const sb = await createServiceClient();
  const rows = await fetchAllPaginated<Row>("fetchPropiedades", () =>
    sb.from("propiedades").select("*").order("created_at", { ascending: false }),
  );
  return rows.map(rowToPropiedad);
}

export async function readAllPropiedadesPublic(): Promise<Propiedad[]> {
  const sb = await createClient();
  const rows = await fetchAllPaginated<Row>("fetchPropiedadesPublic", () =>
    sb.from("propiedades").select("*"),
  );
  return rows.map(rowToPropiedadPublic);
}

export async function readPropiedadesByInmuebleIds(ids: string[]): Promise<Propiedad[]> {
  const sb = await createServiceClient();
  const rows = await readPropiedadesByInmueble(sb, ids);
  return rows.map(rowToPropiedad);
}
