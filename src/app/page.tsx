"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Building2, ChevronDown } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { useApp } from "@/lib/context";
import { normalizeTipo } from "@/lib/normalize-excel";

const TIPOS_VALIDOS = [
  "Casa / Chalet",
  "Comercial",
  "Edificio",
  "Garaje",
  "Nave",
  "Obra Sin Finalizar",
  "Oficina",
  "Piso",
  "Suelo",
  "Suelo Industrial",
  "Trastero",
  "Vivienda",
];

const TIPOS_VALIDOS_SET = new Set(TIPOS_VALIDOS);

const STATS = [
  { value: "500+", label: "Activos publicados" },
  { value: "60%", label: "Rentabilidad máxima" },
  { value: "1ª", label: "Plataforma en España" },
];

export default function HomePage() {
  const router = useRouter();
  const { assets } = useApp();
  const [tipo, setTipo] = useState("");
  const [provincia, setProvincia] = useState("");
  const [poblacion, setPoblacion] = useState("");

  const publicAssets = useMemo(() => assets.filter(a => a.pub), [assets]);

  const tipoOptions = useMemo(() => {
    const normalized = publicAssets
      .map(a => normalizeTipo(a.tip))
      .filter(t => t && t !== "—" && TIPOS_VALIDOS_SET.has(t));
    const fromData = [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
    return fromData.length > 0 ? fromData : TIPOS_VALIDOS;
  }, [publicAssets]);

  const provinciaOptions = useMemo(
    () => [...new Set(publicAssets.map(a => a.prov).filter(v => v && v !== "—"))].sort((a, b) => a.localeCompare(b)),
    [publicAssets],
  );

  const poblacionOptions = useMemo(
    () => [...new Set(publicAssets.map(a => a.pob).filter(v => v && v !== "—"))].sort((a, b) => a.localeCompare(b)),
    [publicAssets],
  );

  function handleSearch() {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (provincia) params.set("prov", provincia);
    if (poblacion) params.set("pob", poblacion);
    const qs = params.toString();
    router.push(`/portal${qs ? `?${qs}` : ""}`);
  }

  function handleReset() {
    setTipo("");
    setProvincia("");
    setPoblacion("");
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── NAV ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center">
            <img src="/LogoAzul.svg" alt="Unihabitat" width={28} height={28} className="h-7 w-auto" />
            </div>
            <span className="text-lg font-bold text-navy tracking-tight">Unihabitat<span className="text-gold">*</span></span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-navy/70 md:flex">
            <Link href="/portal" className="transition-colors hover:text-navy">Propiedades</Link>
            <Link href="/portal" className="transition-colors hover:text-navy">Inversores</Link>
            <Link href="/portal?cat=NPL" className="transition-colors hover:text-navy">Carteras NPL</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-lg border border-navy/20 px-4 py-1.5 text-sm font-medium text-navy transition-all hover:border-navy/50 md:block">
              Acceder
            </Link>
            <Link href="/portal" className="rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-navy3">
              Ver propiedades
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative min-h-screen overflow-hidden bg-white pt-16">
        {/* Fondo decorativo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 top-0 h-[70vh] w-[55vw] rounded-bl-[80px] bg-cream" />
          <div className="absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-white/80 to-transparent" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-16 px-6 py-20 lg:flex-row lg:items-center lg:py-32">
          {/* Texto izquierda */}
          <div className="flex-1 lg:max-w-[48%]">
            <span className="mb-4 inline-block rounded-full border border-gold/30 bg-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
              Especial Inversores
            </span>
            <h1 className="text-4xl font-black leading-[1.1] text-navy lg:text-5xl xl:text-6xl">
              La plataforma n.º&nbsp;1 en compra de activos&nbsp;<span className="relative whitespace-nowrap">
                inmobiliarios
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M0 10 Q150 0 300 10" stroke="#b8933a" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>.
            </h1>
            <p className="mt-8 max-w-md text-base leading-relaxed text-navy/60">
              Adelántate en activos judicializados y consigue rentabilidades de hasta un <strong className="text-navy">60%</strong> en el mercado inmobiliario.
            </p>

            {/* Stats */}
            <div className="mt-10 flex gap-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-black text-navy">{s.value}</div>
                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-navy/40">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Imagen de ambiente */}
            <div className="mt-12 overflow-hidden rounded-2xl shadow-2xl shadow-navy/10">
              <img
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=80"
                alt="Activos inmobiliarios"
                className="h-52 w-full object-cover"
              />
            </div>
          </div>

          {/* Formulario de búsqueda derecha */}
          <div className="w-full lg:w-[380px] xl:w-[420px]">
            <div className="rounded-2xl border border-border bg-white shadow-2xl shadow-navy/10">
              {/* Header */}
              <div className="border-b border-border px-6 py-5">
                <h2 className="text-xl font-bold text-navy">
                  Encuentra el tuyo<span className="text-gold">_</span>
                </h2>
              </div>

              <div className="space-y-4 p-6">
                {/* Tipo */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-navy/50">
                    Tipo
                  </label>
                  <div className="relative">
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-cream/50 px-4 py-3 pr-10 text-sm text-navy focus:border-navy/40 focus:outline-none focus:ring-2 focus:ring-navy/10"
                    >
                      <option value="">Todas</option>
                      {tipoOptions.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy/40" />
                  </div>
                </div>

                {/* Provincia */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-navy/50">
                    Provincia
                  </label>
                  <div className="relative">
                    <select
                      value={provincia}
                      onChange={(e) => setProvincia(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-cream/50 px-4 py-3 pr-10 text-sm text-navy focus:border-navy/40 focus:outline-none focus:ring-2 focus:ring-navy/10"
                    >
                      <option value="">Todas</option>
                      {provinciaOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy/40" />
                  </div>
                </div>

                {/* Población */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-navy/50">
                    Población
                  </label>
                  <div className="relative">
                    <select
                      value={poblacion}
                      onChange={(e) => setPoblacion(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-cream/50 px-4 py-3 pr-10 text-sm text-navy focus:border-navy/40 focus:outline-none focus:ring-2 focus:ring-navy/10"
                    >
                      <option value="">Todas</option>
                      {poblacionOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy/40" />
                  </div>
                </div>

                {/* Botón búsqueda */}
                <button
                  onClick={handleSearch}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-navy3 active:scale-[0.98]"
                >
                  <Search size={16} />
                  Búsqueda
                </button>

                {/* Reiniciar */}
                <button
                  onClick={handleReset}
                  className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-navy/40 transition-colors hover:text-navy/70"
                >
                  <X size={12} />
                  Reiniciar
                </button>
              </div>
            </div>

            {/* Badge bajo formulario */}
            <p className="mt-4 text-center text-[11px] text-navy/30">
              Accede a <strong className="text-navy/50">+500 activos judicializados</strong> en toda España
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES BAND ── */}
      <section className="border-t border-border bg-cream py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { title: "Cesión de Remate", desc: "Adquiere activos inmobiliarios con grandes descuentos sobre el valor de tasación.", cat: "CDR" },
              { title: "Carteras NPL", desc: "Accede a carteras completas de préstamos hipotecarios con potencial de máxima rentabilidad.", cat: "NPL" },
              { title: "REO Directo", desc: "Inmuebles adjudicados listos para comprar, sin cargas ocultas ni procesos judiciales.", cat: "REO" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-navy">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/50">{f.desc}</p>
                <button
                  onClick={() => router.push(`/portal?cat=${f.cat}`)}
                  className="mt-4 text-xs font-semibold text-gold underline underline-offset-2 hover:text-gold2"
                >
                  Ver propiedades →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
