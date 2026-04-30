/**
 * Logger ligero para diagnosticar la integración con Geoapify.
 *
 * Antes, todas las rutas de error se tragaban con `catch {}` o un
 * `if (!res.ok) return null` mudo. Resultado: no había forma de distinguir
 * "la dirección no se encontró" de "la API key es inválida" o "Supabase
 * rechazó el upsert". Este módulo añade visibilidad sin cambiar comportamiento:
 *
 *  - cada evento se clasifica por categoría (`reason`)
 *  - los eventos se imprimen en `console` (warn/error según severidad)
 *  - los últimos N eventos se guardan en un anillo accesible vía
 *    `getRecentGeoEvents()` para el panel de diagnóstico admin
 *
 * Es deliberadamente "best-effort": nunca lanza, nunca bloquea, y los costes
 * de memoria son despreciables (anillo fijo de 200 entradas).
 */

export type GeoEventReason =
  | "ok"
  | "no-key"
  | "no-input"
  | "no-match"
  | `http_${number}`
  | "timeout"
  | "abort"
  | "network"
  | "json"
  | "db-error"
  | "unknown";

export interface GeoEvent {
  ts: string;            // ISO timestamp
  op: string;            // "geocodeAddressLine" | "geocodeAssetStub" | "ladder:catastro" | "backfill:upsert" ...
  reason: GeoEventReason;
  ok: boolean;
  durationMs?: number;
  assetId?: string;
  textSnippet?: string;  // primeros 120 chars de la query enviada (sin la apiKey)
  bodySnippet?: string;  // primeros 200 chars de la respuesta (errores HTTP)
  message?: string;
  status?: number;
  meta?: Record<string, unknown>;
}

const RING_SIZE = 200;
const ring: GeoEvent[] = [];

export function logGeo(event: Omit<GeoEvent, "ts">): void {
  const full: GeoEvent = { ts: new Date().toISOString(), ...event };
  ring.push(full);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);

  const tag = `[geoapify]`;
  const head = `${tag} op=${full.op} reason=${full.reason} ok=${full.ok}` +
    (full.assetId ? ` id=${full.assetId}` : "") +
    (full.status ? ` status=${full.status}` : "") +
    (full.durationMs != null ? ` ${full.durationMs}ms` : "");

  if (full.ok) {
    // eslint-disable-next-line no-console
    console.log(head + (full.textSnippet ? ` text="${full.textSnippet}"` : ""));
    return;
  }

  // Configuración (no-key / 401 / 403) y errores de BD: error level.
  const isConfigError =
    full.reason === "no-key" || full.reason === "http_401" || full.reason === "http_403" || full.reason === "db-error";
  const detail =
    (full.message ? ` msg="${full.message}"` : "") +
    (full.bodySnippet ? ` body="${full.bodySnippet}"` : "") +
    (full.textSnippet ? ` text="${full.textSnippet}"` : "");

  if (isConfigError) {
    // eslint-disable-next-line no-console
    console.error(head + detail);
  } else {
    // eslint-disable-next-line no-console
    console.warn(head + detail);
  }
}

/** Devuelve los últimos eventos en orden cronológico (más recientes al final). */
export function getRecentGeoEvents(limit = RING_SIZE): GeoEvent[] {
  if (limit >= ring.length) return ring.slice();
  return ring.slice(ring.length - limit);
}

/** Limpia el anillo. Útil en tests para aislar suites. */
export function clearGeoEvents(): void {
  ring.length = 0;
}

/** Clasifica un error nativo (`AbortError`, `TypeError` de fetch, etc.) en una categoría estable. */
export function classifyFetchError(err: unknown): GeoEventReason {
  if (err == null) return "unknown";
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || /aborted|abort/i.test(msg)) return "abort";
  if (name === "TimeoutError" || /timeout|timed? out/i.test(msg)) return "timeout";
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|getaddrinfo/i.test(msg)) return "network";
  if (/json|unexpected token/i.test(msg)) return "json";
  return "unknown";
}

/** Recorta texto y elimina la apiKey de URLs antes de loguear. */
export function safeSnippet(s: string | null | undefined, max = 200): string {
  if (s == null) return "";
  return String(s).replace(/apiKey=[^&\s"]+/gi, "apiKey=<redacted>").slice(0, max);
}
