"use server";

import { createServiceClient } from "@/lib/supabase/server";

export async function fetchFavoritosByComprador(compradorId: string): Promise<string[]> {
  if (!compradorId) return [];
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("comprador_favoritos")
    .select("asset_id")
    .eq("comprador_id", compradorId);
  if (error) {
    console.error("[fetchFavoritosByComprador]", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.asset_id);
}

export async function addFavorito(
  compradorId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!compradorId || !assetId) {
    return { success: false, error: "compradorId y assetId son obligatorios" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("comprador_favoritos")
    .upsert(
      { comprador_id: compradorId, asset_id: assetId },
      { onConflict: "comprador_id,asset_id" },
    );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeFavorito(
  compradorId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!compradorId || !assetId) {
    return { success: false, error: "compradorId y assetId son obligatorios" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("comprador_favoritos")
    .delete()
    .eq("comprador_id", compradorId)
    .eq("asset_id", assetId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
