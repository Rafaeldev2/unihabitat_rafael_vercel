"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, CheckCheck, Zap, FileText, MessageSquare, UserPlus } from "lucide-react";

interface Notif { id: string; tipo: string; mensaje: string; referencia_id: string | null; leida: boolean; created_at: string }

const iconMap: Record<string, typeof Bell> = { match: Zap, documento: FileText, mensaje: MessageSquare, cliente: UserPlus };
const colorMap: Record<string, string> = { match: "text-gold bg-gold/10", documento: "text-blue bg-blue/10", mensaje: "text-green bg-green/10", cliente: "text-purple bg-purple/10" };

export default function NotificacionesPage() {
  const supabase = createClient();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setNotifs(data as Notif[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase.channel("notif-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones" }, (payload) => {
        setNotifs(prev => [payload.new as Notif, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  async function markRead(id: string) {
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.leida).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notificaciones").update({ leida: true }).in("id", unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  }

  const unread = notifs.filter(n => !n.leida).length;

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-navy">Notificaciones</h1>
          {unread > 0 && <span className="rounded-full bg-red px-2 py-0.5 text-[10px] font-bold text-white">{unread} sin leer</span>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-navy hover:bg-cream">
            <CheckCheck size={14} /> Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="p-5">
        {notifs.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={40} className="mx-auto mb-3 text-border" />
            <p className="text-sm text-muted">No hay notificaciones</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifs.map(n => {
              const Icon = iconMap[n.tipo] || Bell;
              const colors = colorMap[n.tipo] || "text-muted bg-muted/10";
              return (
                <div key={n.id} className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${n.leida ? "border-border bg-white" : "border-gold/20 bg-gold/[0.03]"}`}>
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colors}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm leading-relaxed ${n.leida ? "text-muted" : "text-text"}`}>{n.mensaje}</p>
                    <p className="mt-1 text-[11px] text-muted">{new Date(n.created_at).toLocaleString("es-ES")}</p>
                  </div>
                  {!n.leida && (
                    <button onClick={() => markRead(n.id)} className="flex-shrink-0 rounded-md border border-border p-1.5 text-muted hover:bg-cream hover:text-navy" title="Marcar como leída">
                      <Check size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
