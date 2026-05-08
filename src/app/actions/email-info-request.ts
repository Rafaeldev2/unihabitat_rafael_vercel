"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { infoRequestTemplate } from "@/lib/email/templates";

interface InfoRequestData {
  assetId: string;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
}

export async function enviarSolicitudInformacion(
  data: InfoRequestData,
): Promise<{ ok: boolean; error?: string }> {
  const nombre = data.nombre?.trim() ?? "";
  const email = data.email?.trim() ?? "";
  const mensaje = data.mensaje?.trim() ?? "";
  const telefono = data.telefono?.trim() || undefined;
  const assetId = data.assetId?.trim() ?? "";

  if (!nombre || !email || !mensaje || !assetId) {
    return { ok: false, error: "Todos los campos obligatorios deben estar completos" };
  }

  const sb = await createServiceClient();
  const { data: row } = await sb
    .from("assets")
    .select("id, full_addr, addr, pob, prov, cp, tip, cat")
    .eq("id", assetId)
    .maybeSingle();

  const asset = {
    id: assetId,
    fullAddr: (row?.full_addr as string | undefined) ?? undefined,
    addr: (row?.addr as string | undefined) ?? undefined,
    pob: (row?.pob as string | undefined) ?? undefined,
    prov: (row?.prov as string | undefined) ?? undefined,
    cp: (row?.cp as string | undefined) ?? undefined,
    tip: (row?.tip as string | undefined) ?? undefined,
    cat: (row?.cat as string | undefined) ?? undefined,
  };

  const tpl = infoRequestTemplate({ nombre, email, telefono, mensaje, asset });
  const result = await sendEmail({
    to: EMAIL_SUPPORT,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: email,
  });

  if (!result.ok) {
    return { ok: false, error: "No se pudo enviar la solicitud. Inténtalo de nuevo más tarde." };
  }
  return { ok: true };
}
