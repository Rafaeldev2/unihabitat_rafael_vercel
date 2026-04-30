/**
 * "Geocode ladder" — secuencia ordenada de estrategias de resolución de
 * coordenadas para un activo. Cada paso devuelve una pista (`hit`) o null;
 * el primero que acierta gana. Permite añadir/quitar pasos sin tocar el
 * resto del pipeline.
 *
 * Razón de existir: el `geocodeAssetStub` original solo intentaba dos pasos
 * (texto libre y estructurado). Cuando el Excel trae datos sucios o
 * incompletos, la única vía fiable era pulsar "Forzar" en la ficha — que
 * usa Catastro DNP para obtener una dirección canónica y luego geocodificarla.
 * Este ladder convierte ese camino en automático para todos los activos
 * importados, manteniendo los pasos baratos (direct, addr+cp+pob) primero
 * y las consultas más caras (Catastro) detrás.
 */

import {
  buildGeocodeQuery,
  buildStaticMapUrl,
  geocodeAddressLine,
  type GeocodeHit,
} from "./geoapify";
import {
  fetchConsultaDnprc,
  isPlausibleCadastralRef,
  normalizeCadastralRef,
} from "./dnp";
import { logGeo } from "./geoapify-logger";

export type GeoMethod =
  | "direct"        // ya tiene lat/lng en la fila
  | "catastro"      // catRef → DNP → dirección canónica → geocode
  | "fulladdr"      // texto libre completo
  | "reconstructed" // tvia + nvia + num + cp + pob + prov
  | "structured"    // postcode + city + state estructurado
  | "coarse:cp+pob+prov"
  | "coarse:cp+pob"
  | "coarse:pob+prov"
  | "coarse:cp"
  | "coarse:pob";

export interface LadderInput {
  id: string;
  // Datos directos del Excel (pueden venir vacíos / "—")
  addr?: string | null;
  fullAddr?: string | null;
  cp?: string | null;
  pob?: string | null;
  prov?: string | null;
  tvia?: string | null;
  nvia?: string | null;
  num?: string | null;
  // Coords si ya las trae la fila (Enriquecido)
  lat?: number | null;
  lng?: number | null;
  // Referencia catastral en cualquiera de sus formas
  catRef?: string | null;
  cref?: string | null;
}

export interface LadderHit {
  method: GeoMethod;
  lat: number;
  lng: number;
  /** URL de mapa estático Geoapify (vacío si no hay clave servidor). */
  mapUrl: string;
  /** Confianza relativa de 0..1 — útil para UI ("approximate" vs "precise"). */
  confidence: number;
  /** Datos canónicos que el paso obtuvo y que pueden usarse para enriquecer la fila. */
  canonical?: {
    fullAddr?: string;
    cp?: string;
    pob?: string;
    prov?: string;
  };
}

const EMPTY = new Set(["", "—"]);
function clean(s: string | null | undefined): string {
  if (s == null) return "";
  const t = String(s).trim();
  return EMPTY.has(t) ? "" : t;
}

function n2s(n: number): string {
  return Number.isFinite(n) ? String(n) : "";
}

