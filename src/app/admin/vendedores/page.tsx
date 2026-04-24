"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/lib/context";
import Link from "next/link";
import { Search, X, Plus, ChevronRight, TrendingUp } from "lucide-react";

const pillClass: Record<string, string> = {
  "fp-pub": "bg-green/8 text-green",
  "fp-seg": "bg-blue/8 text-blue",
  "fp-nd": "bg-muted/8 text-muted",
};

export default function VendedoresPage() {
  const { vendedores } = useApp();
  const [q, setQ] = useState("");
  const [fCartera, setFCartera] = useState("");
  const [fAgente, setFAgente] = useState("");

  const filtered = useMemo(() => {
    return vendedores.filter(v => {
      if (fCartera && v.cartera !== fCartera) return false;
      if (fAgente && v.agente !== fAgente) return false;
      if (q) {
        const blob = [v.nombre, v.email, v.tel, v.agente, v.cartera, v.activo].join(" ").toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [vendedores, q, fCartera, fAgente]);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Vendedores</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">{vendedores.length} vendedores</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white hover:bg-navy3"><Plus size={14} /> Nuevo Vendedor</button>
        </div>
      </div>

      <div className="p-5">
        <p className="mb-3 text-xs text-muted">Propietarios de activos en gestión</p>

        <div className="mb-4 grid grid-cols-4 gap-3">
          {[
            ["18", "Total vendedores", "+2 este mes"],
            ["5", "Colaborando", "Sin cambios"],
            ["7", "Sin contactar", "-1 este mes"],
            ["6", "No colaboran", "+1 este mes"],
          ].map(([val, lbl, delta]) => (
            <div key={lbl} className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-navy">{val}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{lbl}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-green"><TrendingUp size={11} /> {delta}</div>
            </div>
          ))}
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-sm text-text shadow-sm outline-none placeholder:text-muted/70 focus:border-navy" placeholder="Buscar por nombre, cartera, activo, agente..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div className="mb-3 rounded-lg border border-border bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2.5">
            <FSelect label="Cartera" value={fCartera} onChange={setFCartera} options={["ALOE","OMEGA","HERCULES","ROCK"]} />
            <FSelect label="Agente" value={fAgente} onChange={setFAgente} options={["Carlos Martínez","Ana López"]} />
            <div className="h-8 w-px self-end bg-border2" />
            <div className="flex gap-1.5 self-end">
              <button className="rounded-md bg-navy px-4 py-[7px] text-xs font-medium text-white hover:bg-navy3">Buscar</button>
              <button onClick={() => { setQ(""); setFCartera(""); setFAgente(""); }} className="rounded-md border border-border px-2.5 py-[7px] text-muted hover:border-red hover:text-red"><X size={14} /></button>
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs text-muted">Mostrando <strong className="font-semibold text-navy">{filtered.length}</strong> vendedores</p>

        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="grid grid-cols-[2fr_90px_1fr_120px_120px_120px_100px_28px] items-center gap-2 bg-navy px-3.5 py-2.5">
            {["Vendedor","Cartera","Activo asociado","Agente","Teléfono","Último contacto","Estado",""].map(h => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{h}</div>
            ))}
          </div>
          {filtered.map(v => (
            <Link key={v.id} href={`/admin/vendedores/${v.id}`} className="grid grid-cols-[2fr_90px_1fr_120px_120px_120px_100px_28px] items-center gap-2 border-b border-border2 px-3.5 transition-colors last:border-b-0 hover:bg-cream/50" style={{ height: 48 }}>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg,${v.col})` }}>{v.ini}</div>
                <div className="overflow-hidden">
                  <div className="truncate text-sm font-medium">{v.nombre}</div>
                  <div className="truncate text-[11px] text-muted">{v.email}</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-gold">{v.cartera}</span>
              <span className="truncate text-xs">{v.activo}</span>
              <span className="truncate text-xs">{v.agente}</span>
              <span className="text-xs text-muted">{v.tel}</span>
              <span className="text-xs text-muted">{v.ultimo}</span>
              <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${pillClass[v.estadoC] || ""}`}>{v.estado}</span>
              <ChevronRight size={14} className="text-border" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function FSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex min-w-[90px] flex-1 flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full cursor-pointer appearance-none rounded-md border border-border bg-cream2 py-[7px] pl-2.5 pr-6 text-xs text-text outline-none focus:border-navy focus:bg-white">
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
