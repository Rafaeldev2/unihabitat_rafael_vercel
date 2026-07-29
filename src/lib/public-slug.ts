/**
 * Genera y normaliza slugs públicos opacos para fichas de inmueble.
 * Formato: `{tipologia}-{poblacion}-{sufijo}` (ej. piso-valdemoro-k7m4qx).
 * Nunca incluye referencia catastral ni ID1 en claro.
 */

const SUFFIX_LEN = 6;

/** Normaliza texto a segmento de slug URL-safe. */
export function slugifySegment(raw: string, maxLen = 32): string {
  const base = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return base || "x";
}

/** Sufijo opaco estable a partir del id interno (no reversible a ojo). */
export function opaqueSuffixFromId(id: string, len = SUFFIX_LEN): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  let h2 = 0;
  for (let i = 0; i < id.length; i++) h2 = (h2 * 31 + id.charCodeAt(i)) >>> 0;
  const hex2 = h2.toString(16).padStart(8, "0");
  return (hex + hex2).slice(0, len);
}

export interface PublicSlugInput {
  id: string;
  tip?: string;
  pob?: string;
  publicSlug?: string;
}

/**
 * Construye un slug canónico. Si ya existe `publicSlug` válido, lo reutiliza.
 * Ante colisión con `taken`, añade un segmento extra del hash.
 */
export function buildPublicSlug(
  asset: PublicSlugInput,
  taken: Set<string> = new Set(),
): string {
  const existing = asset.publicSlug?.trim();
  if (existing && !taken.has(existing)) return existing;

  const tip = slugifySegment(asset.tip || "inmueble");
  const pob = slugifySegment(asset.pob || "espana");
  const suffix = opaqueSuffixFromId(asset.id);
  let candidate = `${tip}-${pob}-${suffix}`;

  if (!taken.has(candidate)) return candidate;

  for (let n = 1; n < 50; n++) {
    const extra = opaqueSuffixFromId(`${asset.id}#${n}`, 4);
    candidate = `${tip}-${pob}-${suffix}-${extra}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${tip}-${pob}-${suffix}-${Date.now().toString(36)}`;
}

/** Ruta pública canónica de ficha. */
export function publicAssetPath(slug: string): string {
  return `/portal/inmueble/${encodeURIComponent(slug)}`;
}

/** Ruta privada canónica de ficha. */
export function privateAssetPath(slug: string): string {
  return `/portal/privado/inmueble/${encodeURIComponent(slug)}`;
}

/** Href portal: slug canónico, o legacy por id si aún no hay slug. */
export function assetPortalHref(asset: { publicSlug?: string; id: string }): string {
  const slug = asset.publicSlug?.trim();
  if (slug) return publicAssetPath(slug);
  return `/portal/${encodeURIComponent(asset.id)}`;
}

/** Href zona privada: slug canónico o legacy. */
export function assetPrivateHref(asset: { publicSlug?: string; id: string }): string {
  const slug = asset.publicSlug?.trim();
  if (slug) return privateAssetPath(slug);
  return `/portal/privado/${encodeURIComponent(asset.id)}`;
}
