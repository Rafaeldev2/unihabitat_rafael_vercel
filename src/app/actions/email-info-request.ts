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

  const asset: {
    id: string;
    fullAddr?: string;
    addr?: string;
    pob?: string;
    prov?: string;
    cp?: string;
    tip?: string;
    cat?: string;
  } = { id: assetId };

  try {
    const sb = await createServiceClient();
    const { data: row, error: dbError } = await sb
      .from("assets")
      .select("id, full_addr, addr, pob, prov, cp, tip, cat")
      .eq("id", assetId)
      .maybeSingle();
    if (dbError) {
      console.warn("[info-request] supabase asset lookup error:", dbError);
    } else if (row) {
      asset.fullAddr = (row.full_addr as string | undefined) ?? undefined;
      asset.addr = (row.addr as string | undefined) ?? undefined;
      asset.pob = (row.pob as string | undefined) ?? undefined;
      asset.prov = (row.prov as string | undefined) ?? undefined;
      asset.cp = (row.cp as string | undefined) ?? undefined;
      asset.tip = (row.tip as string | undefined) ?? undefined;
      asset.cat = (row.cat as string | undefined) ?? undefined;
    }
  } catch (err) {
    console.warn("[info-request] supabase unavailable, sending email without asset detail:", err);
  }

  const tpl = infoRequestTemplate({ nombre, email, telefono, mensaje, asset });
  const result = await sendEmail({
    to: EMAIL_SUPPORT,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: email,
  });

  if (!result.ok) {
    console.error("[info-request] sendEmail failed:", { error: result.error, to: EMAIL_SUPPORT, assetId });
    const detail = result.error ? ` (${result.error})` : "";
    return { ok: false, error: `No se pudo enviar la solicitud.${detail}` };
  }
  return { ok: true };
}
