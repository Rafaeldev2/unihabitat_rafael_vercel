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

import {
  type CatastroFailureCategory,
  tallyCatastroFailures as tallyFailures,
} from "@/lib/catastro/errors";
export type { CatastroFailureCategory } from "@/lib/catastro/errors";

export type CatastroEnrichFailure = { id: string; ref: string; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// CONCURRENCY reducido 5→3 y delay 200→500 ms para respetar el throttling
// del Catastro DNP (HTTP 503/429 al pasar de ~5 req/s sostenidos).
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 500;

function applyCatastroOverwrite(asset: Asset, partial: Partial<Asset>): Asset {
  const enriched: Asset = { ...asset, ...partial, adm: { ...asset.adm } };
  if (partial.catRef) enriched.adm.cref = partial.catRef;
  if (partial.prov) enriched.adm.prov = String(partial.prov).toUpperCase();
  if (partial.pob) enriched.adm.city = partial.pob;
  if (partial.cp) enriched.adm.zip = partial.cp;
  if (partial.fullAddr && partial.fullAddr !== "—") {
    enriched.fullAddr = partial.fullAddr;
    enriched.addr = partial.fullAddr;
    enriched.adm.addr = partial.fullAddr;
  }
  return enriched;
}

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

type SupabaseLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createServiceClient>>;

/**
 * Internal: refresh one asset by id against an already-resolved supabase client.
 * Shared between refreshAssetCatastro (single) and forceRefreshAssetsCatastro (bulk),
 * so the per-asset behavior of "Forzar" is identical in both code paths.
 */
async function doRefreshOne(
  supabase: SupabaseLike,
  assetId: string,
  opts?: { forceOverwrite?: boolean }
): Promise<{
  success: boolean;
  error?: string;
  updatedFields?: string[];
  ref?: string;
}> {
  const { rowToAsset, assetToRow } = await import("@/lib/supabase/db");

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
    return { success: false, error: `Referencia catastral no válida: "${rawRef}"`, ref: String(rawRef ?? "") };
  }

  const ref = normalizeCadastralRef(String(rawRef));
  const row = await fetchConsultaDnprc(ref);
  if (row.error) {
    return { success: false, error: row.error, ref };
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

  const enriched: Asset = opts?.forceOverwrite
    ? applyCatastroOverwrite(asset, partial)
    : mergePartialIntoAssetFillEmpty(asset, partial);

  const updatedFields = Object.keys(partial).filter(k => k !== "map" || mapUrl);
  const dbRow = assetToRow(enriched);
  const { error: updateErr } = await supabase
    .from("assets")
    .update(dbRow)
    .eq("id", assetId);
  if (updateErr) return { success: false, error: updateErr.message, ref };

  return { success: true, updatedFields, ref };
}

/**
 * Re-enrich a single asset from Catastro by its ID.
 * Used by the "Actualizar Catastro" / "Forzar" buttons in the asset detail view.
 */
export async function refreshAssetCatastro(
  assetId: string,
  opts?: { forceOverwrite?: boolean }
): Promise<{ success: boolean; error?: string; updatedFields?: string[] }> {
  const { requireAdmin } = await import("@/lib/auth-server");
  await requireAdmin();

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const r = await doRefreshOne(supabase, assetId, opts);
  return { success: r.success, error: r.error, updatedFields: r.updatedFields };
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
  failuresByCategory: Record<CatastroFailureCategory, number>;
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
        return applyCatastroOverwrite(asset, partial);
      })
    );
    out.push(...batch);
    if (i + CONCURRENCY < assets.length) await sleep(BATCH_DELAY_MS);
  }

  return { assets: out, ok, skipped, failed, failuresByCategory: tallyFailures(failed) };
}

/**
 * Reintenta el enriquecimiento Catastro sólo para los ids dados (típicamente
 * los que fallaron en un upload previo con errores transitorios HTTP 5xx/429
 * o timeouts). Carga los assets actuales desde la BD, ejecuta enrichAssetsBatch
 * y persiste los enriquecidos vía upsertAssets. Devuelve estadísticas listas
 * para mostrar en la UI.
 */
export async function retryCatastroForIds(ids: string[]): Promise<{
  attempted: number;
  ok: number;
  skipped: number;
  failed: CatastroEnrichFailure[];
  failuresByCategory: Record<CatastroFailureCategory, number>;
  upsertErrors: string[];
}> {
  const { requireAdmin } = await import("@/lib/auth-server");
  await requireAdmin();
  const { createServiceClient } = await import("@/lib/supabase/server");
  const { rowToAsset } = await import("@/lib/supabase/db");

  const unique = Array.from(new Set((ids ?? []).map(s => String(s ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) {
    return {
      attempted: 0, ok: 0, skipped: 0, failed: [],
      failuresByCategory: tallyFailures([]),
      upsertErrors: [],
    };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("assets").select("*").in("id", unique);
  if (error) {
    return {
      attempted: unique.length, ok: 0, skipped: 0,
      failed: unique.map(id => ({ id, ref: "", error: error.message })),
      failuresByCategory: tallyFailures(unique.map(id => ({ id, ref: "", error: error.message }))),
      upsertErrors: [error.message],
    };
  }

  const assets = (data ?? []).map(rowToAsset);
  const result = await enrichAssetsBatch(assets);

  const upsertErrors: string[] = [];
  if (result.assets.length > 0) {
    try {
      const r = await upsertAssets(result.assets);
      if (r.errors.length > 0) upsertErrors.push(...r.errors);
    } catch (e) {
      upsertErrors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return {
    attempted: unique.length,
    ok: result.ok,
    skipped: result.skipped,
    failed: result.failed,
    failuresByCategory: result.failuresByCategory,
    upsertErrors,
  };
}

export type ForceCatastroItem = {
  id: string;
  ref: string;
  success: boolean;
  updatedFields?: string[];
  error?: string;
  ms: number;
};

export type ForceCatastroResult = {
  total: number;
  ok: number;
  failed: number;
  results: ForceCatastroItem[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Bulk equivalent of the per-asset "Forzar" button: re-applies Catastro data
 * to every selected asset using the SAME internal flow as refreshAssetCatastro
 * with forceOverwrite:true. Per-item failures do not abort the batch.
 */
export async function forceRefreshAssetsCatastro(ids: string[]): Promise<ForceCatastroResult> {
  const { requireAdmin } = await import("@/lib/auth-server");
  await requireAdmin();

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const unique = Array.from(new Set((ids ?? []).map(s => String(s ?? "").trim()).filter(Boolean)));
  const startedAt = new Date().toISOString();
  const results: ForceCatastroItem[] = [];

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const slice = unique.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(
      slice.map(async (id): Promise<ForceCatastroItem> => {
        const t0 = Date.now();
        try {
          const r = await doRefreshOne(supabase, id, { forceOverwrite: true });
          return {
            id,
            ref: r.ref ?? "",
            success: r.success,
            updatedFields: r.updatedFields,
            error: r.error,
            ms: Date.now() - t0,
          };
        } catch (e) {
          return {
            id,
            ref: "",
            success: false,
            error: e instanceof Error ? e.message : String(e),
            ms: Date.now() - t0,
          };
        }
      })
    );
    results.push(...batch);
    if (i + CONCURRENCY < unique.length) await sleep(BATCH_DELAY_MS);
  }

  const ok = results.filter(r => r.success).length;
  const failed = results.length - ok;
  return {
    total: unique.length,
    ok,
    failed,
    results,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
