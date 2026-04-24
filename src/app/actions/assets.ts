"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rowToAsset, assetToRow, mergeExcelRawMaps } from "@/lib/supabase/db";
import type { Asset } from "@/lib/types";
import { buildStaticMapUrl } from "@/lib/catastro/geoapify";
import { requireAdmin, requireAdminOrVendor, requireEditPermission, requireAssetAccess } from "@/lib/auth-server";

/** Lectura completa para el panel admin (login demo sin JWT Supabase: el anon no pasa RLS). */
export async function fetchAssets(): Promise<Asset[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAsset);
}

export async function fetchPublicAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("pub", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAsset);
}

export async function fetchAssetsByIds(ids: string[]): Promise<Asset[]> {
  if (ids.length === 0) return [];
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAsset);
}

/** Lectura con cliente anónimo (portal / rutas públicas). */
export async function fetchAssetById(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAsset(data) : null;
}

/** Panel admin: incluye excel_raw y demás columnas con service role tras comprobar acceso. */
export async function fetchAssetByIdForAdmin(id: string): Promise<Asset | null> {
  const session = await requireAdminOrVendor();
  await requireAssetAccess(session, id);
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAsset(data) : null;
}

const MAX_EXCEL_RAW_JSON_CHARS = 500_000;

function validateExcelRawPayload(obj: unknown): Record<string, Record<string, string>> {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Formato excel_raw inválido");
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [sk, sv] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof sk !== "string" || sk.length > 200) throw new Error("Nombre de hoja inválido");
    if (sv == null || typeof sv !== "object" || Array.isArray(sv)) {
      throw new Error(`Contenido de hoja "${sk}" inválido`);
    }
    const inner: Record<string, string> = {};
    for (const [hk, hv] of Object.entries(sv as Record<string, unknown>)) {
      if (typeof hk !== "string" || hk.length > 500) throw new Error("Nombre de columna inválido");
      inner[hk] = hv == null ? "" : String(hv).slice(0, 50_000);
    }
    out[sk] = inner;
  }
  const json = JSON.stringify(out);
  if (json.length > MAX_EXCEL_RAW_JSON_CHARS) {
    throw new Error("excel_raw demasiado grande; reduzca el contenido");
  }
  return out;
}

