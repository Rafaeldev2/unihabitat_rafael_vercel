"use server";

import { getServerGeoapifyKeyInfo, type ServerKeySource } from "@/lib/catastro/geoapify";
import { getRecentGeoEvents, type GeoEvent } from "@/lib/catastro/geoapify-logger";
import { requireAdmin } from "@/lib/auth-server";

export interface GeoapifyPingResult {
  /** Si la clave está presente en el entorno servidor. */
  keyPresent: boolean;
  /** De dónde se resolvió la clave: GEOAPIFY_API_KEY (preferido), NEXT_PUBLIC_GEOAPIFY_KEY (fallback) o "none". */
  keySource: ServerKeySource;
  /** Longitud de la clave (para verificar que no está truncada al editar `.env.local`). */
  keyLength: number;
  /** Estado HTTP de la llamada Geoapify. */
  httpStatus: number;
  /** true si el endpoint respondió 200 con coordenadas válidas. */
  ok: boolean;
  /** Coordenadas devueltas si el ping resolvió. */
  coords: { lat: string; lon: string } | null;
  /** Primeros 200 chars del cuerpo (para diagnosticar 401/403/429). */
  bodySnippet: string;
  /** Mensaje de error si la petición lanzó (timeout, DNS, etc.). */
  errorMessage: string | null;
  /** Tiempo total en milisegundos. */
  durationMs: number;
}

/**
 * Llama una vez al endpoint de geocoding de Geoapify con un texto fijo
 * ("Madrid, España") y reporta el resultado completo. Pensado para ser
 * disparado desde un botón de diagnóstico en `/admin/config` cuando el
 * operador acaba de cambiar `.env.local` y quiere confirmar que la clave
 * funciona. Tres segundos, sin Excel.
 */
export async function pingGeoapify(): Promise<GeoapifyPingResult> {
  await requireAdmin();
  const t0 = Date.now();
  const info = getServerGeoapifyKeyInfo();
  const empty: GeoapifyPingResult = {
    keyPresent: !!info.key,
    keySource: info.source,
    keyLength: info.key.length,
    httpStatus: 0,
    ok: false,
    coords: null,
    bodySnippet: "",
    errorMessage: null,
    durationMs: 0,
  };

  if (!info.key) {
    return { ...empty, errorMessage: "No hay clave Geoapify configurada en el entorno servidor (revisa .env.local)" };
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", "Madrid, España");
  url.searchParams.set("apiKey", info.key);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "es");

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const status = res.status;
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      return {
        ...empty,
        httpStatus: status,
        durationMs: Date.now() - t0,
        bodySnippet: body.slice(0, 200),
        errorMessage: `HTTP ${status}`,
      };
    }
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c || c.length < 2 || typeof c[0] !== "number" || typeof c[1] !== "number") {
      return {
        ...empty,
        httpStatus: status,
        durationMs: Date.now() - t0,
        errorMessage: "Respuesta sin coordenadas (¿quota agotada o respuesta inesperada?)",
        bodySnippet: JSON.stringify(data).slice(0, 200),
      };
    }
    return {
      ...empty,
      httpStatus: status,
      ok: true,
      durationMs: Date.now() - t0,
      coords: { lon: String(c[0]), lat: String(c[1]) },
    };
  } catch (err) {
    return {
      ...empty,
      durationMs: Date.now() - t0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Devuelve los últimos eventos del logger Geoapify para que el panel de
 * diagnóstico pueda mostrarlos sin acceder al servidor en tiempo real.
 */
export async function fetchRecentGeoEvents(limit = 50): Promise<GeoEvent[]> {
  await requireAdmin();
  return getRecentGeoEvents(limit);
}
