/**
 * Tutorial de demos: solo staging / local / preview.
 * Nunca activar NEXT_PUBLIC_SHOW_STAGING_GUIDE en el proyecto Vercel de producción.
 *
 * Resolution order:
 * 1. www.unihabitat.net / unihabitat.net → always false (production hosts)
 * 2. NEXT_PUBLIC_SHOW_STAGING_GUIDE="false" → false
 * 3. NEXT_PUBLIC_SHOW_STAGING_GUIDE="true" → true (on non-prod hosts only)
 * 4. localhost / 127.0.0.1 / hostname includes "unihabitat-staging" → true
 * 5. VERCEL_ENV="preview" → true
 * 6. NODE_ENV !== "production" → true
 * 7. Otherwise → false
 */

const PROD_HOSTS = new Set(["www.unihabitat.net", "unihabitat.net"]);

export function isStagingGuideEnabled(hostname?: string | null, env?: NodeJS.ProcessEnv | null): boolean {
  const envObj = env ?? process.env;
  const flag = envObj.NEXT_PUBLIC_SHOW_STAGING_GUIDE;

  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : null);

  if (host && PROD_HOSTS.has(host.toLowerCase())) {
    return false;
  }

  if (flag === "false") {
    return false;
  }

  if (flag === "true") {
    return true;
  }

  if (host) {
    const hostLower = host.toLowerCase();
    if (hostLower === "localhost" || hostLower === "127.0.0.1") {
      return true;
    }
    if (hostLower.includes("unihabitat-staging")) {
      return true;
    }
  }

  if (envObj.VERCEL_ENV === "preview") {
    return true;
  }

  if (envObj.NODE_ENV !== "production") {
    return true;
  }

  return false;
}
