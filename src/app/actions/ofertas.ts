"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyOfferRecipients } from "@/lib/ofertas/notify";
import { getServerSession, requireAdminOrVendor } from "@/lib/auth-server";
import { fetchCompradorByEmail } from "@/app/actions/compradores";

export interface OfertaRow {
  id: string;
  comprador_id: string | null;
  vendedor_id: string | null;
  asset_id: string;
  propuesta_euros: number;
  comentarios: string | null;
  estado: "pendiente" | "validada" | "rechazada" | "nda_enviado" | "nda_firmado";
  nda_enviado_at: string | null;
  nda_firmado_at: string | null;
  created_at: string;
  updated_at: string;
}

const AGENTE_SIN_VINCULO =
  "El agente no está vinculado a un registro de vendedores: su usuario no tiene una fila vendedores asociada. Contacte al administrador.";

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
  await notifyOfferRecipients(oferta);
  return oferta;
}

/**
 * Alta de oferta desde admin/vendedor (ficha del activo).
 * Agente: se asigna a session.vendedorId (sin comprador).
 * Admin: requiere compradorId.
 */
export async function createOfertaAdmin(params: {
  compradorId?: string;
  assetId: string;
  propuestaEuros: number;
  comentarios?: string;
}): Promise<OfertaRow> {
  const session = await requireAdminOrVendor();

  const assetId = params.assetId?.trim();
  const propuesta = Number(params.propuestaEuros);

  if (!assetId) throw new Error("Falta el activo");
  if (!Number.isFinite(propuesta) || propuesta <= 0) {
    throw new Error("El importe debe ser un número mayor que 0");
  }

  const supabase = await createServiceClient();

  const { data: assetRow, error: assetErr } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw new Error(assetErr.message);
  if (!assetRow) throw new Error("Activo no encontrado");

  let compradorId: string | null = null;
  let vendedorId: string | null = null;

  if (session.role === "vendedor") {
    if (!session.vendedorId) {
      throw new Error(AGENTE_SIN_VINCULO);
    }
    vendedorId = session.vendedorId;
    const { data: vendRow, error: vendErr } = await supabase
      .from("vendedores")
      .select("id")
      .eq("id", vendedorId)
      .maybeSingle();
    if (vendErr) throw new Error(vendErr.message);
    if (!vendRow) {
      throw new Error("La fila vendedores del agente no existe en la base de datos. Contacte al administrador.");
    }
  } else {
    compradorId = params.compradorId?.trim() || null;
    if (!compradorId) throw new Error("Selecciona un comprador");
    const { data: compRow, error: compErr } = await supabase
      .from("compradores")
      .select("id")
      .eq("id", compradorId)
      .maybeSingle();
    if (compErr) throw new Error(compErr.message);
    if (!compRow) throw new Error("Comprador no encontrado");
  }

  const { data, error } = await supabase
    .from("ofertas")
    .insert({
      comprador_id: compradorId,
      vendedor_id: vendedorId,
      asset_id: assetId,
      propuesta_euros: propuesta,
      comentarios: params.comentarios?.trim() || null,
      estado: "pendiente",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const oferta = data as OfertaRow;
  await notifyOfferRecipients(oferta);
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

/**
 * Ofertas para el panel admin/vendedor.
 * Admin: ve todas. Vendedor: solo las que tienen su vendedor_id.
 * Filtro opcional por estado.
 */
export async function fetchOfertas(estado?: OfertaRow["estado"] | ""): Promise<OfertaRow[]> {
  const session = await requireAdminOrVendor();
  // Sin vínculo no hay ámbito que aplicar: fallar cerrado antes de consultar.
  const esAgente = session.role === "vendedor";
  if (esAgente && !session.vendedorId) throw new Error(AGENTE_SIN_VINCULO);

  const supabase = await createClient();
  let q = supabase.from("ofertas").select("*").order("created_at", { ascending: false });
  if (esAgente) q = q.eq("vendedor_id", session.vendedorId);

  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OfertaRow[];
}

export async function updateOfertaEstado(
  ofertaId: string,
  estado: OfertaRow["estado"]
): Promise<void> {
  await requireAdminOrVendor();
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
  const session = await getServerSession();
  if (!session?.email) {
    throw new Error("Acceso denegado: se requiere autenticación");
  }
  if (session.role === "admin" || session.role === "vendedor") {
    throw new Error("Acceso denegado: acción reservada al comprador");
  }

  const comprador = await fetchCompradorByEmail(session.email);
  if (!comprador) {
    throw new Error("Comprador no encontrado");
  }

  const supabase = await createClient();
  const { data: oferta, error: fetchErr } = await supabase
    .from("ofertas")
    .select("comprador_id, asset_id, estado")
    .eq("id", ofertaId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!oferta) throw new Error("Oferta no encontrada");
  if (oferta.comprador_id !== comprador.id) {
    throw new Error("Acceso denegado: no puedes firmar esta oferta");
  }
  if (oferta.estado !== "nda_enviado") {
    throw new Error("Esta oferta no está pendiente de firma de NDA");
  }

  const { error } = await supabase
    .from("ofertas")
    .update({
      estado: "nda_firmado",
      nda_firmado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ofertaId);
  if (error) throw new Error(error.message);

  // Sincroniza flag NDA del comprador (no automatiza acceso al portal).
  if (oferta?.comprador_id) {
    const service = await createServiceClient();
    await service
      .from("compradores")
      .update({ nda: "Firmada" })
      .eq("id", oferta.comprador_id);

    if (oferta.asset_id) {
      await service
        .from("oportunidades")
        .update({ estado: "contactada", updated_at: new Date().toISOString() })
        .eq("comprador_id", oferta.comprador_id)
        .eq("asset_id", oferta.asset_id);
    }
  }
}
