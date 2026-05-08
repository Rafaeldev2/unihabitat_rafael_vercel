/** Clave localStorage para el consentimiento de cookies (RGPD / ePrivacy). */
export const COOKIE_CONSENT_STORAGE_KEY = "unihabitat_cookie_consent";

export type CookieConsentValue = "accepted" | "rejected";

export function getStoredCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (raw === "accepted" || raw === "rejected") return raw;
    return null;
  } catch {
    return null;
  }
}

export function setStoredCookieConsent(value: CookieConsentValue): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: { value } }));
  } catch {
    /* almacenamiento bloqueado */
  }
}
