import { cookies } from "next/headers";
import type { UserSession, SectionId } from "./permissions";
import { defaultVendorPermissions } from "./permissions";
import { isDevAuthEnabled, resolveRole } from "./auth-role";

/**
 * Resuelve la sesión actual desde cookies. Prioriza `dev-auth` (cuentas demo)
 * y, si no existe, intenta resolver con Supabase Auth para que los usuarios
 * registrados vía signUp/signIn también queden reconocidos.
 */
export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("dev-auth")?.value;
  if (raw && isDevAuthEnabled()) {
    try {
      return JSON.parse(raw) as UserSession;
    } catch {
      /* fallthrough a Supabase */
    }
  }

  const hasSupabaseCookie = cookieStore
    .getAll()
    .some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  if (!hasSupabaseCookie) return null;

  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const metadataRole = user.user_metadata?.role as string | undefined;
    const role = resolveRole(metadataRole, user.email);

    const nombre =
      (user.user_metadata?.nombre as string | undefined) ||
      user.email ||
      "Usuario";

    const vendedorId =
      role === "vendedor" && user.email
        ? await findVendedorId(user.id, user.email)
        : undefined;

    return {
      email: user.email ?? "",
      role,
      nombre,
      ...(vendedorId ? { vendedorId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Enlaza la sesión con su fila `vendedores`. Sin este id el agente queda fuera
 * de su propio ámbito, así que se reintenta por email cuando la instalación no
 * tiene la columna `user_id`.
 */
async function findVendedorId(userId: string, email: string): Promise<string | undefined> {
  const { createServiceClient } = await import("./supabase/server");
  const sb = await createServiceClient();

  const byLink = await sb
    .from("vendedores").select("id")
    .or(`user_id.eq.${userId},email.ilike.${email}`)
    .limit(1).maybeSingle();
  if (!byLink.error) return (byLink.data?.id as string | undefined) ?? undefined;

  const byEmail = await sb
    .from("vendedores").select("id").ilike("email", email).limit(1).maybeSingle();
  return (byEmail.data?.id as string | undefined) ?? undefined;
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
    .select("section, can_edit")
    .eq("vendedor_id", session.vendedorId);

  if (!vendorCanEdit(data ?? [], sectionId)) {
    throw new Error(`Sin permiso de edición en "${sectionId}"`);
  }
  return session;
}

/**
 * Mismo criterio que `fetchVendorPermissions`: sin ninguna fila configurada
 * mandan los defaults; en cuanto el admin guarda permisos, mandan sus filas.
 */
function vendorCanEdit(rows: { section: string; can_edit: boolean | null }[], sectionId: SectionId): boolean {
  if (rows.length === 0) {
    return defaultVendorPermissions().find((p) => p.section === sectionId)?.canEdit ?? false;
  }
  return Boolean(rows.find((r) => r.section === sectionId)?.can_edit);
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
