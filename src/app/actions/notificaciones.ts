"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { notificationMirrorTemplate } from "@/lib/email/templates";

export interface NotificacionRow {
  id: string;
  user_id: string | null;
  tipo: string;
  mensaje: string;
  referencia_id: string | null;
  leida: boolean;
  created_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function mirrorNotificacionToEmail(params: {
  userId?: string | null;
  email?: string | null;
  recipientName?: string | null;
  tipo: string;
  mensaje: string;
  referenciaId?: string | null;
}): Promise<void> {
  try {
    let targetEmail = (params.email ?? "").trim();
    let recipientName = (params.recipientName ?? "").trim() || undefined;

    if (!EMAIL_RE.test(targetEmail) && params.userId) {
      const sb = await createServiceClient();
      const { data } = await sb.auth.admin.getUserById(params.userId);
      const u = data?.user;
      if (u?.email) targetEmail = u.email.trim();
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const metaName = typeof meta.nombre === "string" ? meta.nombre : null;
      if (!recipientName && metaName) recipientName = metaName;
    }

    if (!EMAIL_RE.test(targetEmail)) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;
    const tpl = notificationMirrorTemplate({
      tipo: params.tipo,
      mensaje: params.mensaje,
      referenciaId: params.referenciaId ?? undefined,
      recipientName,
      appUrl,
    });

    await sendEmail({
      to: targetEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
  } catch (err) {
    console.error("[notificaciones] email mirror failed:", err);
  }
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
  email?: string;
  recipientName?: string;
}): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("notificaciones").insert({
    user_id: params.userId ?? null,
    tipo: params.tipo,
    mensaje: params.mensaje,
    referencia_id: params.referenciaId ?? null,
  });
  if (error) throw new Error(error.message);

  await mirrorNotificacionToEmail({
    userId: params.userId ?? null,
    email: params.email ?? null,
    recipientName: params.recipientName ?? null,
    tipo: params.tipo,
    mensaje: params.mensaje,
    referenciaId: params.referenciaId ?? null,
  });
}

export async function deleteNotificacion(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAllForUser(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
