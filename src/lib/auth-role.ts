/**
 * Role resolution logic for corporate admin flow.
 * Centralizes how we determine a user's role from metadata, email domain, or DB.
 *
 * Priority:
 * 1. DB / user_metadata role if admin|vendedor
 * 2. @unihabitat.net domain → admin
 * 3. Otherwise → cliente
 */

export type AppRole = "admin" | "vendedor" | "cliente";

const VALID_ROLES: ReadonlySet<string> = new Set(["admin", "vendedor"]);
const CORP_DOMAIN = "@unihabitat.net";

/**
 * Check if dev-auth (demo users) should be enabled.
 * Only enabled when NODE_ENV !== "production", unless ALLOW_DEV_AUTH is explicitly set.
 */
export function isDevAuthEnabled(): boolean {
  if (process.env.ALLOW_DEV_AUTH === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Resolve role from user metadata or email domain.
 * @param metadataRole - Role from DB or user_metadata (e.g., "admin", "vendedor")
 * @param email - User's email address
 * @returns Resolved role
 */
export function resolveRole(metadataRole: string | undefined | null, email: string | undefined | null): AppRole {
  const roleStr = metadataRole?.toLowerCase()?.trim();
  if (roleStr && VALID_ROLES.has(roleStr)) {
    return roleStr as AppRole;
  }

  const emailLower = email?.toLowerCase()?.trim() ?? "";
  if (emailLower.endsWith(CORP_DOMAIN)) {
    return "admin";
  }

  return "cliente";
}

/**
 * Check if an email belongs to the demo/dev users list.
 * Demo logins are restricted to dev environments only.
 */
export function isDemoEmail(email: string | undefined | null): boolean {
  const emailLower = email?.toLowerCase()?.trim() ?? "";
  return emailLower.endsWith("@propcrm.com");
}
