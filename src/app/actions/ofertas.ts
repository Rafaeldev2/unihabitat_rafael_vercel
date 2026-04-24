"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";

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
  return data as OfertaRow;
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
