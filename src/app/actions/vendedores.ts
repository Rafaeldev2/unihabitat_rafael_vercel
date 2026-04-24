"use server";

import { createClient } from "@/lib/supabase/server";
import { rowToVendedor, vendedorToRow } from "@/lib/supabase/db";
import type { Vendedor } from "@/lib/types";
import { requireAdmin } from "@/lib/auth-server";

export async function fetchVendedores(): Promise<Vendedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToVendedor);
}

export async function fetchVendedorById(id: string): Promise<Vendedor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToVendedor(data) : null;
}

export async function upsertVendedor(v: Vendedor): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const row = vendedorToRow(v);
  const { error } = await supabase
    .from("vendedores")
    .upsert(row, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}
