/**
 * Tutorial de demos F1–F3: solo staging / local.
 * Nunca activar NEXT_PUBLIC_SHOW_STAGING_GUIDE en el proyecto Vercel de producción.
 */

const PROD_HOSTS = new Set(["www.unihabitat.net", "unihabitat.net"]);

export function isStagingGuideEnabled(hostname?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_SHOW_STAGING_GUIDE !== "true") return false;
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : null);
  if (host && PROD_HOSTS.has(host)) return false;
  return true;
}
