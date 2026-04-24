"use client";

import { useApp } from "@/lib/context";
import { Plus, Check, AlertTriangle, Clock, CircleDot, User } from "lucide-react";

const prioStyle: Record<string, string> = {
  urgente: "border-l-red",
  normal: "border-l-gold",
  baja: "border-l-muted",
  completada: "border-l-green",
};

const prioBadge: Record<string, string> = {
  urgente: "bg-red/8 text-red",
  normal: "bg-gold/8 text-gold",
  baja: "bg-muted/8 text-muted",
  completada: "bg-green/8 text-green",
};

const prioIcon: Record<string, typeof AlertTriangle> = {
  urgente: AlertTriangle,
  normal: Clock,
  baja: CircleDot,
  completada: Check,
};

export default function TareasPage() {
  const { tareas, toggleTaskDone } = useApp();

  const pendientes = tareas.filter(t => !t.done);
  const completadas = tareas.filter(t => t.done);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Tareas</h1>
          <span className="rounded-md bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">{tareas.length} tareas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">Admin</span>
          <button className="flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-xs font-medium text-white hover:bg-navy3"><Plus size={14} /> Nueva Tarea</button>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            [String(pendientes.length), "Pendientes", AlertTriangle],
            [String(pendientes.filter(t => t.prioridad === "urgente").length), "Urgentes", AlertTriangle],
            [String(pendientes.filter(t => t.prioridad === "normal").length), "Normales", Clock],
            [String(completadas.length), "Completadas", Check],
          ].map(([val, lbl, Icon]) => {
            const I = Icon as typeof AlertTriangle;
            return (
              <div key={lbl as string} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-navy">{val as string}</div>
                  <I size={16} className="text-muted" />
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{lbl as string}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Pendientes */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-gold after:h-px after:flex-1 after:bg-border">Tareas pendientes</div>
            <div className="flex flex-col gap-2">
              {pendientes.map(t => {
                const PIcon = prioIcon[t.prioridad];
                return (
                  <div key={t.id} className={`rounded-lg border border-border border-l-[3px] bg-white p-3.5 shadow-sm ${prioStyle[t.prioridad]}`}>
                    <div className="mb-1.5 flex items-start gap-2.5">
                      <div
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] transition-all ${t.done ? "border-green bg-green text-white" : "border-border hover:border-navy/40"}`}
                        onClick={() => toggleTaskDone(t.id)}
                      >{t.done && <Check size={10} strokeWidth={3} />}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-navy">{t.titulo}</div>
                        {t.detalle && <div className="mt-0.5 text-xs text-muted">{t.detalle}</div>}
                      </div>
                      <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${prioBadge[t.prioridad]}`}><PIcon size={10} /> {t.prioridad}</span>
                    </div>
                    <div className="flex items-center justify-between pl-7">
                      <span className="flex items-center gap-1 text-xs text-muted"><User size={11} /> {t.agente}</span>
                      {t.fecha && <span className="text-xs text-muted">{t.fecha}</span>}
                    </div>
                  </div>
                );
              })}
              <button className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-3 text-xs font-medium text-muted hover:border-navy/30 hover:text-navy"><Plus size={13} /> Añadir tarea</button>
            </div>
          </div>

          {/* Completadas */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-green after:h-px after:flex-1 after:bg-green/20">Completadas</div>
            <div className="flex flex-col gap-2">
              {completadas.map(t => (
                <div key={t.id} className="rounded-lg border border-border border-l-[3px] border-l-green bg-white p-3.5 opacity-60 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] border-green bg-green text-white"
                      onClick={() => toggleTaskDone(t.id)}
                    ><Check size={10} strokeWidth={3} /></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-navy line-through">{t.titulo}</div>
                      {t.detalle && <div className="mt-0.5 text-xs text-muted">{t.detalle}</div>}
                    </div>
                  </div>
                  <div className="pl-7"><span className="flex items-center gap-1 text-xs text-muted"><User size={11} /> {t.agente}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
