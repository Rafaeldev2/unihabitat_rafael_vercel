"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  type CookieConsentValue,
  getStoredCookieConsent,
  setStoredCookieConsent,
} from "@/lib/cookie-consent";

/**
 * Banner RGPD / ePrivacy: aviso breve, ACEPTAR / RECHAZAR y enlace a la política completa.
 * El detalle legal vive en `/legal/politica-cookies` y `/legal/privacidad`.
 */
export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(getStoredCookieConsent() === null);
  }, []);

  if (!mounted || !visible) return null;

  const choose = (value: CookieConsentValue) => {
    setStoredCookieConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border2 bg-navy px-4 py-4 text-white shadow-[0_-8px_32px_rgba(0,0,0,0.35)] md:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 id="cookie-banner-title" className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
            Aviso de cookies
          </h2>
          <p id="cookie-banner-desc" className="text-sm leading-relaxed text-white/90">
            Esta página web utiliza cookies para analizar de forma anónima y estadística el uso que haces de la web,
            mejorar los contenidos y tu experiencia de navegación. Para más información accede a la{" "}
            <Link
              href="/legal/politica-cookies"
              className="font-semibold text-gold underline decoration-gold/50 underline-offset-2 hover:text-gold2"
            >
              Política de cookies
            </Link>
            . Si pulsas <strong className="text-white">ACEPTAR</strong>, aceptas todas las cookies. Si pulsas{" "}
            <strong className="text-white">RECHAZAR</strong>, rechazas todas las cookies.
          </p>
          <p className="text-[11px] leading-snug text-white/55">
            También puede consultar la{" "}
            <Link href="/legal/privacidad" className="text-gold underline underline-offset-2 hover:text-gold2">
              Política de privacidad y aviso legal
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="order-2 rounded-lg border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:order-1"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="order-1 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-navy shadow-sm transition hover:bg-gold2 sm:order-2"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
