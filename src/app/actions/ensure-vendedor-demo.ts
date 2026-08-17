import { createServiceClient } from "@/lib/supabase/server";
import { vendedorToRow } from "@/lib/supabase/db";
import { defaultVendorPermissions } from "@/lib/permissions";
import type { Vendedor } from "@/lib/types";

export const DEMO_VENDEDOR_EMAIL = "vendedor@propcrm.com" as const;

function demoInitials(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  );
}

export async function ensureVendedorForDemoEmail(
  email: string,
  nombre: string,
): Promise<string> {
  const emailKey = email.trim().toLowerCase();
  if (emailKey !== DEMO_VENDEDOR_EMAIL) {
    throw new Error(
      "ensureVendedorForDemoEmail solo aplica al email demo de agente",
    );
  }

  const sb = await createServiceClient();
  const { data: existing, error: findErr } = await sb
    .from("vendedores")
    .select("id")
    .eq("email", emailKey)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing?.id) return existing.id as string;

  const id = crypto.randomUUID();
  const displayName = nombre.trim() || "Carlos Martínez";
  const v: Vendedor = {
    id,
    nombre: displayName,
    ini: demoInitials(displayName),
    col: "#2563a8,#0d2a4a",
    cartera: "",
    activo: "",
    agente: "Admin",
    tel: "",
    email: emailKey,
    ultimo: "",
    estado: "Activo",
    estadoC: "fp-pub",
  };

  const { error: upsertErr } = await sb
    .from("vendedores")
    .upsert(vendedorToRow(v), { onConflict: "id", ignoreDuplicates: false });
  if (upsertErr) throw new Error(upsertErr.message);

  const permissions = defaultVendorPermissions().map((p) =>
    p.section === "ofertas" ? { ...p, canView: true, canEdit: true } : p,
  );
  const rows = permissions.map((p) => ({
    vendedor_id: id,
    section: p.section,
    can_view: p.canView,
    can_edit: p.canEdit,
  }));
  const { error: permErr } = await sb
    .from("vendedor_permissions")
    .upsert(rows, { onConflict: "vendedor_id,section" });
  if (permErr) throw new Error(permErr.message);

  return id;
}
