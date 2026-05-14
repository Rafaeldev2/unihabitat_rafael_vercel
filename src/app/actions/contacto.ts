"use server";

import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { contactInquiryTemplate } from "@/lib/email/templates";

interface ContactFormData {
  nombre: string;
  email: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
  assetId?: string;
}

export async function enviarContacto(data: ContactFormData): Promise<{ ok: boolean; error?: string }> {
  const nombre = data.nombre?.trim() ?? "";
  const email = data.email?.trim() ?? "";
  const asunto = data.asunto?.trim() ?? "";
  const mensaje = data.mensaje?.trim() ?? "";
  const telefono = data.telefono?.trim() || undefined;

  if (!nombre || !email || !asunto || !mensaje) {
    return { ok: false, error: "Todos los campos obligatorios deben estar completos" };
  }

  const tpl = contactInquiryTemplate({ nombre, email, telefono, asunto, mensaje });
  const result = await sendEmail({
    to: EMAIL_SUPPORT,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: email,
  });

  if (!result.ok) {
    console.error("[contacto] sendEmail failed:", { error: result.error, to: EMAIL_SUPPORT });
    const detail = result.error ? ` (${result.error})` : "";
    return { ok: false, error: `No se pudo enviar el mensaje.${detail}` };
  }
  return { ok: true };
}
