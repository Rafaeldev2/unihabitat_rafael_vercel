"use client";

import { useApp } from "@/lib/context";
import { actividadReciente } from "@/lib/mock-data";
import { fmt } from "@/lib/utils";
import { Download, Building2, Eye, Users, Handshake, Wallet } from "lucide-react";

export default function InformesPage() {
  const { assets, compradores, vendedores } = useApp();

  const pubCount = assets.filter(a => a.pub).length;
  const totalDeuda = assets.reduce((s, a) => s + (a.precio || 0), 0);

  const barData = [
    { label: "Ene", v: 12 },
    { label: "Feb", v: 24 },
    { label: "Mar", v: 18 },
    { label: "Abr", v: 31 },
    { label: "May", v: 15 },
    { label: "Jun", v: 22 },
  ];
  const maxBar = Math.max(...barData.map(b => b.v));

  const carteraData = [
    { label: "ALOE", count: 1, col: "#2a8c5e" },
    { label: "OMEGA", count: 1, col: "#d4762a" },
    { label: "HERCULES", count: 2, col: "#2563a8" },
    { label: "ROCK", count: 2, col: "#c0392b" },
  ];
  const maxCart = Math.max(...carteraData.map(c => c.count));

  const kpis: [string, string, typeof Building2][] = [
    [String(assets.length), "Total activos", Building2],
    [String(pubCount), "Publicados", Eye],
    [String(compradores.length), "Compradores", Users],
    [String(vendedores.length), "Vendedores", Handshake],
    [fmt(totalDeuda), "Deuda gestionada", Wallet],
  ];

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Informes</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">Resumen general</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white hover:bg-navy3"><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5 grid grid-cols-5 gap-3">
          {kpis.map(([val, lbl, Icon]) => (
            <div key={lbl} className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-navy">{val}</div>
                <Icon size={16} className="text-muted" />
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{lbl}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-5">
          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Actividad Mensual</div>
            <div className="flex h-[170px] items-end justify-around gap-2">
              {barData.map(b => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-navy">{b.v}</span>
                  <div className="w-full rounded-t bg-gradient-to-t from-navy to-navy3 transition-all" style={{ height: `${(b.v / maxBar) * 130}px` }} />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Activos por Cartera</div>
            <div className="flex flex-col gap-3">
              {carteraData.map(c => (
                <div key={c.label} className="flex items-center gap-2.5">
                  <span className="w-[70px] text-xs font-semibold text-navy">{c.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded bg-cream2">
                    <div className="flex h-full items-center rounded px-2 text-[11px] font-semibold text-white transition-all" style={{ width: `${(c.count / maxCart) * 100}%`, background: c.col }}>{c.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold">Actividad Reciente</div>
            <span className="text-xs text-muted">Últimos 30 días</span>
          </div>
          <div className="grid grid-cols-[110px_1fr_1fr_120px] gap-2 bg-cream/50 px-5 py-2">
            {["Fecha", "Evento", "Detalle", "Agente"].map(h => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted">{h}</div>
            ))}
          </div>
          {actividadReciente.map((a, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_1fr_120px] items-center gap-2 border-b border-border2 px-5 py-2.5 last:border-b-0 hover:bg-cream/30">
              <span className="text-xs text-muted">{a.fecha}</span>
              <span className="text-sm font-medium text-navy">{a.evento}</span>
              <span className="text-xs text-muted">{a.detalle}</span>
              <span className="text-xs text-muted">{a.agente}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