export async function updateAssetExcelRaw(
  id: string,
  excelRaw: Record<string, Record<string, string>>,
): Promise<void> {
  const session = await requireEditPermission("activos");
  await requireAssetAccess(session, id);
  const validated = validateExcelRawPayload(excelRaw);
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("assets")
    .update({ excel_raw: validated })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

const EMPTY_VALS = new Set(["—", "", "—"]);
const PRESERVE_FIELDS = new Set(["id", "created_at", "updated_at"]);

function isEmptyVal(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string" && EMPTY_VALS.has(v.trim())) return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeRowPreferNonEmpty(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: Record<string, any> = { ...existing };

  for (const key of Object.keys(incoming)) {
    if (PRESERVE_FIELDS.has(key)) continue;

    const inVal = incoming[key];
    const exVal = existing[key];

    if (key === "excel_raw") {
      const combined = mergeExcelRawMaps(
        exVal as Record<string, Record<string, string>> | undefined,
        inVal as Record<string, Record<string, string>> | undefined,
      );
      if (combined && Object.keys(combined).length > 0) merged[key] = combined;
      continue;
    }

    // Preserve booleans set by admin (pub, fav) -- only override if incoming is explicitly true
    if (key === "pub") {
      if (inVal === true) merged[key] = true;
      continue;
    }
    if (key === "fav") continue;

    // Preserve geo data from Catastro unless incoming has real values
    if ((key === "lat" || key === "lng") && inVal == null && exVal != null) continue;
    if (key === "map" && isEmptyVal(inVal) && !isEmptyVal(exVal)) continue;

    // For all other fields: prefer incoming if it has a real value, otherwise keep existing
    if (!isEmptyVal(inVal)) {
      merged[key] = inVal;
    }
  }

  return merged;
}

/** Mismo tipo de URL que se genera en `parseEnriquecido` (mapa, no imagen de propiedad). */
function isProviderStaticMapUrl(m: string): boolean {
  const u = m.toLowerCase();
  return u.includes("maps.geoapify.com") || u.includes("staticmap.openstreetmap.de");
}

/** Sincroniza `map` con `lat`/`lng` tras el merge (misma lógica que hoja Enriquecido + Geoapify). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyMapFromLatLng(row: Record<string, any>): void {
  const lat = row.lat;
  const lng = row.lng;
  if (lat == null || lng == null) return;
  const la = typeof lat === "number" ? lat : parseFloat(String(lat));
  const lo = typeof lng === "number" ? lng : parseFloat(String(lng));
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
  const current = String(row.map ?? "").trim();
  if (current && !isProviderStaticMapUrl(current)) {
    return;
  }
  const geo = buildStaticMapUrl(String(lo), String(la));
  if (geo) {
    row.map = geo;
    return;
  }
  row.map =
    `https://staticmap.openstreetmap.de/staticmap?center=${encodeURIComponent(String(la))},${encodeURIComponent(String(lo))}` +
    `&zoom=15&size=600x400`;
}

export async function upsertAssets(assets: Asset[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
  await requireAdmin();
  const supabase = await createServiceClient();
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const batchIds = batch.map(a => a.id);

    // Fetch full existing rows for smart merge
    const { data: existingRows, error: fetchErr } = await supabase
      .from("assets")
      .select("*")
      .in("id", batchIds);
    if (fetchErr) {
      errors.push(`Batch ${i}: ${fetchErr.message}`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingMap = new Map<string, Record<string, any>>();
    for (const row of existingRows ?? []) existingMap.set(row.id, row);

    const rows = batch.map(a => {
      const incoming = assetToRow(a);
      const existing = existingMap.get(a.id);
      const merged = existing ? mergeRowPreferNonEmpty(existing, incoming) : incoming;
      applyMapFromLatLng(merged);
      return merged;
    });

    const { error: upsertErr } = await supabase
      .from("assets")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false });

    if (upsertErr) {
      errors.push(`Batch ${i}: ${upsertErr.message}`);
    } else {
      for (const r of rows) {
        if (existingMap.has(r.id)) updated++;
        else inserted++;
      }
    }
  }

  return { inserted, updated, errors };
}

export async function toggleAssetPub(id: string): Promise<boolean> {
  const session = await requireEditPermission("activos");
  await requireAssetAccess(session, id);
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select("pub")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Activo no encontrado");
  const newPub = !data.pub;
  const { error: updateErr } = await supabase
    .from("assets")
    .update({
      pub: newPub,
      fase: newPub ? "Publicado" : "Suspendido",
      fase_c: newPub ? "fp-pub" : "fp-sus",
    })
    .eq("id", id);
  if (updateErr) throw new Error(updateErr.message);
  return newPub;
}

export async function updateAssetFields(
  id: string,
  fields: Record<string, string | number | null>
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const session = await requireEditPermission("activos");
  await requireAssetAccess(session, id);
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("assets")
    .update(fields)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAllAssets(): Promise<{ deleted: number }> {
  await requireAdmin();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .delete()
    .neq("id", "")
    .select("id");
  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0 };
}

export async function deleteAssetsByIds(ids: string[]): Promise<{ deleted: number }> {
  await requireAdmin();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { deleted: 0 };
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .delete()
    .in("id", unique)
    .select("id");
  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0 };
}

export async function toggleAssetFav(id: string): Promise<void> {
  await requireAdminOrVendor();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("fav")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const { error: updateErr } = await supabase
    .from("assets")
    .update({ fav: !data.fav })
    .eq("id", id);
  if (updateErr) throw new Error(updateErr.message);
}
