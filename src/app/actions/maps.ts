"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { geocodeAddressLine, buildStaticMapUrl } from "@/lib/catastro/geoapify";

const CONCURRENCY = 4;
const DELAY_MS = 200;

type AssetStub = {
  id: string;
  addr: string;
  pob: string;
  prov: string;
  cp: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export type BackfillMapHit = { map: string; lat: number; lng: number };

/**
 * Geocodifica activos y persiste `map` + `lat`/`lng` en Supabase.
 * Devuelve `map` y coordenadas para fusionar en el estado del cliente (sin depender de parsear la URL).
 */
export async function backfillMissingMaps(
  stubs: AssetStub[],
): Promise<Record<string, BackfillMapHit>> {
  if (stubs.length === 0) return {};

  const geoResults: Record<string, { url: string; lat: number; lng: number }> = {};

  for (let i = 0; i < stubs.length; i += CONCURRENCY) {
    const batch = stubs.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (s) => {
        const query = [s.addr, s.cp, s.pob, s.prov]
          .filter(p => p && p !== "—")
          .join(", ");
        if (!query) return null;

        const geo = await geocodeAddressLine(query);
        if (!geo) return null;

        const url = buildStaticMapUrl(geo.lon, geo.lat);
        if (!url) return null;

        return { id: s.id, url, lat: parseFloat(geo.lat), lng: parseFloat(geo.lon) };
      }),
    );

    for (const hit of settled) {
      if (hit) geoResults[hit.id] = { url: hit.url, lat: hit.lat, lng: hit.lng };
    }

    if (i + CONCURRENCY < stubs.length) await sleep(DELAY_MS);
  }

  if (Object.keys(geoResults).length > 0) {
    try {
      const sb = await createServiceClient();
      const updates = Object.entries(geoResults).map(([id, hit]) => ({
        id, map: hit.url,
        ...(isFinite(hit.lat) ? { lat: hit.lat } : {}),
        ...(isFinite(hit.lng) ? { lng: hit.lng } : {}),
      }));
      await sb.from("assets").upsert(updates, { onConflict: "id", ignoreDuplicates: false });
    } catch {
      /* DB update is best-effort */
    }
  }

  const results: Record<string, BackfillMapHit> = {};
  for (const [id, hit] of Object.entries(geoResults)) {
    results[id] = { map: hit.url, lat: hit.lat, lng: hit.lng };
  }
  return results;
}
