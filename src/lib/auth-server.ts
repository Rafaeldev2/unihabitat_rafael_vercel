import { cookies } from "next/headers";
import type { UserSession, SectionId } from "./permissions";

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("dev-auth")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<UserSession> {
  const session = await getServerSession();
  if (!session || session.role !== "admin") {
    throw new Error("Acceso denegado: se requiere rol admin");
  }
  return session;
}

export async function requireAdminOrVendor(): Promise<UserSession> {
  const session = await getServerSession();
  if (!session || (session.role !== "admin" && session.role !== "vendedor")) {
    throw new Error("Acceso denegado: se requiere autenticación");
  }
  return session;
}

/**
 * Verifies vendor has canEdit for a section. Admins always pass.
 */
export async function requireEditPermission(sectionId: SectionId): Promise<UserSession> {
  const session = await requireAdminOrVendor();
  if (session.role === "admin") return session;

  if (!session.vendedorId) throw new Error("Vendedor sin ID asignado");

  const { createServiceClient } = await import("./supabase/server");
  const sb = await createServiceClient();
  const { data } = await sb
    .from("vendedor_permissions")
    .select("can_edit")
    .eq("vendedor_id", session.vendedorId)
    .eq("section", sectionId)
    .maybeSingle();

  if (!data?.can_edit) {
    throw new Error(`Sin permiso de edición en "${sectionId}"`);
  }
  return session;
}

/**
 * Vendedores share the admin asset universe: they can view (and, when
 * `requireEditPermission` allows, edit) every asset. Kept as a function so
 * existing callers stay unchanged and the gate can be re-tightened later if
 * the product reintroduces per-vendedor asset assignments.
 */
export async function requireAssetAccess(_session: UserSession, _assetId: string): Promise<void> {
  return;
}
