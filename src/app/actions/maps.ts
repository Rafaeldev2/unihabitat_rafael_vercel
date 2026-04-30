"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { rowToAsset } from "@/lib/supabase/db";
import { shouldBackfillMapFromAddress } from "@/lib/map-default";
import { geocodeLadder, type GeoMethod } from "@/lib/catastro/geocode-ladder";
import { logGeo, safeSnippet } from "@/lib/catastro/geoapify-logger";

const CONCURRENCY = 4;
const DELAY_MS = 200;
const RETRY_DELAY_MS = 1000;

type AssetStub = {
  id: string;
  addr: string;
  pob: string;
  prov: string;
  cp: string;
  // Campos extendidos que el ladder usa cuando los recibe; opcionales para
  // mantener compatibilidad con llamadores existentes (context.tsx pasa
  // solo los 5 campos básicos).
  fullAddr?: string;
  tvia?: string;
  nvia?: string;
  num?: string;
  catRef?: string;
  cref?: string;
  lat?: number | null;
  lng?: number | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export type BackfillMapHit = {
  map: string;
  lat: number;
  lng: number;
  method: GeoMethod;
  confidence: number;
};

export interface BackfillResult {
  /** Coords + URL por activo (clave = id). Útil para fusionar en el cliente. */
  hits: Record<string, BackfillMapHit>;
  /** Cuántos activos se persistieron en BD con éxito. */
  persisted: number;
  /** Mensaje de error de Supabase si el upsert final falló (todos o algunos). */
  persistError: string | null;
  /** IDs que no consiguieron geocodificarse (todos los pasos del ladder fallaron). */
  unresolved: string[];
}

function isTransientUpsertError(message: string): boolean {
  // Errores 5xx, timeout, connection reset → reintento. RLS / schema → no.
  return /timeout|timed? out|fetch failed|ECONNRESET|ENETUNREACH|EAI_AGAIN|503|502|504/i.test(message);
}

/**
 * Geocodifica una lista de "stubs" usando el ladder y persiste el resultado
 * en Supabase. A diferencia de la versión previa, esta:
 *
 *  1. Usa el ladder de 7 pasos (direct → catastro → fullAddr → addr/recon
 *     → structured → coarse), no solo `geocodeAssetStub`.
 *  2. Captura el error del upsert en lugar de tragarselo. Reintenta una vez
 *     con back-off si el error es transitorio.
 *  3. Devuelve un resumen estructurado con `persisted` / `persistError` /
 *     `unresolved` para que la UI pueda distinguir las tres causas de fallo.
 */
export async function backfillMissingMaps(
  stubs: AssetStub[],
): Promise<BackfillResult> {
  if (stubs.length === 0) {
    return { hits: {}, persisted: 0, persistError: null, unresolved: [] };
  }

  const hits: Record<string, BackfillMapHit> = {};
  const unresolved: string[] = [];

  // Procesamos en lotes de CONCURRENCY para no saturar Geoapify.
  for (let i = 0; i < stubs.length; i += CONCURRENCY) {
    const batch = stubs.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (s) => {
        const ladderHit = await geocodeLadder({
          id: s.id,
          addr: s.addr,
          fullAddr: s.fullAddr,
          cp: s.cp,
          pob: s.pob,
          prov: s.prov,
          tvia: s.tvia,
          nvia: s.nvia,
          num: s.num,
          lat: s.lat,
          lng: s.lng,
          catRef: s.catRef,
          cref: s.cref,
        });
        if (!ladderHit) return null;
        // El ladder devuelve mapUrl vacío si no hay clave Geoapify servidor.
        // En ese caso intentamos sintetizar un OSM-static fallback igual que
        // `applyMapFromLatLng`, así nunca persistimos `map: ""`.
        const url =
          ladderHit.mapUrl ||
          `https://staticmap.openstreetmap.de/staticmap?center=${ladderHit.lat},${ladderHit.lng}&zoom=15&size=600x400`;
        return { id: s.id, hit: { map: url, lat: ladderHit.lat, lng: ladderHit.lng, method: ladderHit.method, confidence: ladderHit.confidence } };
      }),
    );

    for (let k = 0; k < settled.length; k++) {
      const v = settled[k];
      if (v) {
        hits[v.id] = v.hit;
      } else {
        unresolved.push(batch[k].id);
      }
    }

    if (i + CONCURRENCY < stubs.length) await sleep(DELAY_MS);
  }

  // Persistencia: ya NO es un best-effort silencioso. Si falla, lo decimos.
  let persisted = 0;
  let persistError: string | null = null;

  if (Object.keys(hits).length > 0) {
    const sb = await createServiceClient();
    const updates = Object.entries(hits).map(([id, hit]) => ({
      id, map: hit.map,
      ...(isFinite(hit.lat) ? { lat: hit.lat } : {}),
      ...(isFinite(hit.lng) ? { lng: hit.lng } : {}),
    }));

    const attempt = async (): Promise<{ error: string | null }> => {
      const { error } = await sb.from("assets").upsert(updates, {
        onConflict: "id",
        ignoreDuplicates: false,
      });
      return { error: error?.message ?? null };
    };

    let { error } = await attempt();
    if (error && isTransientUpsertError(error)) {
      logGeo({
        op: "backfill:upsert-retry",
        reason: "db-error",
        ok: false,
        message: safeSnippet(error, 200),
        meta: { rows: updates.length },
      });
      await sleep(RETRY_DELAY_MS);
      ({ error } = await attempt());
    }

    if (error) {
      persistError = error;
      logGeo({
        op: "backfill:upsert",
        reason: "db-error",
        ok: false,
        message: safeSnippet(error, 200),
        meta: { rows: updates.length },
      });
    } else {
      persisted = updates.length;
      logGeo({
        op: "backfill:upsert",
        reason: "ok",
        ok: true,
        meta: { rows: updates.length },
      });
    }
  }

  return { hits, persisted, persistError, unresolved };
}

