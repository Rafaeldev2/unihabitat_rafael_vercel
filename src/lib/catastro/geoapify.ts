/**
 * Geocodificación y mapas estáticos Geoapify (servidor).
 * Usa GEOAPIFY_API_KEY; puede reutilizarse NEXT_PUBLIC_GEOAPIFY_KEY en build si solo hay una.
 *
 * Todas las rutas de error se loguean con categorías estables (`logGeo`) para
 * que el operador pueda distinguir "dirección no encontrada" de "API key
 * rechazada" sin tener que parsear stack traces.
 */

import { logGeo, classifyFetchError, safeSnippet } from "./geoapify-logger";

export type ServerKeySource = "GEOAPIFY_API_KEY" | "NEXT_PUBLIC_GEOAPIFY_KEY" | "none";

/** Devuelve la clave + el origen para que las herramientas de diagnóstico puedan reportarlo. */
export function getServerGeoapifyKeyInfo(): { key: string; source: ServerKeySource } {
  const primary = process.env.GEOAPIFY_API_KEY?.trim();
  if (primary) return { key: primary, source: "GEOAPIFY_API_KEY" };
  const fallback = process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim();
  if (fallback) return { key: fallback, source: "NEXT_PUBLIC_GEOAPIFY_KEY" };
  return { key: "", source: "none" };
}

function getServerGeoapifyKey(): string {
  return getServerGeoapifyKeyInfo().key;
}

export function buildStaticMapUrl(lon: string, lat: string, apiKey?: string): string {
  const key = apiKey ?? getServerGeoapifyKey();
  if (!key || !lon || !lat) return "";
  const lo = lon.trim();
  const la = lat.trim();
  if (!lo || !la) return "";
  return `https://maps.geoapify.com/v1/staticmap?center=lonlat:${lo},${la}&zoom=15&width=600&height=400&style=osm-bright&apiKey=${encodeURIComponent(key)}`;
}

export interface GeocodeHit {
  lon: string;
  lat: string;
}

function coordsFromGeoapifyJson(data: {
  features?: { geometry?: { coordinates?: [number, number] } }[];
}): GeocodeHit | null {
  const c = data.features?.[0]?.geometry?.coordinates;
  if (!c || c.length < 2) return null;
  const [lon, lat] = c;
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  return { lon: String(lon), lat: String(lat) };
}

/**
 * Geocodifica texto (dirección + municipio + provincia) con Geoapify.
 * Cualquier fallo se loguea con categoría: 401/429/5xx, timeout, network, json,
 * sin clave, o sin coincidencia. Sigue devolviendo `null` para no romper a los
 * llamadores; la diferencia es que ahora deja rastro.
 */
export async function geocodeAddressLine(text: string, assetId?: string): Promise<GeocodeHit | null> {
  const t0 = Date.now();
  const key = getServerGeoapifyKey();
  const q = text.trim();
  if (!key) {
    logGeo({ op: "geocodeAddressLine", reason: "no-key", ok: false, assetId, textSnippet: safeSnippet(q, 120) });
    return null;
  }
  if (!q) {
    logGeo({ op: "geocodeAddressLine", reason: "no-input", ok: false, assetId });
    return null;
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", q);
  url.searchParams.set("apiKey", key);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "es");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      logGeo({
        op: "geocodeAddressLine",
        reason: `http_${res.status}` as const,
        ok: false,
        status: res.status,
        durationMs: Date.now() - t0,
        assetId,
        textSnippet: safeSnippet(q, 120),
        bodySnippet: safeSnippet(body, 200),
      });
      return null;
    }
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const hit = coordsFromGeoapifyJson(data);
    logGeo({
      op: "geocodeAddressLine",
      reason: hit ? "ok" : "no-match",
      ok: !!hit,
      durationMs: Date.now() - t0,
      assetId,
      textSnippet: safeSnippet(q, 120),
    });
    return hit;
  } catch (err) {
    logGeo({
      op: "geocodeAddressLine",
      reason: classifyFetchError(err),
      ok: false,
      durationMs: Date.now() - t0,
      assetId,
      textSnippet: safeSnippet(q, 120),
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

const GEO_EMPTY = new Set(["", "—"]);

function geoClean(s: string | undefined | null): string {
  if (s == null) return "";
  const t = String(s).trim();
  if (GEO_EMPTY.has(t)) return "";
  return t;
}

/**
 * Texto libre primero; luego postcode + city + state con filter=countrycode:es.
 * Mantiene el contrato existente — devuelve la primera coincidencia o null.
 * Los pasos extra del "ladder" (Catastro, fullAddr, reconstrucción) viven en
 * `geocode-ladder.ts`; este stub conserva el comportamiento mínimo histórico
 * para no romper a los llamadores que no usan el ladder.
 *
 * @see https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
 */
export async function geocodeAssetStub(stub: {
  addr: string;
  cp: string;
  pob: string;
  prov: string;
}, assetId?: string): Promise<GeocodeHit | null> {
  const t0 = Date.now();
  const key = getServerGeoapifyKey();
  if (!key) {
    logGeo({ op: "geocodeAssetStub", reason: "no-key", ok: false, assetId });
    return null;
  }

  const addr = geoClean(stub.addr);
  const cp = geoClean(stub.cp);
  const pob = geoClean(stub.pob);
  const prov = geoClean(stub.prov);

  if (!addr && !cp && !pob && !prov) {
    logGeo({ op: "geocodeAssetStub", reason: "no-input", ok: false, assetId });
    return null;
  }

  if (addr || (cp && pob)) {
    const parts = [addr, cp, pob, prov].filter(Boolean);
    if (parts.length > 0) {
      const hit = await geocodeAddressLine(`${parts.join(", ")}, España`, assetId);
      if (hit) return hit;
    }
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("apiKey", key);
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "es");
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:es");
    let hasStruct = false;
    if (cp) {
      url.searchParams.set("postcode", cp);
      hasStruct = true;
    }
    if (pob) {
      url.searchParams.set("city", pob);
      hasStruct = true;
    }
    if (prov) {
      url.searchParams.set("state", prov);
      hasStruct = true;
    }
    if (!hasStruct) {
      logGeo({ op: "geocodeAssetStub:structured", reason: "no-input", ok: false, assetId });
      return null;
    }

    const queryDescription = `cp=${cp} pob=${pob} prov=${prov}`;
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      logGeo({
        op: "geocodeAssetStub:structured",
        reason: `http_${res.status}` as const,
        ok: false,
        status: res.status,
        durationMs: Date.now() - t0,
        assetId,
        textSnippet: safeSnippet(queryDescription, 120),
        bodySnippet: safeSnippet(body, 200),
      });
      return null;
    }
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const hit = coordsFromGeoapifyJson(data);
    logGeo({
      op: "geocodeAssetStub:structured",
      reason: hit ? "ok" : "no-match",
      ok: !!hit,
      durationMs: Date.now() - t0,
      assetId,
      textSnippet: safeSnippet(queryDescription, 120),
    });
    return hit;
  } catch (err) {
    logGeo({
      op: "geocodeAssetStub:structured",
      reason: classifyFetchError(err),
      ok: false,
      durationMs: Date.now() - t0,
      assetId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function buildGeocodeQuery(row: {
  direccionCompleta: string;
  municipio: string;
  provincia: string;
  codigoPostal: string;
}): string {
  const parts = [row.direccionCompleta, row.codigoPostal, row.municipio, row.provincia].filter(
    p => p && String(p).trim() !== ""
  );
  return parts.join(", ");
}
