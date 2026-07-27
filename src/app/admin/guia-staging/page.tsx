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
      "La categoría ya no está limitada a un CHECK fijo CDR/NPL.",
      "El import acepta textos libres del Excel (p. ej. OCUPADO).",
      "Alias de columna: también «Referencia Catastral».",
    ],
    howToTest: [
      "Sube un Excel de prueba con categoría distinta de CDR/NPL.",
      "Confirma que el activo aparece con esa categoría en el listado.",
      "Filtra por Categoría si el valor está en el desplegable o búscalo por texto.",
    ],
  },
  {
    id: "f1-detalle",
    fase: "Fase 1",
    title: "Detalle del activo: descripción, notas, Consultar/Oferta, Fase interna",
    where: "Admin → Activos → clic en una fila",
    href: "/admin",
    what: [
      "Descripción editable con Guardar descripción.",
      "Notas del activo (equipo / agentes).",
      "Botones Consultar y Oferta en Características.",
      "Pestaña Administrador → Fase interna (Disponible, Seguimiento, Negociación…).",
    ],
    howToTest: [
      "Abre cualquier activo del listado (espera a que cargue la tabla).",
      "Edita la descripción, guarda y recarga: el texto debe persistir.",
      "Añade una nota y comprueba que se guarda.",
      "En Administrador, elige una Fase interna y guarda.",
    ],
  },
  {
    id: "f2-acceso",
    fase: "Fase 2",
    title: "Acceso al portal (Activo / Sin acceso)",
    where: "Admin → Compradores",
    href: "/admin/compradores",
    what: [
      "Columna Acceso y filtro Activo / Sin acceso.",
      "KPI «Sin acceso portal».",
      "El portal privado bloquea a compradores con sin_acceso.",
    ],
    howToTest: [
      "En Compradores, filtra Acceso = Sin acceso y Activo.",
      "Abre un comprador, cambia Acceso y guarda.",
      "Con un usuario cliente (demo o real), prueba /portal/privado: sin acceso debe bloquear.",
    ],
  },
  {
    id: "f2-ofertas",
    fase: "Fase 2",
    title: "Ofertas: todos los estados y acciones",
    where: "Admin → Ofertas",
    href: "/admin/ofertas",
    what: [
      "Listado con estados: pendiente, validada, rechazada, NDA, etc.",
      "Acciones Validar, Rechazar, Enviar NDA según estado.",
    ],
    howToTest: [
      "Abre Ofertas (hay datos de demo/copia staging).",
      "Filtra por ESTADO y revisa las tarjetas.",
      "No uses Enviar NDA contra emails reales si no quieres; en staging EMAIL_DRY_RUN=true.",
    ],
  },
  {
    id: "f3-portal",
    fase: "Fase 3",
    title: "Portal: marca, filtros, Lista/Mapa, Deuda NPL, legal",
    where: "Portal público",
    href: "/portal",
    what: [
      "Marca Unihabitat* (BrandMark).",
      "Filtros de búsqueda (categoría, provincia, tipología…).",
      "Toggle Lista | Mapa.",
      "NPL muestra Deuda; CDR/REO muestran Precio.",
      "Enlaces legales en el footer.",
    ],
    howToTest: [
      "Abre /portal (o «Ver en portal» desde un activo).",
      "Comprueba Unihabitat* en la cabecera.",
      "Cambia a Mapa y vuelve a Lista.",
      "Localiza una tarjeta NPL: etiqueta DEUDA (no PRECIO).",
      "Revisa footer → Aviso legal / Privacidad / Cookies.",
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
