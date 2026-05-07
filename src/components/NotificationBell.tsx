"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check, CheckCheck, Trash2, CheckSquare, Square } from "lucide-react";
import {
  fetchNotificaciones,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificacion,
  deleteAllForUser,
  type NotificacionRow,
} from "@/app/actions/notificaciones";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function NotificationBell({ userId }: { userId?: string }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificacionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const c = await fetchUnreadCount(userId);
      setCount(c);
    } catch { /* ignore */ }
    if (openRef.current) {
      try {
        const data = await fetchNotificaciones(userId);
        setNotifs(data);
      } catch { /* ignore */ }
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    if (!userId) return () => clearInterval(interval);

    const sb = createClient();
    const channel = sb
      .channel(`notif-bell-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones", filter: `user_id=eq.${userId}` },
        () => { refresh(); },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      sb.removeChannel(channel);
    };
  }, [userId, refresh]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = async () => {
    if (open) { setOpen(false); exitSelectMode(); return; }
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

  const handleDeleteOne = async (id: string) => {
    const wasUnread = notifs.find(n => n.id === id && !n.leida);
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setCount(prev => Math.max(0, prev - 1));
    await deleteNotificacion(id).catch(() => {});
  };

  const handleDeleteAll = async () => {
    if (!userId || notifs.length === 0) return;
    if (!window.confirm("¿Borrar todas las notificaciones?")) return;
    setNotifs([]);
    setCount(0);
    exitSelectMode();
    await deleteAllForUser(userId).catch(() => {});
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === notifs.length) setSelected(new Set());
    else setSelected(new Set(notifs.map(n => n.id)));
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const removedUnread = notifs.filter(n => selected.has(n.id) && !n.leida).length;
    setNotifs(prev => prev.filter(n => !selected.has(n.id)));
    setCount(prev => Math.max(0, prev - removedUnread));
    exitSelectMode();
    await Promise.all(ids.map(id => deleteNotificacion(id).catch(() => {})));
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
            <h4 className="text-sm font-semibold text-navy">
              {selectMode ? `Seleccionadas (${selected.size})` : "Notificaciones"}
            </h4>
            <div className="flex items-center gap-1">
              {selectMode ? (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-navy hover:bg-cream"
                    title={selected.size === notifs.length ? "Deseleccionar todo" : "Seleccionar todo"}
                  >
                    {selected.size === notifs.length && notifs.length > 0
                      ? <CheckSquare size={12} />
                      : <Square size={12} />}
                    Todos
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red hover:bg-red/10"
                      title="Borrar seleccionadas"
                    >
                      <Trash2 size={12} /> Borrar ({selected.size})
                    </button>
                  )}
                  <button
                    onClick={exitSelectMode}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-muted hover:bg-cream"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {count > 0 && userId && (
                    <button
                      onClick={handleMarkAll}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gold hover:bg-gold/10"
                    >
                      <CheckCheck size={12} /> Leer todas
                    </button>
                  )}
                  {notifs.length > 0 && userId && (
                    <button
                      onClick={() => setSelectMode(true)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-navy hover:bg-cream"
                      title="Seleccionar"
                    >
                      <CheckSquare size={12} /> Seleccionar
                    </button>
                  )}
                  {notifs.length > 0 && userId && (
                    <button
                      onClick={handleDeleteAll}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red hover:bg-red/10"
                      title="Borrar todas"
                    >
                      <Trash2 size={12} /> Borrar todas
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-cream"><X size={14} /></button>
                </>
              )}
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
              notifs.map((n) => {
                const isSel = selected.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={selectMode ? () => toggleSelect(n.id) : undefined}
                    className={`flex items-start gap-3 border-b border-border/50 px-4 py-3 transition-colors ${
                      selectMode
                        ? `cursor-pointer ${isSel ? "bg-gold/10" : "bg-white hover:bg-cream/50"}`
                        : n.leida ? "bg-white" : "bg-gold/5"
                    }`}
                  >
                    {selectMode ? (
                      <div className="mt-0.5 shrink-0 text-gold">
                        {isSel ? <CheckSquare size={14} /> : <Square size={14} className="text-muted" />}
                      </div>
                    ) : (
                      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? "bg-transparent" : "bg-gold"}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-text">{n.mensaje}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-muted">{formatDate(n.created_at)}</span>
                        {!selectMode && n.referencia_id && (
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
                    {!selectMode && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {!n.leida && (
                          <button
                            onClick={() => handleMarkOne(n.id)}
                            className="rounded p-1 text-muted hover:bg-cream hover:text-navy"
                            title="Marcar como leída"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteOne(n.id)}
                          className="rounded p-1 text-muted hover:bg-red/10 hover:text-red"
                          title="Borrar notificación"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
