"use client";

import { useApp } from "@/lib/context";
import { canViewSection } from "@/lib/auth-helpers";
import Link from "next/link";
import { Building2, ShoppingCart, CheckSquare, FileText, Clock, ChevronRight, Star } from "lucide-react";
import { fmtM } from "@/lib/utils";

export function DashboardVendedor() {
  const { assets, compradores, tareas, session, permissions } = useApp();

  const pendingTasks = tareas.filter((t) => !t.done);
  const nombre = session?.nombre ?? "Vendedor";

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <h1 className="text-lg font-semibold text-navy">Mi Panel</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-400/10 px-2.5 py-1 text-xs font-medium text-blue-600">Vendedor</span>
          <span className="text-sm text-muted">{nombre}</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Welcome banner */}
        <div className="rounded-xl bg-gradient-to-br from-navy to-navy3 p-6">
          <h2 className="text-xl font-semibold text-white">Bienvenido, {nombre.split(" ")[0]}</h2>
          <p className="mt-1 text-sm text-white/50">Aquí tienes un resumen de tu actividad</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard icon={Building2} label="Mis activos" value={assets.length} color="bg-blue-50 text-blue-600" />
          <KpiCard icon={ShoppingCart} label="Mis compradores" value={compradores.length} color="bg-emerald-50 text-emerald-600" />
          <KpiCard icon={CheckSquare} label="Tareas pendientes" value={pendingTasks.length} color="bg-amber-50 text-amber-600" />
          <KpiCard icon={FileText} label="Ofertas activas" value={0} color="bg-purple-50 text-purple-600" />
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Recent assets */}
          {canViewSection(session, "activos", permissions) && (
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold">Activos recientes</span>
                <Link href="/admin" className="flex items-center gap-0.5 text-xs text-muted hover:text-navy">Ver todos <ChevronRight size={12} /></Link>
              </div>
              {assets.length === 0 && <p className="py-4 text-center text-xs text-muted">No tienes activos asignados</p>}
              {assets.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/admin/assets/${a.id}`} className="flex items-center gap-3 rounded-md border-b border-border p-2.5 last:border-b-0 hover:bg-cream2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cream2">
                    <Building2 size={14} className="text-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-navy">{a.id}</div>
                    <div className="truncate text-[11px] text-muted">{a.prov} · {a.addr !== "—" ? a.addr : a.pob}</div>
                  </div>
                  {a.precio != null && <span className="text-xs font-semibold text-navy">{fmtM(a.precio)}</span>}
                  {a.fav && <Star size={12} className="fill-gold text-gold" />}
                </Link>
              ))}
            </div>
          )}

          {/* Pending tasks */}
          {canViewSection(session, "tareas", permissions) && (
            <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold">Tareas pendientes</span>
                <Link href="/admin/tareas" className="flex items-center gap-0.5 text-xs text-muted hover:text-navy">Ver todas <ChevronRight size={12} /></Link>
              </div>
              {pendingTasks.length === 0 && <p className="py-4 text-center text-xs text-muted">No tienes tareas pendientes</p>}
              {pendingTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-md border-b border-border p-2.5 last:border-b-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                    t.prioridad === "urgente" ? "bg-red-50" : "bg-cream2"
                  }`}>
                    <Clock size={14} className={t.prioridad === "urgente" ? "text-red" : "text-navy"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-navy">{t.titulo}</div>
                    <div className="text-[11px] text-muted">{t.fecha || "Sin fecha"}</div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    t.prioridad === "urgente" ? "bg-red/8 text-red" : t.prioridad === "baja" ? "bg-muted/8 text-muted" : "bg-blue/8 text-blue"
                  }`}>{t.prioridad}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compradores */}
        {canViewSection(session, "compradores", permissions) && compradores.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gold">Mis compradores</span>
              <Link href="/admin/compradores" className="flex items-center gap-0.5 text-xs text-muted hover:text-navy">Ver todos <ChevronRight size={12} /></Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {compradores.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/admin/compradores/${c.id}`} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-cream2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg,${c.col})` }}>
                    {c.ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-navy">{c.nombre}</div>
                    <div className="truncate text-[11px] text-muted">{c.email}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick access */}
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold">Accesos rápidos</div>
          <div className="flex flex-wrap gap-2">
            {canViewSection(session, "activos", permissions) && (
              <Link href="/admin" className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream2"><Building2 size={14} /> Activos</Link>
            )}
            {canViewSection(session, "compradores", permissions) && (
              <Link href="/admin/compradores" className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream2"><ShoppingCart size={14} /> Compradores</Link>
            )}
            {canViewSection(session, "tareas", permissions) && (
              <Link href="/admin/tareas" className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream2"><CheckSquare size={14} /> Tareas</Link>
            )}
            {canViewSection(session, "ofertas", permissions) && (
              <Link href="/admin/ofertas" className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-navy hover:bg-cream2"><FileText size={14} /> Ofertas</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-2xl font-bold text-navy">{value}</div>
          <div className="text-[11px] text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}
