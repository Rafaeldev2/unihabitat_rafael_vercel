"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/context";
import Link from "next/link";
import { Search, X, Plus, ChevronRight, Loader2, AlertCircle } from "lucide-react";

const pillClass: Record<string, string> = {
  "fp-pub": "bg-green/8 text-green",
  "fp-sus": "bg-red/8 text-red",
  "fp-seg": "bg-blue/8 text-blue",
  "fp-res": "bg-orange/8 text-orange",
  "fp-nd": "bg-muted/8 text-muted",
};

const ESTADO_OPTIONS = [
  "Nuevo",
  "Seguimiento",
  "Negociación",
  "Contactado",
  "Oferta enviada",
  "Cerrado",
];

const NEGOCIACION_ESTADOS = new Set(["Negociación", "Oferta enviada"]);
const CERRADO_ESTADOS = new Set(["Cerrado", "Cerrada", "Ganada", "Operación cerrada"]);

export default function CompradoresPage() {
  const { compradores, compradoresLoading, compradoresError, refreshCompradores } = useApp();
  const [q, setQ] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fAgente, setFAgente] = useState("");
  const [fNda, setFNda] = useState("");

  const agenteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of compradores) {
      const a = c.agente?.trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [compradores]);

  const stats = useMemo(() => {
    const total = compradores.length;
    let firmados = 0;
    let negociacion = 0;
    let cerradas = 0;
    for (const c of compradores) {
      if (c.nda === "Firmada") firmados += 1;
      if (NEGOCIACION_ESTADOS.has(c.estado)) negociacion += 1;
      if (CERRADO_ESTADOS.has(c.estado)) cerradas += 1;
    }
    return { total, firmados, negociacion, cerradas };
  }, [compradores]);

  const filtered = useMemo(() => {
    return compradores.filter((p) => {
      if (fTipo && p.tipo !== fTipo) return false;
      if (fEstado && p.estado !== fEstado) return false;
      if (fAgente && p.agente !== fAgente) return false;
      if (fNda && p.nda !== fNda) return false;
      if (q) {
        const blob = [p.nombre, p.email, p.tel, p.agente, p.estado, p.intereses]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [compradores, q, fTipo, fEstado, fAgente, fNda]);

  const clearFilters = () => {
    setQ("");
    setFTipo("");
    setFEstado("");
    setFAgente("");
    setFNda("");
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Compradores</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
            {compradoresLoading ? "Cargando…" : `${stats.total} compradores`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white hover:bg-navy3">
            <Plus size={14} /> Nuevo Comprador
          </button>
        </div>
      </div>

      <div className="p-5">
        <p className="mb-3 text-xs text-muted">Clientes interesados en adquirir activos</p>

        {compradoresError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red/30 bg-red/5 p-3 text-sm text-red">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">No se pudo cargar la lista de compradores</div>
                <div className="mt-0.5 text-xs text-red/80">{compradoresError}</div>
              </div>
            </div>
            <button
              onClick={() => void refreshCompradores()}
              className="flex-shrink-0 rounded-md border border-red/30 bg-white px-2.5 py-1 text-xs font-medium text-red hover:bg-red/5"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* KPIs reales calculados desde Supabase */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          <Kpi value={stats.total} label="Total compradores" />
          <Kpi value={stats.firmados} label="Con NDA firmada" />
          <Kpi value={stats.negociacion} label="En negociación" />
          <Kpi value={stats.cerradas} label="Ops. cerradas" />
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text shadow-sm outline-none placeholder:text-muted/70 focus:border-navy focus:ring-2 focus:ring-navy/5"
            placeholder="Buscar por nombre, email, teléfono, agente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mb-3 rounded-lg border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2.5">
            <FSelect label="Tipo" value={fTipo} onChange={setFTipo} options={["Privado", "Free"]} />
            <FSelect label="Estado" value={fEstado} onChange={setFEstado} options={ESTADO_OPTIONS} />
            <FSelect label="Agente" value={fAgente} onChange={setFAgente} options={agenteOptions} />
            <FSelect label="NDA" value={fNda} onChange={setFNda} options={["Firmada", "Pendiente"]} />
            <div className="h-8 w-px self-end bg-border2" />
            <div className="flex gap-1.5 self-end">
              <button className="rounded-md bg-navy px-4 py-[7px] text-xs font-medium text-white hover:bg-navy3">
                Buscar
              </button>
              <button
                onClick={clearFilters}
                className="rounded-md border border-border px-2.5 py-[7px] text-muted hover:border-red hover:text-red"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs text-muted">
          Mostrando <strong className="font-semibold text-navy">{filtered.length}</strong> de{" "}
          <strong className="font-semibold text-navy">{stats.total}</strong> compradores
        </p>

        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[2fr_72px_120px_100px_100px_110px_100px_72px_28px] items-center gap-2 bg-navy px-3.5 py-2.5">
            {["Cliente", "Tipo", "Agente", "Intereses", "Presupuesto", "Últ. actividad", "Estado", "NDA", ""].map(
              (h) => (
                <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {h}
                </div>
              ),
            )}
          </div>

          {compradoresLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Cargando compradores…
            </div>
          ) : stats.total === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              Aún no hay compradores registrados en la base de datos.
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              No se encontraron compradores con los filtros actuales.
            </div>
          ) : (
            filtered.map((p) => (
              <Link
                key={p.id}
                href={`/admin/compradores/${p.id}`}
                className="grid grid-cols-[2fr_72px_120px_100px_100px_110px_100px_72px_28px] items-center gap-2 border-b border-border2 px-3.5 transition-colors last:border-b-0 hover:bg-cream/50"
                style={{ height: 48 }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg,${p.col || "#2563a8,#0d2a4a"})` }}
                  >
                    {p.ini}
                  </div>
                  <div className="overflow-hidden">
                    <div className="truncate text-sm font-medium">{p.nombre}</div>
                    <div className="truncate text-[11px] text-muted">{p.email}</div>
                  </div>
                </div>
                <span
                  className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${p.tipo === "Privado" ? pillClass["fp-seg"] : pillClass["fp-nd"]}`}
                >
                  {p.tipo}
                </span>
                <span className="truncate text-xs">{p.agente || "—"}</span>
                <span className="truncate text-xs text-muted">{p.intereses || "—"}</span>
                <span className="text-xs font-semibold text-navy">{p.presupuesto || "—"}</span>
                <span className="text-xs text-muted">{p.actividad || "—"}</span>
                <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${pillClass[p.estadoC] || ""}`}>
                  {p.estado || "—"}
                </span>
                <span
                  className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${p.nda === "Firmada" ? pillClass["fp-pub"] : pillClass["fp-nd"]}`}
                >
                  {p.nda}
                </span>
                <ChevronRight size={14} className="text-border" />
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-navy">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function FSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex min-w-[90px] flex-1 flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-md border border-border bg-cream2 py-[7px] pl-2.5 pr-6 text-xs text-text outline-none focus:border-navy focus:bg-white"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
