"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, X, ChevronRight, Loader2, AlertCircle, UserCog } from "lucide-react";
import { useApp } from "@/lib/context";
import { createVendedor } from "@/app/actions/vendedores";

const pillClass: Record<string, string> = {
  "fp-pub": "bg-green/8 text-green",
  "fp-sus": "bg-red/8 text-red",
  "fp-seg": "bg-blue/8 text-blue",
  "fp-res": "bg-orange/8 text-orange",
  "fp-nd": "bg-muted/8 text-muted",
};

const ESTADO_OPTIONS = ["Activo", "Inactivo", "En vacaciones"];

export default function AgentesPage() {
  const {
    vendedores,
    vendedoresLoading,
    vendedoresError,
    refreshVendedores,
    compradores,
    assets,
  } = useApp();

  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fCartera, setFCartera] = useState("");
  const [showNew, setShowNew] = useState(false);

  const carteraOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendedores) {
      const c = v.cartera?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [vendedores]);

  const stats = useMemo(() => {
    const total = vendedores.length;
    const activos = vendedores.filter((v) => (v.estado || "").toLowerCase() === "activo").length;
    const compradoresCount = compradores.length;
    const activosCount = assets.length;
    return { total, activos, compradoresCount, activosCount };
  }, [vendedores, compradores, assets]);

  const filtered = useMemo(() => {
    return vendedores.filter((v) => {
      if (fEstado && v.estado !== fEstado) return false;
      if (fCartera && v.cartera !== fCartera) return false;
      if (q) {
        const blob = [v.nombre, v.email, v.tel, v.cartera].join(" ").toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [vendedores, q, fEstado, fCartera]);

  const clearFilters = () => {
    setQ("");
    setFEstado("");
    setFCartera("");
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Agentes</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
            {vendedoresLoading ? "Cargando…" : `${stats.total} agentes`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white hover:bg-navy3"
          >
            <Plus size={14} /> Nuevo agente
          </button>
        </div>
      </div>

      <div className="p-5">
        <p className="mb-3 text-xs text-muted">
          Equipo comercial: gestiona altas, asignaciones y permisos de cada agente.
        </p>

        {vendedoresError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red/30 bg-red/5 p-3 text-sm text-red">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">No se pudo cargar la lista de agentes</div>
                <div className="mt-0.5 text-xs text-red/80">{vendedoresError}</div>
              </div>
            </div>
            <button
              onClick={() => void refreshVendedores()}
              className="flex-shrink-0 rounded-md border border-red/30 bg-white px-2.5 py-1 text-xs font-medium text-red hover:bg-red/5"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-4 gap-3">
          <Kpi value={stats.total} label="Total agentes" />
          <Kpi value={stats.activos} label="Activos" />
          <Kpi value={stats.compradoresCount} label="Compradores en cartera" />
          <Kpi value={stats.activosCount} label="Activos disponibles" />
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text shadow-sm outline-none placeholder:text-muted/70 focus:border-navy focus:ring-2 focus:ring-navy/5"
            placeholder="Buscar por nombre, email, teléfono o cartera..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mb-3 rounded-lg border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2.5">
            <FSelect label="Estado" value={fEstado} onChange={setFEstado} options={ESTADO_OPTIONS} />
            <FSelect label="Cartera" value={fCartera} onChange={setFCartera} options={carteraOptions} />
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
          <strong className="font-semibold text-navy">{stats.total}</strong> agentes
        </p>

        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[2fr_120px_120px_140px_100px_28px] items-center gap-2 bg-navy px-3.5 py-2.5">
            {["Agente", "Cartera", "Teléfono", "Email", "Estado", ""].map((h) => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {h}
              </div>
            ))}
          </div>

          {vendedoresLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Cargando agentes…
            </div>
          ) : stats.total === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              Aún no hay agentes registrados. Crea el primero con &ldquo;Nuevo agente&rdquo;.
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              No se encontraron agentes con los filtros actuales.
            </div>
          ) : (
            filtered.map((v) => (
              <Link
                key={v.id}
                href={`/admin/agentes/${v.id}`}
                className="grid grid-cols-[2fr_120px_120px_140px_100px_28px] items-center gap-2 border-b border-border2 px-3.5 transition-colors last:border-b-0 hover:bg-cream/50"
                style={{ height: 48 }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg,${v.col || "#2563a8,#0d2a4a"})` }}
                  >
                    {v.ini || v.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="truncate text-sm font-medium">{v.nombre}</div>
                    <div className="truncate text-[11px] text-muted">{v.id}</div>
                  </div>
                </div>
                <span className="truncate text-xs">{v.cartera || "—"}</span>
                <span className="truncate text-xs">{v.tel || "—"}</span>
                <span className="truncate text-xs text-muted">{v.email || "—"}</span>
                <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${pillClass[v.estadoC] || pillClass["fp-nd"]}`}>
                  {v.estado || "—"}
                </span>
                <ChevronRight size={14} className="text-border" />
              </Link>
            ))
          )}
        </div>
      </div>

      {showNew && (
        <NewAgenteDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            void refreshVendedores();
            setShowNew(false);
          }}
        />
      )}
    </>
  );
}

function NewAgenteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [cartera, setCartera] = useState("");
  const [estado, setEstado] = useState<string>("Activo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await createVendedor({
        nombre: nombre.trim(),
        email: email.trim(),
        tel: tel.trim(),
        cartera: cartera.trim(),
        estado,
        estadoC: estado === "Activo" ? "fp-pub" : estado === "Inactivo" ? "fp-sus" : "fp-seg",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el agente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <UserCog size={16} className="text-gold" />
            <h2 className="text-sm font-semibold text-navy">Nuevo agente</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-navy">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <Field label="Nombre completo *">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ana López"
              className="w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy focus:bg-white"
            />
          </Field>
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agente@empresa.com"
              type="email"
              className="w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy focus:bg-white"
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy focus:bg-white"
            />
          </Field>
          <Field label="Cartera">
            <input
              value={cartera}
              onChange={(e) => setCartera(e.target.value)}
              placeholder="ALOE, OMEGA…"
              className="w-full rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy focus:bg-white"
            />
          </Field>
          <Field label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-md border border-border bg-cream2 px-3 py-2 text-sm outline-none focus:border-navy focus:bg-white"
            >
              {ESTADO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red/30 bg-red/5 p-2 text-xs text-red">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-cream"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-gold px-3.5 py-1.5 text-xs font-medium text-white hover:bg-gold2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Crear agente
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
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
    <div className="flex min-w-[140px] flex-1 flex-col gap-1">
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
