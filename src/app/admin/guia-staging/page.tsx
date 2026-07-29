"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  ShoppingCart,
  FileText,
  Globe,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { isStagingGuideEnabled } from "@/lib/staging-guide";

type Step = {
  id: string;
  fase: string;
  title: string;
  where: string;
  href: string;
  what: string[];
  howToTest: string[];
};

const STEPS: Step[] = [
  {
    id: "f1-filtros",
    fase: "Fase 1",
    title: "Filtros de Activos (Situación, Proceso, Deuda)",
    where: "Admin → Activos",
    href: "/admin",
    what: [
      "Nuevos filtros operativos alineados al Excel: Situación, Proceso y Deuda.",
      "Siguen disponibles Categoría, Provincia, Población, Tipología y Estado de publicación.",
    ],
    howToTest: [
      "Abre Activos y localiza la fila de filtros bajo el buscador.",
      "Cambia Situación / Proceso / Deuda y comprueba que el listado se reduce.",
      "En la tabla, verifica columnas Situación, Proceso y Deuda en cada fila.",
      "Pulsa Limpiar filtros y verifica que vuelven ~2597 activos (datos de staging).",
    ],
  },
  {
    id: "f1-categoria",
    fase: "Fase 1",
    title: "Categoría libre en el Excel (CDR, NPL, OCUPADO…)",
    where: "Admin → Activos → Nuevo Activo (import Excel)",
    href: "/admin",
    what: [
      "Migración staging: assets.referencia + public_slug + sin CHECK CDR/NPL.",
      "Preflight aborta si el schema no está listo (evita errores parciales).",
      "El import acepta textos libres del Excel (p. ej. OCUPADO).",
      "Plantilla recomendada: «Plantilla subidas Master Ejemplo Ocupados (2).xlsx» (100 filas).",
    ],
    howToTest: [
      "Confirma que se aplicó supabase-migration-feedback-cliente-staging.sql en Supabase staging.",
      "Sube el Excel de 100 OCUPADO: 0 batches fallidos, categoría OCUPADO filtrable.",
      "Filtra por Categoría = OCUPADO en el listado.",
    ],
  },
  {
    id: "f1-detalle",
    fase: "Fase 1",
    title: "Detalle del activo: Consultar (modal) y Oferta filtrada",
    where: "Admin → Activos → clic en una fila",
    href: "/admin",
    what: [
      "Consultar abre modal con mensaje editable (enviando / éxito / error).",
      "Oferta abre /admin/ofertas?asset=… filtrado a ese activo.",
      "En staging EMAIL_DRY_RUN=true (no spamea).",
    ],
    howToTest: [
      "Abre un activo → Consultar → edita mensaje → enviar → ver éxito o dry-run.",
      "Pulsa Oferta y comprueba el chip de filtro por activo + limpiar filtro.",
    ],
  },
  {
    id: "f2-acceso",
    fase: "Fase 2",
    title: "Acceso al portal (fail-closed, sin bypass demo)",
    where: "Admin → Compradores + /portal/privado",
    href: "/admin/compradores",
    what: [
      "sin_acceso bloquea también a usuarios demo.",
      "Errores de consulta → acceso pendiente (fail-closed).",
      "Solo acceso=activo entra al privado (admin/vendedor siempre pasan).",
    ],
    howToTest: [
      "Pon un comprador en Sin acceso → login como ese cliente → debe ver «Acceso pendiente».",
      "Activa acceso → debe entrar a /portal/privado.",
    ],
  },
  {
    id: "f2-ofertas",
    fase: "Fase 2",
    title: "Ofertas: Cambiar estado + acciones rápidas",
    where: "Admin → Ofertas",
    href: "/admin/ofertas",
    what: [
      "Select etiquetado «Cambiar estado» con los 5 estados.",
      "Validar / Rechazar / Enviar NDA siguen disponibles.",
      "Mutaciones protegidas server-side (admin/vendedor).",
    ],
    howToTest: [
      "Cambia estado con el select y verifica toast + tarjeta actualizada.",
      "Prueba filtro ?asset= desde la ficha de un activo.",
      "EMAIL_DRY_RUN=true al enviar NDA.",
    ],
  },
  {
    id: "f3-portal",
    fase: "Fase 3",
    title: "Home→portal, legales y URL slug",
    where: "Home + Portal público",
    href: "/portal",
    what: [
      "Home: mismos filtros en cascada (Categoría, Provincia, Población, Tipología).",
      "URL ficha: /portal/inmueble/{slug} (sin catastral ni ID1).",
      "Legacy /portal/{id} redirige al slug.",
      "Contacto: enlaces reales a /legal/privacidad#…",
    ],
    howToTest: [
      "Desde / busca con filtros → aterriza en /portal?cat&prov&pob&tipo aplicados.",
      "Abre una ficha: pathname tipo /portal/inmueble/piso-…-xxxxxx.",
      "Contacto → Privacidad / Aviso legal abren el documento legal.",
    ],
  },
];

