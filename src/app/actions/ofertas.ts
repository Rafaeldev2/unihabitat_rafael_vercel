"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_SUPPORT } from "@/lib/email/resend";
import { offerTemplate } from "@/lib/email/templates";

export interface OfertaRow {
  id: string;
  comprador_id: string;
  asset_id: string;
  propuesta_euros: number;
  comentarios: string | null;
  estado: "pendiente" | "validada" | "rechazada" | "nda_enviado" | "nda_firmado";
  nda_enviado_at: string | null;
  nda_firmado_at: string | null;
  created_at: string;
  updated_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyOfferRecipients(
  ofertaId: string,
  assetId: string,
  compradorId: string,
  propuestaEuros: number,
  comentarios: string | null,
): Promise<void> {
  try {
    const sb = await createServiceClient();
    const [{ data: assetRow }, { data: compRow }, { data: vaRows }] = await Promise.all([
      sb.from("assets")
        .select("id, full_addr, addr, pob, prov, cp, tip, precio, owner_mail")
        .eq("id", assetId)
        .maybeSingle(),
      sb.from("compradores")
        .select("nombre, email, tel")
        .eq("id", compradorId)
        .maybeSingle(),
      sb.from("vendedor_assets")
        .select("vendedor_id")
        .eq("asset_id", assetId),
    ]);

    const vendorIds = (vaRows ?? []).map(r => r.vendedor_id as string).filter(Boolean);
    let vendorEmails: string[] = [];
    if (vendorIds.length > 0) {
      const { data: vRows } = await sb
        .from("vendedores")
        .select("email")
        .in("id", vendorIds);
      vendorEmails = (vRows ?? [])
        .map(r => (r.email as string | undefined)?.trim() ?? "")
        .filter(e => EMAIL_RE.test(e));
    }

    const ownerMail = (assetRow?.owner_mail as string | undefined)?.trim() ?? "";
    if (vendorEmails.length === 0 && EMAIL_RE.test(ownerMail)) {
      vendorEmails = [ownerMail];
    }

    const recipients = vendorEmails.length > 0 ? vendorEmails : [EMAIL_SUPPORT];

    const buyerEmail = (compRow?.email as string | undefined)?.trim() ?? "";
    const tpl = offerTemplate({
      buyer: {
        nombre: (compRow?.nombre as string | undefined) ?? "Comprador",
        email: buyerEmail,
        telefono: (compRow?.tel as string | undefined) || undefined,
      },
      asset: {
        id: (assetRow?.id as string | undefined) ?? assetId,
        fullAddr: (assetRow?.full_addr as string | undefined) ?? undefined,
        addr: (assetRow?.addr as string | undefined) ?? undefined,
        pob: (assetRow?.pob as string | undefined) ?? undefined,
        prov: (assetRow?.prov as string | undefined) ?? undefined,
        cp: (assetRow?.cp as string | undefined) ?? undefined,
        tip: (assetRow?.tip as string | undefined) ?? undefined,
        precio: (assetRow?.precio as number | null | undefined) ?? null,
      },
      propuestaEuros,
      comentarios: comentarios || undefined,
      ofertaId,
    });

    const subject = vendorEmails.length === 0 ? `${tpl.subject} [Sin vendedor asignado]` : tpl.subject;
    await sendEmail({
      to: recipients,
      subject,
      html: tpl.html,
      text: tpl.text,
      replyTo: EMAIL_RE.test(buyerEmail) ? buyerEmail : undefined,
    });
  } catch (err) {
    console.error("[ofertas] email notification failed:", err);
  }
}

export async function createOferta(params: {
  compradorId: string;
  assetId: string;
  propuestaEuros: number;
  comentarios?: string;
}): Promise<OfertaRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas")
    .insert({
      comprador_id: params.compradorId,
      asset_id: params.assetId,
      propuesta_euros: params.propuestaEuros,
      comentarios: params.comentarios || null,
      estado: "pendiente",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const oferta = data as OfertaRow;
  await notifyOfferRecipients(
    oferta.id,
    oferta.asset_id,
    oferta.comprador_id,
    oferta.propuesta_euros,
    oferta.comentarios,
  );
  return oferta;
}

export async function fetchOfertasByAsset(assetId: string): Promise<OfertaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas")
    .select("*")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OfertaRow[];
}

export async function fetchOfertasByComprador(compradorId: string): Promise<OfertaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas")
    .select("*")
    .eq("comprador_id", compradorId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OfertaRow[];
}

export async function fetchOfertasPendientes(): Promise<OfertaRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas")
    .select("*")
    .in("estado", ["pendiente", "nda_enviado"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OfertaRow[];
}

export async function updateOfertaEstado(
  ofertaId: string,
  estado: OfertaRow["estado"]
): Promise<void> {
  const serviceClient = await createServiceClient();
  const updateData: Partial<OfertaRow> = { estado, updated_at: new Date().toISOString() };
  if (estado === "nda_enviado") {
    updateData.nda_enviado_at = new Date().toISOString();
  } else if (estado === "nda_firmado") {
    updateData.nda_firmado_at = new Date().toISOString();
  }
  const { error } = await serviceClient
    .from("ofertas")
    .update(updateData)
    .eq("id", ofertaId);
  if (error) throw new Error(error.message);
}

export async function firmarNDA(ofertaId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ofertas")
    .update({
      estado: "nda_firmado",
      nda_firmado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ofertaId);
  if (error) throw new Error(error.message);
}
