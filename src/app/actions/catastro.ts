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

/**
 * Catastro enrichment se usa ahora SOLO como acción manual desde la ficha del
 * inmueble. El upload de Excel ya no enriquece en batch — los Excels traen
 * lat/lng y todos los datos físicos. Esto deja una sola función pública:
 * `refreshAssetCatastro(id)` para actualizar / forzar desde la UI.
 */

type SupabaseLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createServiceClient>>;

function applyCatastroOverwrite(asset: Asset, partial: Partial<Asset>): Asset {
  return { ...asset, ...partial };
}

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
    .from("assets").select("*").eq("id", assetId).maybeSingle();
  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!data) return { success: false, error: "Inmueble no encontrado" };

  const asset = rowToAsset(data);
  // El id del inmueble ES la Referencia catastral.
  const rawRef = asset.id;

  if (!isPlausibleCadastralRef(rawRef)) {
    return { success: false, error: `Referencia catastral no válida: "${rawRef}"`, ref: rawRef };
  }

  const ref = normalizeCadastralRef(rawRef);
  const row = await fetchConsultaDnprc(ref);
  if (row.error) return { success: false, error: row.error, ref };

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

  const updatedFields = Object.keys(partial).filter((k) => k !== "map" || mapUrl);
  const dbRow = assetToRow(enriched);
  const { error: updateErr } = await supabase
    .from("assets").update(dbRow).eq("id", assetId);
  if (updateErr) return { success: false, error: updateErr.message, ref };

  return { success: true, updatedFields, ref };
}

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