export default function GuiaStagingPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    setEnabled(isStagingGuideEnabled());
  }, []);

  if (enabled === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
        Cargando guía…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="text-amber-600" size={36} />
        <h1 className="text-lg font-semibold text-navy">Guía no disponible</h1>
        <p className="max-w-md text-sm text-muted">
          Este tutorial solo existe en el entorno de staging. No forma parte de producción
          (<code className="mx-1 rounded bg-black/5 px-1">www.unihabitat.net</code>.
        </p>
        <Link href="/admin" className="text-sm font-medium text-gold hover:underline">
          Volver a Activos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 shrink-0 text-amber-700" size={22} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Solo staging — no producción
            </p>
            <p className="mt-1 text-sm text-amber-900/90">
              Esta guía describe las mejoras de Fases 1–3 y cómo probarlas en{" "}
              <strong>unihabitat-staging</strong>. No se muestra en el CRM de producción.
              Login demo admin:{" "}
              <code className="rounded bg-white/70 px-1">admin@propcrm.com</code> /{" "}
              <code className="rounded bg-white/70 px-1">Admin1234!</code>
            </p>
          </div>
        </div>
      </div>

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-gold">
          <BookOpen size={22} />
          <span className="text-xs font-bold uppercase tracking-wider">Tutorial de demos</span>
        </div>
        <h1 className="text-2xl font-semibold text-navy">Actualizaciones Unihabitat (staging)</h1>
        <p className="mt-2 text-sm text-muted">
          Recorrido paso a paso para enseñar al cliente qué cambió y cómo validarlo antes de
          promover a producción.
        </p>
      </header>

      <ol className="space-y-6">
        {STEPS.map((step, index) => (
          <li
            key={step.id}
            id={step.id}
            className="rounded-2xl border border-border bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                {step.fase}
              </span>
              <span className="text-xs text-muted">{step.where}</span>
            </div>
            <h2 className="text-base font-semibold text-navy">{step.title}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <CheckCircle2 size={12} /> Qué hay de nuevo
                </p>
                <ul className="space-y-1.5 text-sm text-navy/90">
                  {step.what.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <FlaskConical size={12} /> Cómo probarlo
                </p>
                <ol className="list-decimal space-y-1.5 pl-4 text-sm text-navy/90">
                  {step.howToTest.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
            </div>

            <Link
              href={step.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline"
            >
              Ir a {step.where.split("→").pop()?.trim() ?? "pantalla"}
              <ArrowRight size={14} />
            </Link>
          </li>
        ))}
      </ol>

      <section className="mt-10 rounded-2xl border border-border bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-navy">
          <Globe size={18} /> Atajos rápidos
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/admin" icon={Building2} label="Activos" />
          <QuickLink href="/admin/compradores" icon={ShoppingCart} label="Compradores" />
          <QuickLink href="/admin/ofertas" icon={FileText} label="Ofertas" />
          <QuickLink href="/portal" icon={Globe} label="Portal" external />
        </div>
        <p className="mt-4 text-xs text-muted">
          Tras el OK del cliente: migraciones SQL en Supabase prod + merge de la rama{" "}
          <code className="rounded bg-black/5 px-1">staging</code> →{" "}
          <code className="rounded bg-black/5 px-1">main</code>. Esta página no se despliega
          útil en prod (flag apagado).
        </p>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: typeof Building2;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-cream px-3 py-2 text-sm font-medium text-navy hover:border-gold/40"
    >
      <Icon size={16} />
      {label}
      {external && <ExternalLink size={12} className="text-muted" />}
    </Link>
  );
}
