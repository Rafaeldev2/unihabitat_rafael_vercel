"use server";

import { createClient } from "@/lib/supabase/server";

export interface NotificacionRow {
  id: string;
  user_id: string | null;
  tipo: string;
  mensaje: string;
  referencia_id: string | null;
  leida: boolean;
  created_at: string;
}

export async function fetchNotificaciones(userId?: string): Promise<NotificacionRow[]> {
  const supabase = await createClient();
  let query = supabase.from("notificaciones").select("*");

  if (userId) query = query.eq("user_id", userId);

  query = query.order("created_at", { ascending: false }).limit(50);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificacionRow[];
}

export async function fetchUnreadCount(userId?: string): Promise<number> {
  const supabase = await createClient();
  try {
    let query = supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("leida", false);

    if (userId) query = query.eq("user_id", userId);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markAsRead(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("user_id", userId)
    .eq("leida", false);
  if (error) throw new Error(error.message);
}

export async function createNotificacion(params: {
  userId?: string;
  tipo: string;
  mensaje: string;
  referenciaId?: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notificaciones").insert({
    user_id: params.userId ?? null,
    tipo: params.tipo,
    mensaje: params.mensaje,
    referencia_id: params.referenciaId ?? null,
  });
  if (error) throw new Error(error.message);
}
