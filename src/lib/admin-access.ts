import { canViewSection } from "@/lib/auth-helpers";
import type { SectionId, UserSession, VendorPermission } from "@/lib/permissions";

export interface AdminAccessInput {
  session: UserSession | null;
  sessionResolved: boolean;
  permissions: VendorPermission[];
  currentSection: SectionId | "config" | null;
  isGuiaStaging: boolean;
  showStagingGuide: boolean;
}

/**
 * Un agente siempre recibe una entrada por sección, así que la lista vacía solo
 * ocurre mientras los permisos están en vuelo. Decidir accesos en ese hueco
 * expulsa a Activos a agentes que sí tienen permiso.
 */
export function arePermissionsResolved(
  session: UserSession | null,
  permissions: VendorPermission[],
): boolean {
  return session?.role !== "vendedor" || permissions.length > 0;
}

/** Secciones que no dependen de `vendedor_permissions`. */
function isUnrestricted(section: SectionId | "config" | null): boolean {
  return !section || section === "config";
}

export function isSectionAllowed(input: AdminAccessInput): boolean {
  const { session, sessionResolved, permissions, currentSection } = input;
  if (input.isGuiaStaging) return input.showStagingGuide && session?.role === "admin";
  if (!sessionResolved || !session) return true;
  if (session.role === "admin" || isUnrestricted(currentSection)) return true;
  if (!arePermissionsResolved(session, permissions)) return true;
  return canViewSection(session, currentSection as SectionId, permissions);
}

/** True cuando hay que devolver al agente a Activos por falta de permiso. */
export function shouldRedirectToActivos(input: AdminAccessInput): boolean {
  const { session, sessionResolved, permissions, currentSection } = input;
  if (!sessionResolved || !session || session.role === "admin") return false;
  if (!currentSection || !arePermissionsResolved(session, permissions)) return false;
  return !canViewSection(session, currentSection, permissions);
}

export interface NavVisibilityInput {
  session: UserSession | null;
  sessionResolved: boolean;
  permissions: VendorPermission[];
  showStagingGuide: boolean;
}

export function isNavItemVisible(
  item: { sectionId: SectionId | "config" | "guia-staging"; stagingOnly?: boolean },
  input: NavVisibilityInput,
): boolean {
  const { session, sessionResolved, permissions, showStagingGuide } = input;
  if (!sessionResolved || !session) return false;
  if (item.stagingOnly) return showStagingGuide && session.role === "admin";
  return canViewSection(session, item.sectionId as SectionId | "config", permissions);
}
