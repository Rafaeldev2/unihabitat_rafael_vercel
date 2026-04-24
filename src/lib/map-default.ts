export const OSM_FALLBACK_MAP =
  "https://staticmap.openstreetmap.de/staticmap?center=40.4168,-3.7038&zoom=6&size=600x400";

const MADRID_LON = "-3.7038";
const MADRID_LAT = "40.4168";

/**
 * Mapa “genérico” de España (Madrid, zoom 6) usado al importar sin hoja Enriquecido
 * o cuando el backfill aún no ha corrido. No es el mapa real del activo.
 */
export function isPlaceholderMapUrl(m: string | null | undefined): boolean {
  if (m == null || !String(m).trim()) return true;
  let s = m;
  try {
    s = decodeURIComponent(m);
  } catch {
    /* usar raw */
  }
  const u = s.toLowerCase();
  if (u.includes("maps.geoapify.com")) {
    if (u.includes("lonlat:" + madridLonLatKey()) && u.includes("zoom=6")) return true;
  }
  if (u.includes("staticmap.openstreetmap.de")) {
    if (u.includes("40.4168") && u.includes("-3.7038") && u.includes("zoom=6")) return true;
  }
  return false;
}

function madridLonLatKey(): string {
  return MADRID_LON + "," + MADRID_LAT;
}

function hasUsableAddress(a: { addr: string; pob: string; prov: string; cp: string }): boolean {
  return [a.addr, a.pob, a.prov, a.cp].some(
    p => p != null && p !== "—" && String(p).trim() !== "",
  );
}

/**
 * Indica si conviene disparar `backfillMissingMaps` (geocodificación) para el activo.
 * Incluye el caso Geoapify “España / Madrid” que antes no se detectaba.
 */
export function shouldBackfillMapFromAddress(a: {
  map?: string;
  lat?: number | null;
  lng?: number | null;
  addr: string;
  pob: string;
  prov: string;
  cp: string;
}): boolean {
  if (isPlaceholderMapUrl(a.map)) return true;
  if (a.map?.includes("staticmap.openstreetmap.de")) return true;
  if (a.lat == null && a.lng == null) return hasUsableAddress(a);
  return false;
}

/**
 * URL por defecto en importación Excel (bundle cliente: NEXT_PUBLIC_GEOAPIFY_KEY opcional).
 */
export function defaultMapUrlForClient(): string {
  const k =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim() ?? "" : "";
  if (k) {
    return `https://maps.geoapify.com/v1/staticmap?center=lonlat:${MADRID_LON},${MADRID_LAT}&zoom=6&width=600&height=400&style=osm-bright&apiKey=${encodeURIComponent(k)}`;
  }
  return OSM_FALLBACK_MAP;
}
