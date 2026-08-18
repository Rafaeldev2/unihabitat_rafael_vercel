"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  readAllAssets, readAllPropiedades, readAllPropiedadesPublic,
  readAssetById, readAssetByIdForAdmin, readAssetByPublicSlug,
  readAssetsByActivoIdForAdmin, readAssetsByIds,
  readPropiedadesByInmuebleIds, readPublicAssets, readPublicAssetsByActivoId,
} from "@/lib/supabase/asset-reads";
import { upsertAssetRows, upsertPropiedadRows, type UpsertResult } from "@/lib/supabase/asset-upserts";
import { runImportSchemaPreflight, type ImportSchemaPreflightResult } from "@/lib/supabase/import-preflight";
import { validateExcelRawPayload } from "@/lib/supabase/excel-raw";
import type { Asset, Propiedad } from "@/lib/types";
import {
  requireAdmin, requireAdminOrVendor, requireEditPermission, requireAssetAccess,
} from "@/lib/auth-server";

/** Normaliza el agrupador ID1; "—" y vacío no agrupan nada. */
function normalizeActivoId(activoId: string): string {
  const key = activoId?.trim();
  return !key || key === "—" ? "" : key;
}

/* ------------------------------------------------------------------ */
/*  Reads (Inmuebles)                                                 */
/* ------------------------------------------------------------------ */

export async function fetchAssets(): Promise<Asset[]> {
  return readAllAssets();
}

export async function fetchPublicAssets(): Promise<Asset[]> {
  return readPublicAssets();
}

export async function fetchAssetsByIds(ids: string[]): Promise<Asset[]> {
  return readAssetsByIds(ids);
}

/** Inmuebles públicos del mismo grupo (activoId / ID1). */
export async function fetchPublicAssetsByActivoId(activoId: string): Promise<Asset[]> {
  const key = normalizeActivoId(activoId);
  if (!key) return [];
  return readPublicAssetsByActivoId(key);
}

export async function fetchAssetById(id: string): Promise<Asset | null> {
  return readAssetById(id);
}

/** Inmuebles hermanos por activoId (ID1) para admin, publicados o no. */
export async function fetchAssetsByActivoIdForAdmin(activoId: string, excludeId?: string): Promise<Asset[]> {
  const key = normalizeActivoId(activoId);
  if (!key) return [];
  await requireAdminOrVendor();
  return readAssetsByActivoIdForAdmin(key, excludeId);
}

/** Resuelve ficha pública/privada por slug opaco (sin catastral en URL). */
export async function fetchAssetByPublicSlug(slug: string): Promise<Asset | null> {
  const key = slug?.trim();
  if (!key) return null;
  return readAssetByPublicSlug(key);
}

export async function assertImportSchemaReady(): Promise<ImportSchemaPreflightResult> {
  await requireAdmin();
  return runImportSchemaPreflight();
}

export async function fetchAssetByIdForAdmin(id: string): Promise<Asset | null> {
  const session = await requireAdminOrVendor();
  await requireAssetAccess(session, id);
  return readAssetByIdForAdmin(id);
}

/* ------------------------------------------------------------------ */
/*  Reads (Propiedades)                                               */
/* ------------------------------------------------------------------ */

export async function fetchPropiedades(): Promise<Propiedad[]> {
  return readAllPropiedades();
}

export async function fetchPropiedadesPublic(): Promise<Propiedad[]> {
  return readAllPropiedadesPublic();
}

export async function fetchPropiedadesByInmuebleIds(ids: string[]): Promise<Propiedad[]> {
  if (ids.length === 0) return [];
  return readPropiedadesByInmuebleIds(ids);
}

/* ------------------------------------------------------------------ */
/*  Upserts                                                           */
/* ------------------------------------------------------------------ */

function preflightFailure(preflight: ImportSchemaPreflightResult): UpsertResult {
  return {
    inserted: 0,
    updated: 0,
    errors: preflight.errors.map((e) => `Preflight: ${e}`),
    duplicatesMerged: {},
  };
}

export async function upsertAssets(assets: Asset[]): Promise<UpsertResult> {
  await requireAdmin();
  const preflight = await runImportSchemaPreflight();
  if (!preflight.ok) return preflightFailure(preflight);
  return upsertAssetRows(assets);
}

export async function upsertPropiedades(propiedades: Propiedad[]): Promise<UpsertResult> {
  await requireAdmin();
  const preflight = await runImportSchemaPreflight();
  if (!preflight.ok) return preflightFailure(preflight);
  return upsertPropiedadRows(propiedades);
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

async function recomputeMatching(id: string): Promise<void> {
  try {
    // Import diferido: `matching` importa este módulo, la estática sería circular.
    const { computeMatchesForAsset } = await import("@/app/actions/matching");
    await computeMatchesForAsset(id);
  } catch (err) {
    console.warn("[toggleAssetPub] matching falló (best-effort):", err);
  }
}

export async function toggleAssetPub(id: string): Promise<boolean> {
  const session = await requireEditPermission("activos");
  await requireAssetAccess(session, id);
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("assets").select("pub").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Inmueble no encontrado");

  const newPub = !data.pub;
  const { error: updateErr } = await supabase.from("assets").update({ pub: newPub }).eq("id", id);
  if (updateErr) throw new Error(updateErr.message);

  if (newPub) await recomputeMatching(id);
  return newPub;
}

export async function updateAssetFields(
  id: string,
  fields: Record<string, string | number | null>,
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const session = await requireEditPermission("activos");
  await requireAssetAccess(session, id);
  const supabase = await createServiceClient();
  const { error } = await supabase.from("assets").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Actualiza campos de una fila en `propiedades` (fase_interna, proceso, etc.). */
export async function updatePropiedadFields(
  propiedadId: string,
  fields: Record<string, string | number | null>,
): Promise<void> {
  if (!propiedadId || Object.keys(fields).length === 0) return;
  await requireEditPermission("activos");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("propiedades").update(fields).eq("id", propiedadId);
  if (error) throw new Error(error.message);
}

/** El blob de Excel vive a nivel propiedad (lien), no inmueble. */
export async function updatePropiedadExcelRaw(
  propiedadId: string,
  excelRaw: Record<string, Record<string, string>>,
): Promise<void> {
  await requireAdmin();
  const validated = validateExcelRawPayload(excelRaw);
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("propiedades").update({ excel_raw: validated }).eq("id", propiedadId);
  if (error) throw new Error(error.message);
}

export async function deleteAllAssets(): Promise<{ deleted: number }> {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("assets").delete().neq("id", "").select("id");
  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0 };
}

export async function deleteAssetsByIds(ids: string[]): Promise<{ deleted: number }> {
  await requireAdmin();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("assets").delete().in("id", unique).select("id");
  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0 };
}

export async function toggleAssetFav(id: string): Promise<void> {
  await requireAdminOrVendor();
  const supabase = await createClient();
  const { data, error } = await supabase.from("assets").select("fav").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const { error: updateErr } = await supabase.from("assets").update({ fav: !data.fav }).eq("id", id);
  if (updateErr) throw new Error(updateErr.message);
}
