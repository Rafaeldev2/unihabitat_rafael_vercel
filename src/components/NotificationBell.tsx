"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { fetchNotificaciones, fetchUnreadCount, markAsRead, markAllAsRead, type NotificacionRow } from "@/app/actions/notificaciones";
import Link from "next/link";

export function NotificationBell({ userId }: { userId?: string }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificacionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCount(userId).then(setCount).catch(() => {});
    const interval = setInterval(() => {
      fetchUnreadCount(userId).then(setCount).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await fetchNotificaciones(userId);
      setNotifs(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleMarkOne = async (id: string) => {
    await markAsRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    if (!userId) return;
    await markAllAsRead(userId).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    setCount(0);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "ahora";
    if (diffMin < 60) return `hace ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center rounded-lg p-2 text-muted transition-colors hover:bg-cream hover:text-navy"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h4 className="text-sm font-semibold text-navy">Notificaciones</h4>
            <div className="flex items-center gap-1">
              {count > 0 && userId && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gold hover:bg-gold/10"
                >
                  <CheckCheck size={12} /> Leer todas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-cream"><X size={14} /></button>
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">Sin notificaciones</div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-border/50 px-4 py-3 transition-colors ${n.leida ? "bg-white" : "bg-gold/5"}`}
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? "bg-transparent" : "bg-gold"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-text">{n.mensaje}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted">{formatDate(n.created_at)}</span>
                      {n.referencia_id && (
                        <Link
                          href={`/portal/privado/${n.referencia_id}`}
                          className="text-[10px] font-medium text-gold hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Ver activo
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.leida && (
                    <button
                      onClick={() => handleMarkOne(n.id)}
                      className="shrink-0 rounded p-1 text-muted hover:bg-cream hover:text-navy"
                      title="Marcar como leída"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
