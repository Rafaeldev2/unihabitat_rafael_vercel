"use server";

import type { Asset } from "@/lib/types";
import {
  fetchConsultaDnprc,
  isPlausibleCadastralRef,
  normalizeCadastralRef,
} from "@/lib/catastro/dnp";
import {
  buildGeocodeQuery,
  buildStaticMapUrl,
  geocodeAddressLine,
} from "@/lib/catastro/geoapify";
import { catastroParsedToPartialAsset } from "@/lib/catastro/to-partial-asset";
import { mergePartialIntoAssetFillEmpty } from "@/lib/merge-asset-partial";
import { upsertAssets } from "@/app/actions/assets";

export type CatastroEnrichFailure = { id: string; ref: string; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

const CONCURRENCY = 5;
const BATCH_DELAY_MS = 200;

/**
 * Completa ficha con datos del Catastro (DNP) y geocodificación Geoapify para el mapa.
 * Respeta datos ya informados en el Excel (fusión fill-empty).
 */
export async function enrichAssetsWithCatastro(assets: Asset[]): Promise<{
  assets: Asset[];
  ok: number;
  skipped: number;
  failed: CatastroEnrichFailure[];
  supabase: { attempted: boolean; inserted: number; updated: number; errors: string[] };
}> {
  const failed: CatastroEnrichFailure[] = [];
  let ok = 0;
  let skipped = 0;
  const out: Asset[] = [];

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const slice = assets.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(
      slice.map(async asset => {
        const rawRef =
          asset.catRef && asset.catRef !== "—" ? asset.catRef : asset.adm.cref;
        if (!isPlausibleCadastralRef(String(rawRef))) {
          skipped++;
          return asset;
        }
        const ref = normalizeCadastralRef(String(rawRef));
        const row = await fetchConsultaDnprc(ref);
        if (row.error) {
          failed.push({ id: asset.id, ref, error: row.error });
          return asset;
        }

        const query = buildGeocodeQuery({
          direccionCompleta: row.direccionCompleta,
          municipio: row.municipio,
          provincia: row.provincia,
          codigoPostal: row.codigoPostal,
        });
        let mapUrl = "";
        if (query.trim()) {
          const geo = await geocodeAddressLine(query);
          if (geo) mapUrl = buildStaticMapUrl(geo.lon, geo.lat) || "";
        }

        const partial = catastroParsedToPartialAsset(row, mapUrl);
        ok++;
        return mergePartialIntoAssetFillEmpty(asset, partial);
      })
    );
    out.push(...batch);
    if (i + CONCURRENCY < assets.length) await sleep(BATCH_DELAY_MS);
  }

  const supabase: {
    attempted: boolean;
    inserted: number;
    updated: number;
    errors: string[];
  } = { attempted: false, inserted: 0, updated: 0, errors: [] };

  if (process.env.ASSET_UPSERT_AFTER_CATASTRO_ENRICH === "true") {
    supabase.attempted = true;
    try {
      const r = await upsertAssets(out);
      supabase.inserted = r.inserted;
      supabase.updated = r.updated;
      supabase.errors = r.errors;
    } catch (e) {
      supabase.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { assets: out, ok, skipped, failed, supabase };
}

/**
 * Re-enrich a single asset from Catastro by its ID.
 * Used by the "Actualizar Catastro" button in the asset detail view.
 */
export async function refreshAssetCatastro(
  assetId: string,
  opts?: { forceOverwrite?: boolean }
): Promise<{ success: boolean; error?: string; updatedFields?: string[] }> {
  const { requireAdmin } = await import("@/lib/auth-server");
  await requireAdmin();

  const { createServiceClient } = await import("@/lib/supabase/server");
  const { rowToAsset, assetToRow } = await import("@/lib/supabase/db");

  const supabase = await createServiceClient();
  const { data, error: fetchErr } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!data) return { success: false, error: "Activo no encontrado" };

  const asset = rowToAsset(data);
  const rawRef = asset.catRef && asset.catRef !== "—" ? asset.catRef : asset.adm.cref;

  if (!isPlausibleCadastralRef(String(rawRef))) {
    return { success: false, error: `Referencia catastral no válida: "${rawRef}"` };
  }

  const ref = normalizeCadastralRef(String(rawRef));
  const row = await fetchConsultaDnprc(ref);
  if (row.error) {
    return { success: false, error: row.error };
  }

  const query = buildGeocodeQuery({
    direccionCompleta: row.direccionCompleta,
    municipio: row.municipio,
    provincia: row.provincia,
    codigoPostal: row.codigoPostal,
  });
  let mapUrl = "";
  if (query.trim()) {
    const geo = await geocodeAddressLine(query);
    if (geo) mapUrl = buildStaticMapUrl(geo.lon, geo.lat) || "";
  }

  const partial = catastroParsedToPartialAsset(row, mapUrl);

  let enriched: Asset;
  if (opts?.forceOverwrite) {
    enriched = { ...asset, ...partial, adm: { ...asset.adm } };
    if (partial.catRef) enriched.adm.cref = partial.catRef;
    if (partial.prov) enriched.adm.prov = String(partial.prov).toUpperCase();
    if (partial.pob) enriched.adm.city = partial.pob;
    if (partial.cp) enriched.adm.zip = partial.cp;
    if (partial.fullAddr) enriched.adm.addr = partial.fullAddr;
  } else {
    enriched = mergePartialIntoAssetFillEmpty(asset, partial);
  }

  const updatedFields = Object.keys(partial).filter(k => k !== "map" || mapUrl);
  const dbRow = assetToRow(enriched);
  const { error: updateErr } = await supabase
    .from("assets")
    .update(dbRow)
    .eq("id", assetId);
  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true, updatedFields };
}

/**
 * Processes a small batch of assets (client calls this in a loop for progress reporting).
 * No Supabase upsert — the caller handles DB persistence after all batches complete.
 */
export async function enrichAssetsBatch(assets: Asset[]): Promise<{
  assets: Asset[];
  ok: number;
  skipped: number;
  failed: CatastroEnrichFailure[];
}> {
  const failed: CatastroEnrichFailure[] = [];
  let ok = 0;
  let skipped = 0;
  const out: Asset[] = [];

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const slice = assets.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(
      slice.map(async asset => {
        const rawRef =
          asset.catRef && asset.catRef !== "—" ? asset.catRef : asset.adm.cref;
        if (!isPlausibleCadastralRef(String(rawRef))) {
          skipped++;
          return asset;
        }
        const ref = normalizeCadastralRef(String(rawRef));
        const row = await fetchConsultaDnprc(ref);
        if (row.error) {
          failed.push({ id: asset.id, ref, error: row.error });
          return asset;
        }

        const query = buildGeocodeQuery({
          direccionCompleta: row.direccionCompleta,
          municipio: row.municipio,
          provincia: row.provincia,
          codigoPostal: row.codigoPostal,
        });
        let mapUrl = "";
        if (query.trim()) {
          const geo = await geocodeAddressLine(query);
          if (geo) mapUrl = buildStaticMapUrl(geo.lon, geo.lat) || "";
        }

        const partial = catastroParsedToPartialAsset(row, mapUrl);
        ok++;
        return mergePartialIntoAssetFillEmpty(asset, partial);
      })
    );
    out.push(...batch);
    if (i + CONCURRENCY < assets.length) await sleep(BATCH_DELAY_MS);
  }

  return { assets: out, ok, skipped, failed };
}
