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
 * For vendor: checks that the asset is assigned to them.
 */
export async function requireAssetAccess(session: UserSession, assetId: string): Promise<void> {
  if (session.role === "admin") return;
  if (!session.vendedorId) throw new Error("Vendedor sin ID asignado");

  const { createServiceClient } = await import("./supabase/server");
  const sb = await createServiceClient();
  const { data } = await sb
    .from("vendedor_assets")
    .select("asset_id")
    .eq("vendedor_id", session.vendedorId)
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!data) throw new Error("No tienes acceso a este activo");
}
