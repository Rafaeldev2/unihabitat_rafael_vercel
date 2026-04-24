"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-server";

export interface CompradorAssetRow {
  comprador_id: string;
  asset_id: string;
  invited_at: string;
  invited_by: string;
}

export async function inviteCompradorToAsset(
  compradorId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("comprador_assets")
    .upsert(
      { comprador_id: compradorId, asset_id: assetId, invited_by: "Admin" },
      { onConflict: "comprador_id,asset_id" },
    );
  if (error) return { success: false, error: error.message };

  try {
    const { data: comp } = await supabase
      .from("compradores")
      .select("nombre, user_id")
      .eq("id", compradorId)
      .maybeSingle();

    const { data: asset } = await supabase
      .from("assets")
      .select("pob, prov")
      .eq("id", assetId)
      .maybeSingle();

    const nombre = comp?.nombre ?? compradorId;
    const lugar = asset ? `${asset.pob}, ${asset.prov}` : assetId;

    await supabase.from("notificaciones").insert({
      user_id: comp?.user_id ?? null,
      tipo: "invitacion",
      mensaje: `${nombre}, se te ha compartido un activo en ${lugar}`,
      referencia_id: assetId,
    });
  } catch {
    // notification is best-effort
  }

  return { success: true };
}

export async function revokeCompradorFromAsset(
  compradorId: string,
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("comprador_assets")
    .delete()
    .eq("comprador_id", compradorId)
    .eq("asset_id", assetId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function fetchInvitedCompradores(
  assetId: string,
): Promise<{ compradorId: string; invitedAt: string }[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("comprador_assets")
    .select("comprador_id, invited_at")
    .eq("asset_id", assetId)
    .order("invited_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    compradorId: r.comprador_id,
    invitedAt: r.invited_at,
  }));
}

export async function fetchInvitedAssetIds(
  compradorId: string,
): Promise<string[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("comprador_assets")
    .select("asset_id")
    .eq("comprador_id", compradorId);
  if (error) return [];
  return (data ?? []).map((r) => r.asset_id);
}