export interface BackfillUploadedSummary {
  requested: number;
  /** Filas que el ladder consiguió geocodificar. */
  geocoded: number;
  /** Filas que el ladder NO pudo resolver. */
  unresolved: number;
  /** Filas confirmadas con lat/lng en BD tras el upsert (read-back). */
  persisted: number;
  /** IDs que el ladder geocodificó pero NO aparecen con lat/lng en BD. */
  driftIds: string[];
  /** IDs sin coords tras el ladder. */
  unresolvedIds: string[];
  /** Mensaje de error del upsert (RLS, schema, conectividad), si aplica. */
  persistError: string | null;
  /** Distribución por método ganador del ladder. */
  byMethod: Partial<Record<GeoMethod, number>>;
}

/**
 * Camino "happy path" llamado desde el modal de subida tras `upsertAssets`.
 *
 *  1. Lee las filas recién persistidas con service role.
 *  2. Filtra las que necesitan geocodificación (sin coords, mapa placeholder, etc.).
 *  3. Pasa los stubs ENRIQUECIDOS (incluyendo catRef y fullAddr) al ladder.
 *  4. Verifica con un read-back que las filas tienen lat/lng en BD.
 *  5. Devuelve un resumen detallado para que el modal lo muestre al usuario.
 */
export async function backfillUploadedMaps(
  ids: string[],
): Promise<BackfillUploadedSummary> {
  const empty: BackfillUploadedSummary = {
    requested: 0, geocoded: 0, unresolved: 0, persisted: 0,
    driftIds: [], unresolvedIds: [], persistError: null, byMethod: {},
  };
  if (ids.length === 0) return empty;

  const sb = await createServiceClient();
  const { data, error } = await sb
    .from("assets")
    .select("*")
    .in("id", ids);
  if (error) {
    logGeo({
      op: "backfillUploadedMaps:fetch",
      reason: "db-error",
      ok: false,
      message: safeSnippet(error.message, 200),
    });
    return { ...empty, requested: ids.length, persistError: error.message };
  }

  const rows = (data ?? []).map(rowToAsset);
  const candidates = rows.filter((a) => shouldBackfillMapFromAddress(a));
  const stubs: AssetStub[] = candidates.map((a) => ({
    id: a.id,
    addr: a.addr ?? "",
    pob: a.pob ?? "",
    prov: a.prov ?? "",
    cp: a.cp ?? "",
    fullAddr: a.fullAddr ?? "",
    tvia: a.tvia ?? "",
    nvia: a.nvia ?? "",
    num: a.num ?? "",
    catRef: a.catRef ?? "",
    cref: a.adm?.cref ?? "",
    lat: a.lat ?? null,
    lng: a.lng ?? null,
  }));

  const result = await backfillMissingMaps(stubs);

  // Distribución por método ganador.
  const byMethod: Partial<Record<GeoMethod, number>> = {};
  for (const hit of Object.values(result.hits)) {
    byMethod[hit.method] = (byMethod[hit.method] ?? 0) + 1;
  }

  // Read-back: confirmamos que cada hit existe realmente en BD con lat/lng.
  const hitIds = Object.keys(result.hits);
  let driftIds: string[] = [];
  if (hitIds.length > 0) {
    const { data: verified, error: verifyErr } = await sb
      .from("assets")
      .select("id, lat, lng")
      .in("id", hitIds);
    if (verifyErr) {
      logGeo({
        op: "backfillUploadedMaps:readback",
        reason: "db-error",
        ok: false,
        message: safeSnippet(verifyErr.message, 200),
      });
      // Si el read-back falla, no podemos confirmar drift; lo dejamos en 0
      // para no inventar errores, pero `persistError` ya cubre el caso si el
      // upsert original también falló.
    } else {
      const present = new Map<string, { lat: number | null; lng: number | null }>();
      for (const r of verified ?? []) {
        present.set(String(r.id), { lat: (r as { lat: number | null }).lat, lng: (r as { lng: number | null }).lng });
      }
      driftIds = hitIds.filter((id) => {
        const row = present.get(id);
        if (!row) return true;
        return row.lat == null || row.lng == null;
      });
    }
  }

  return {
    requested: ids.length,
    geocoded: hitIds.length,
    unresolved: result.unresolved.length,
    persisted: result.persisted - driftIds.length,
    driftIds,
    unresolvedIds: result.unresolved,
    persistError: result.persistError,
    byMethod,
  };
}
