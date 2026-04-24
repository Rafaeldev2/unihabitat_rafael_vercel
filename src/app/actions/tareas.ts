"use server";

import { createClient } from "@/lib/supabase/server";
import { rowToTarea, tareaToRow } from "@/lib/supabase/db";
import type { Tarea } from "@/lib/types";

export async function fetchTareas(): Promise<Tarea[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tareas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTarea);
}

export async function upsertTarea(t: Tarea): Promise<void> {
  const supabase = await createClient();
  const row = tareaToRow(t);
  const { error } = await supabase
    .from("tareas")
    .upsert(row, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}

export async function toggleTareaDone(id: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tareas")
    .select("done")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const { error: updateErr } = await supabase
    .from("tareas")
    .update({ done: !data.done })
    .eq("id", id);
  if (updateErr) throw new Error(updateErr.message);
}
