"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X, Lightbulb, ExternalLink } from "lucide-react";
import Link from "next/link";

const DISMISS_KEY = "uh-staging-coach-dismissed";

const PROD_HOSTS = new Set(["www.unihabitat.net", "unihabitat.net"]);

interface Tip {
  match: RegExp | string;
  title: string;
  content: string;
  link?: { href: string; label: string };
}

const TIPS: Tip[] = [
  {
    match: /^\/admin\/ofertas/,
    title: "Ofertas de agente",
    content:
      "Los agentes ahora ven solo sus propias ofertas (filtradas por vendedor_id). El título cambia a «Mis ofertas».",
    link: { href: "/admin/guia-staging#aug26-ofertas-agente", label: "Ver guía" },
  },
  {
    match: /^\/admin\/assets\/[^/]+$/,
    title: "Misma operación",
    content:
      "Si este activo comparte activoId con otros, verás un bloque «Misma operación» con enlaces a los hermanos.",
    link: { href: "/admin/guia-staging#aug26-multi-asset", label: "Ver guía" },
  },
  {
    match: /^\/portal\/contacto/,
    title: "Protección anti-bot",
    content:
      "El formulario tiene honeypot, time-trap (>=2s) y rate limit. Turnstile opcional si configurado.",
    link: { href: "/admin/guia-staging#aug26-contacto-antibot", label: "Ver guía" },
  },
  {
    match: /^\/login$/,
    title: "Recuperar contraseña",
    content:
      "Nuevo enlace «¿Olvidaste tu contraseña?» para solicitar reset (no disponible para cuentas demo).",
    link: { href: "/admin/guia-staging#aug26-password-reset", label: "Ver guía" },
  },
  {
    match: /^\/login\/reset/,
    title: "Página de reset",
    content:
      "Aquí puedes solicitar email de recuperación o cambiar tu contraseña si vienes de un enlace de reset.",
  },
];

export function StagingCoach() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [currentTip, setCurrentTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    if (PROD_HOSTS.has(host)) {
      setVisible(false);
      return;
    }

    const wasDismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(wasDismissed);
    setVisible(!wasDismissed);
  }, []);

  useEffect(() => {
    if (!visible || dismissed) return;

    if (pathname.startsWith("/admin/guia-staging")) {
      setCurrentTip(null);
      return;
    }

    const tip = TIPS.find((t) => {
      if (typeof t.match === "string") return pathname === t.match;
      return t.match.test(pathname);
    });
    setCurrentTip(tip || null);
  }, [pathname, visible, dismissed]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
    setVisible(false);
  };

  if (!visible || dismissed || !currentTip) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-800">
          <Lightbulb size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Staging tip
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800"
          aria-label="Cerrar tips de staging"
        >
          <X size={14} />
        </button>
      </div>
      <h4 className="mb-1 text-sm font-semibold text-amber-900">
        {currentTip.title}
      </h4>
      <p className="text-xs text-amber-800/90">{currentTip.content}</p>
      {currentTip.link && (
        <Link
          href={currentTip.link.href}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline"
        >
          {currentTip.link.label} <ExternalLink size={10} />
        </Link>
      )}
    </div>
  );
}
