"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rowToComprador, compradorToRow } from "@/lib/supabase/db";
import type { Comprador, CompradorAcceso } from "@/lib/types";
import { requireAdmin } from "@/lib/auth-server";

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

/**
 * Resuelve `auth.users.id` por email vía Admin API (best-effort).
 * Devuelve null si el usuario no existe en Auth o si la API admin no está disponible.
 */
async function resolveAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  try {
    const sb = await createServiceClient();
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = data?.users?.find((x) => (x.email || "").toLowerCase() === target);
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/** Crea un registro de comprador si no existe (portal público / dev-auth sin fila en BD). */
export async function ensureCompradorForEmail(email: string, nombre: string): Promise<string> {
  const existing = await fetchCompradorByEmail(email);
  const userId = await resolveAuthUserIdByEmail(email);

  if (existing) {
    if (userId) {
      const sb = await createServiceClient();
      const { data: row } = await sb
        .from("compradores")
        .select("user_id")
        .eq("id", existing.id)
        .maybeSingle();
      if (!row?.user_id) {
        await sb.from("compradores").update({ user_id: userId }).eq("id", existing.id);
      }
    }
    return existing.id;
  }

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
    // Oferta/portal no abre el área privada; solo admin activa acceso.
    acceso: "sin_acceso",
  };
  await upsertComprador(c);
  if (userId) {
    const sb = await createServiceClient();
    await sb.from("compradores").update({ user_id: userId }).eq("id", id);
  }
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

export async function createComprador(input: {
  nombre: string;
  email: string;
  tel?: string;
  tipo?: "Privado" | "Free";
  agente?: string;
  acceso?: CompradorAcceso;
}): Promise<Comprador> {
  await requireAdmin();
  const nombre = input.nombre.trim();
  const email = input.email.trim().toLowerCase();
  if (!nombre || !email) throw new Error("Nombre y email son obligatorios");

  const existing = await fetchCompradorByEmail(email);
  if (existing) throw new Error("Ya existe un comprador con ese email");

  const initials = nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  const c: Comprador = {
    id: crypto.randomUUID(),
    nombre,
    ini: initials,
    col: "#2563a8,#0d2a4a",
    tipo: input.tipo ?? "Privado",
    agente: input.agente?.trim() || "Admin",
    email,
    tel: input.tel?.trim() || "",
    intereses: "",
    presupuesto: "",
    activos: "0",
    actividad: "",
    estado: "Nuevo",
    estadoC: "fp-nd",
    nda: "Pendiente",
    acceso: input.acceso ?? "sin_acceso",
  };
  const sb = await createServiceClient();
  const { error } = await sb.from("compradores").upsert(compradorToRow(c), { onConflict: "id" });
  if (error) throw new Error(error.message);
  return c;
}

export async function updateCompradorFields(
  id: string,
  fields: Partial<Pick<Comprador, "nombre" | "email" | "tel" | "tipo" | "agente" | "estado" | "intereses" | "presupuesto" | "nda" | "acceso">>,
): Promise<void> {
  await requireAdmin();
  if (!id || Object.keys(fields).length === 0) return;
  const patch: Record<string, string> = {};
  if (fields.nombre != null) patch.nombre = fields.nombre.trim();
  if (fields.email != null) patch.email = fields.email.trim().toLowerCase();
  if (fields.tel != null) patch.tel = fields.tel.trim();
  if (fields.tipo != null) patch.tipo = fields.tipo;
  if (fields.agente != null) patch.agente = fields.agente.trim();
  if (fields.estado != null) patch.estado = fields.estado.trim();
  if (fields.intereses != null) patch.intereses = fields.intereses;
  if (fields.presupuesto != null) patch.presupuesto = fields.presupuesto;
  if (fields.nda != null) patch.nda = fields.nda;
  if (fields.acceso != null) patch.acceso = fields.acceso;
  const sb = await createServiceClient();
  const { error } = await sb.from("compradores").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setCompradorAcceso(id: string, acceso: CompradorAcceso): Promise<void> {
  await updateCompradorFields(id, { acceso });
}

export async function deleteComprador(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const sb = await createServiceClient();
  const { error } = await sb.from("compradores").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
