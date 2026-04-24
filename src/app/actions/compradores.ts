"use server";

import { createClient } from "@/lib/supabase/server";
import { rowToComprador, compradorToRow } from "@/lib/supabase/db";
import type { Comprador } from "@/lib/types";

export async function fetchCompradores(): Promise<Comprador[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compradores")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToComprador);
}

export async function fetchCompradorById(id: string): Promise<Comprador | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compradores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToComprador(data) : null;
}

export async function fetchCompradorByEmail(email: string): Promise<Comprador | null> {
  const supabase = await createClient();
  const trimmed = email.trim();
  const { data, error } = await supabase
    .from("compradores")
    .select("*")
    .ilike("email", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToComprador(data) : null;
}

/** Crea un registro de comprador si no existe (portal público / dev-auth sin fila en BD). */
export async function ensureCompradorForEmail(email: string, nombre: string): Promise<string> {
  const existing = await fetchCompradorByEmail(email);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const initials = nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";
  const c: Comprador = {
    id,
    nombre: nombre.trim() || "Usuario",
    ini: initials,
    col: "#2563a8,#0d2a4a",
    tipo: "Free",
    agente: "Admin",
    email: email.trim(),
    tel: "",
    intereses: "",
    presupuesto: "",
    activos: "0",
    actividad: "",
    estado: "Nuevo",
    estadoC: "fp-nd",
    nda: "Pendiente",
  };
  await upsertComprador(c);
  return id;
}

export async function upsertComprador(c: Comprador): Promise<void> {
  const supabase = await createClient();
  const row = compradorToRow(c);
  const { error } = await supabase
    .from("compradores")
    .upsert(row, { onConflict: "id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}