function buildHit(method: GeoMethod, hit: GeocodeHit, confidence: number, canonical?: LadderHit["canonical"]): LadderHit {
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  const mapUrl = buildStaticMapUrl(hit.lon, hit.lat) || "";
  return { method, lat, lng, mapUrl, confidence, canonical };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — coords ya presentes (camino más rápido, no llama a Geoapify).
// ─────────────────────────────────────────────────────────────────────────────
async function tryDirect(input: LadderInput): Promise<LadderHit | null> {
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
  if (lat == null || lng == null) return null;
  const mapUrl = buildStaticMapUrl(n2s(lng), n2s(lat)) || "";
  logGeo({ op: "ladder:direct", reason: "ok", ok: true, assetId: input.id });
  return { method: "direct", lat, lng, mapUrl, confidence: 1.0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — Catastro DNP → dirección canónica → geocode.
// Esto es exactamente lo que hace el botón "Forzar" para un único activo;
// aquí lo aplicamos automáticamente en bulk durante la importación.
// ─────────────────────────────────────────────────────────────────────────────
async function tryCatastro(input: LadderInput): Promise<LadderHit | null> {
  const rawRef = clean(input.catRef) || clean(input.cref);
  if (!rawRef) return null;
  if (!isPlausibleCadastralRef(rawRef)) return null;

  const ref = normalizeCadastralRef(rawRef);
  let row;
  try {
    row = await fetchConsultaDnprc(ref);
  } catch (err) {
    logGeo({
      op: "ladder:catastro",
      reason: "network",
      ok: false,
      assetId: input.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
  if (row.error) {
    logGeo({
      op: "ladder:catastro",
      reason: "no-match",
      ok: false,
      assetId: input.id,
      message: row.error,
    });
    return null;
  }

  const query = buildGeocodeQuery({
    direccionCompleta: row.direccionCompleta,
    municipio: row.municipio,
    provincia: row.provincia,
    codigoPostal: row.codigoPostal,
  });
  if (!query.trim()) {
    logGeo({ op: "ladder:catastro", reason: "no-input", ok: false, assetId: input.id });
    return null;
  }

  const hit = await geocodeAddressLine(`${query}, España`, input.id);
  if (!hit) return null;

  return buildHit("catastro", hit, 0.95, {
    fullAddr: row.direccionCompleta,
    cp: row.codigoPostal,
    pob: row.municipio,
    prov: row.provincia,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — fullAddr libre.
// ─────────────────────────────────────────────────────────────────────────────
async function tryFullAddr(input: LadderInput): Promise<LadderHit | null> {
  const fullAddr = clean(input.fullAddr);
  if (!fullAddr) return null;
  // Adjuntamos cp/pob/prov si existen para ayudar a la desambiguación.
  const parts = [fullAddr, clean(input.cp), clean(input.pob), clean(input.prov)].filter(Boolean);
  const hit = await geocodeAddressLine(`${parts.join(", ")}, España`, input.id);
  if (!hit) return null;
  return buildHit("fulladdr", hit, 0.85);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — addr libre (con o sin reconstrucción tvia/nvia/num si addr falta).
// ─────────────────────────────────────────────────────────────────────────────
async function tryAddrOrReconstructed(input: LadderInput): Promise<LadderHit | null> {
  let addr = clean(input.addr);
  let method: GeoMethod = "fulladdr";

  if (!addr) {
    const tvia = clean(input.tvia);
    const nvia = clean(input.nvia);
    const num = clean(input.num);
    const recon = [tvia, nvia, num].filter(Boolean).join(" ").trim();
    if (!recon) return null;
    addr = recon;
    method = "reconstructed";
  }

  const parts = [addr, clean(input.cp), clean(input.pob), clean(input.prov)].filter(Boolean);
  if (parts.length === 0) return null;
  const hit = await geocodeAddressLine(`${parts.join(", ")}, España`, input.id);
  if (!hit) return null;
  return buildHit(method, hit, method === "reconstructed" ? 0.75 : 0.8);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 5 — estructurado postcode+city+state.
// ─────────────────────────────────────────────────────────────────────────────
async function tryStructured(input: LadderInput): Promise<LadderHit | null> {
  const cp = clean(input.cp);
  const pob = clean(input.pob);
  const prov = clean(input.prov);
  if (!cp && !pob && !prov) return null;

  // Reusamos `geocodeAddressLine` con un texto bien formateado: el `filter=countrycode:es`
  // ya viene implícito por el contexto "España". Esto evita duplicar la lógica de fetch
  // que ya tiene categorización de errores.
  const parts = [cp, pob, prov].filter(Boolean);
  const hit = await geocodeAddressLine(`${parts.join(", ")}, España`, input.id);
  if (!hit) return null;
  return buildHit("structured", hit, 0.65);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 6 — degradación progresiva. Solo se intenta lo que NO se ha probado ya.
// Se omite "prov solo" — devolver el centroide de provincia es engañoso.
// ─────────────────────────────────────────────────────────────────────────────
async function tryCoarse(input: LadderInput): Promise<LadderHit | null> {
  const cp = clean(input.cp);
  const pob = clean(input.pob);
  const prov = clean(input.prov);

  const combos: Array<{ method: GeoMethod; parts: string[]; conf: number }> = [];
  if (cp && pob && prov) combos.push({ method: "coarse:cp+pob+prov", parts: [cp, pob, prov], conf: 0.6 });
  if (cp && pob) combos.push({ method: "coarse:cp+pob", parts: [cp, pob], conf: 0.55 });
  if (pob && prov) combos.push({ method: "coarse:pob+prov", parts: [pob, prov], conf: 0.5 });
  if (cp) combos.push({ method: "coarse:cp", parts: [cp], conf: 0.4 });
  if (pob) combos.push({ method: "coarse:pob", parts: [pob], conf: 0.35 });

  for (const c of combos) {
    const hit = await geocodeAddressLine(`${c.parts.join(", ")}, España`, input.id);
    if (hit) return buildHit(c.method, hit, c.conf);
  }
  return null;
}

const STEPS: Array<{ name: string; run: (i: LadderInput) => Promise<LadderHit | null> }> = [
  { name: "direct", run: tryDirect },
  { name: "catastro", run: tryCatastro },
  { name: "fulladdr", run: tryFullAddr },
  { name: "addr/reconstructed", run: tryAddrOrReconstructed },
  { name: "structured", run: tryStructured },
  { name: "coarse", run: tryCoarse },
];

/**
 * Recorre el ladder y devuelve la primera coincidencia, o null si ningún
 * paso resuelve. Cada paso registra su propio evento en el logger; aquí
 * solo añadimos un evento sumario (`ok` con method ganador, o `no-match`
 * si nadie respondió).
 */
export async function geocodeLadder(input: LadderInput): Promise<LadderHit | null> {
  const t0 = Date.now();
  for (const step of STEPS) {
    const hit = await step.run(input);
    if (hit) {
      logGeo({
        op: "ladder",
        reason: "ok",
        ok: true,
        assetId: input.id,
        durationMs: Date.now() - t0,
        meta: { method: hit.method, confidence: hit.confidence },
      });
      return hit;
    }
  }
  logGeo({
    op: "ladder",
    reason: "no-match",
    ok: false,
    assetId: input.id,
    durationMs: Date.now() - t0,
  });
  return null;
}

// Exports internos para tests.
export const __ladder_internal = {
  tryDirect,
  tryCatastro,
  tryFullAddr,
  tryAddrOrReconstructed,
  tryStructured,
  tryCoarse,
};
