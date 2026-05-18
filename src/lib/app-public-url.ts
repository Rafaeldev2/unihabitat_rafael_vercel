/**
 * Origen público canonico (`https://www.dominio.com`, sin slash final).
 * Usar en servidor para emails Auth (redirectTo de Supabase) y enlaces dinámicos.
 *
 * Orden:
 * 1. APP_ORIGIN — recomendado en Vercel producción cuando NEXT_PUBLIC_* se bakeó mal.
 * 2. NEXT_PUBLIC_APP_URL salvo localhost si estamos en Vercel (evita links con localhost).
 * 3. https://VERCEL_URL en cualquier deployment Vercel.
 * 4. NEXT_PUBLIC_APP_URL incluso localhost.
 * 5. localhost:3000 (solo desarrollo local).
 */

function normalizeOrigin(raw: string | undefined): string {
  const s = String(raw ?? "").trim().replace(/\/+$/, "");
  return s;
}

function isLocalOrigin(url: string): boolean {
  try {
    const u = url.startsWith("http") ? new URL(url) : new URL(`https://${url}`);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function getPublicAppOrigin(): string {
  const appOrigin = normalizeOrigin(process.env.APP_ORIGIN ?? process.env.PUBLIC_SITE_URL);
  if (appOrigin) return appOrigin;

  const published = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const onVercel = Boolean(process.env.VERCEL);

  if (published && !(onVercel && isLocalOrigin(published))) {
    return published;
  }

  const vu = normalizeOrigin(process.env.VERCEL_URL);
  if (vu && onVercel) {
    const host = vu.replace(/^https?:\/\//i, "").split("/")[0] ?? vu;
    return `https://${host}`.replace(/\/+$/, "");
  }

  if (published) return published;

  return "http://localhost:3000";
}
