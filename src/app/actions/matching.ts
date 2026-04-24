"use server";

import { createClient } from "@/lib/supabase/server";
import { rowToAsset, rowToComprador } from "@/lib/supabase/db";
import { findMatches } from "@/lib/matching";
import { createNotificacion } from "./notificaciones";

export interface OportunidadRow {
  id: string;
  comprador_id: string;
  asset_id: string;
  score: number;
  estado: string;
  created_at: string;
}

export async function computeMatchesForAsset(assetId: string): Promise<number> {
  const supabase = await createClient();

  const { data: assetRow, error: assetErr } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw new Error(assetErr.message);
  if (!assetRow) return 0;
  const asset = rowToAsset(assetRow);

  const { data: compRows, error: compErr } = await supabase
    .from("compradores")
    .select("*");
  if (compErr) throw new Error(compErr.message);
  if (!compRows?.length) return 0;
  const compradores = compRows.map(rowToComprador);

  const matches = findMatches(compradores, [asset]);
  if (!matches.length) return 0;

  // Upsert matches into oportunidades
  for (const m of matches) {
    const { error: upsertErr } = await supabase
      .from("oportunidades")
      .upsert(
        { comprador_id: m.compradorId, asset_id: m.assetId, score: m.score, estado: "nueva" },
        { onConflict: "comprador_id,asset_id" }
      );
    if (upsertErr) throw new Error(upsertErr.message);
  }

  // Notify top 5 matching compradores
  for (const m of matches.slice(0, 5)) {
    const { data: compUserRow } = await supabase
      .from("compradores")
      .select("user_id")
      .eq("id", m.compradorId)
      .maybeSingle();

    if (compUserRow?.user_id) {
      await createNotificacion({
        userId: compUserRow.user_id,
        tipo: "match",
        mensaje: `Nuevo activo disponible en ${asset.prov} — ${asset.tip} (${asset.id}) coincide con tu perfil.`,
        referenciaId: assetId,
      });
    }
  }

  return matches.length;
}

export async function computeMatchesForComprador(compradorId: string): Promise<number> {
  const supabase = await createClient();

  const { data: compRow, error: compErr } = await supabase
    .from("compradores")
    .select("*")
    .eq("id", compradorId)
    .maybeSingle();
  if (compErr) throw new Error(compErr.message);
  if (!compRow) return 0;
  const comprador = rowToComprador(compRow);

  const { data: assetRows, error: assetErr } = await supabase
    .from("assets")
    .select("*");
  if (assetErr) throw new Error(assetErr.message);
  if (!assetRows?.length) return 0;
  const assets = assetRows.map(rowToAsset);

  const matches = findMatches([comprador], assets);
  if (!matches.length) return 0;

  for (const m of matches) {
    const { error: upsertErr } = await supabase
      .from("oportunidades")
      .upsert(
        { comprador_id: m.compradorId, asset_id: m.assetId, score: m.score, estado: "nueva" },
        { onConflict: "comprador_id,asset_id" }
      );
    if (upsertErr) throw new Error(upsertErr.message);
  }

  return matches.length;
}

export async function fetchOportunidadesByAsset(assetId: string): Promise<OportunidadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("asset_id", assetId)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OportunidadRow[];
}

export async function fetchOportunidadesByComprador(compradorId: string): Promise<OportunidadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("comprador_id", compradorId)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OportunidadRow[];
}
