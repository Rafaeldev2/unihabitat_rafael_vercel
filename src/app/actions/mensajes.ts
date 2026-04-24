"use server";

import { createClient } from "@/lib/supabase/server";

export interface MensajeRow {
  id: string;
  asset_id: string | null;
  comprador_id: string | null;
  from_role: "cli" | "adm";
  from_name: string;
  text: string;
  created_at: string;
}

export async function fetchMensajes(assetId?: string, compradorId?: string): Promise<MensajeRow[]> {
  const supabase = await createClient();
  let query = supabase.from("mensajes").select("*");

  if (assetId) query = query.eq("asset_id", assetId);
  if (compradorId) query = query.eq("comprador_id", compradorId);

  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MensajeRow[];
}

export async function sendMensaje(params: {
  assetId?: string;
  compradorId?: string;
  fromRole: "cli" | "adm";
  fromName: string;
  text: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("mensajes").insert({
    asset_id: params.assetId ?? null,
    comprador_id: params.compradorId ?? null,
    from_role: params.fromRole,
    from_name: params.fromName,
    text: params.text,
  });
  if (error) throw new Error(error.message);
}
