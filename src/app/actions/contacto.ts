"use server";

import { createServiceClient } from "@/lib/supabase/server";

interface ContactFormData {
  nombre: string;
  email: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
  assetId?: string;
}

export async function enviarContacto(data: ContactFormData): Promise<{ ok: boolean; error?: string }> {
  const { nombre, email, asunto, mensaje } = data;

  if (!nombre.trim() || !email.trim() || !asunto.trim() || !mensaje.trim()) {
    return { ok: false, error: "Todos los campos obligatorios deben estar completos" };
  }

  try {
    const sb = await createServiceClient();
    const { error } = await sb.from("mensajes").insert({
      from_email: email.trim(),
      from_name: nombre.trim(),
      telefono: data.telefono?.trim() || null,
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      asset_id: data.assetId || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving contact form:", error);
      return { ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Contact form error:", err);
    return { ok: false, error: "Error del servidor. Inténtalo de nuevo más tarde." };
  }
}
