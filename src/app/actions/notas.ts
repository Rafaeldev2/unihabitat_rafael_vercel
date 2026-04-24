"use server";

import { createClient } from "@/lib/supabase/server";

export interface NotaRow {
  id: string;
  asset_id: string | null;
  comprador_id: string | null;
  author: string;
  text: string;
  created_at: string;
}

export async function fetchNotas(opts: { assetId?: string; compradorId?: string }): Promise<NotaRow[]> {
  const supabase = await createClient();
  let query = supabase.from("notas").select("*");

  if (opts.assetId) query = query.eq("asset_id", opts.assetId);
  if (opts.compradorId) query = query.eq("comprador_id", opts.compradorId);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NotaRow[];
}

export async function createNota(params: {
  assetId?: string;
  compradorId?: string;
  author: string;
  text: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notas").insert({
    asset_id: params.assetId ?? null,
    comprador_id: params.compradorId ?? null,
    author: params.author,
    text: params.text,
  });
  if (error) throw new Error(error.message);
}
