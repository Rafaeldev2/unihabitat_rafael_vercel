/**
 * Geocodificación y mapas estáticos Geoapify (servidor).
 * Usa GEOAPIFY_API_KEY; puede reutilizarse NEXT_PUBLIC_GEOAPIFY_KEY en build si solo hay una.
 */

function getServerGeoapifyKey(): string {
  return (
    process.env.GEOAPIFY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GEOAPIFY_KEY?.trim() ||
    ""
  );
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
 */
export async function geocodeAddressLine(text: string): Promise<GeocodeHit | null> {
  const key = getServerGeoapifyKey();
  const q = text.trim();
  if (!key || !q) return null;

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
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    return coordsFromGeoapifyJson(data);
  } catch {
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
 * @see https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
 */
export async function geocodeAssetStub(stub: {
  addr: string;
  cp: string;
  pob: string;
  prov: string;
}): Promise<GeocodeHit | null> {
  const key = getServerGeoapifyKey();
  if (!key) return null;

  const addr = geoClean(stub.addr);
  const cp = geoClean(stub.cp);
  const pob = geoClean(stub.pob);
  const prov = geoClean(stub.prov);

  if (!addr && !cp && !pob && !prov) return null;

  if (addr || (cp && pob)) {
    const parts = [addr, cp, pob, prov].filter(Boolean);
    if (parts.length > 0) {
      const hit = await geocodeAddressLine(`${parts.join(", ")}, España`);
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
    if (!hasStruct) return null;

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    return coordsFromGeoapifyJson(data);
  } catch {
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
