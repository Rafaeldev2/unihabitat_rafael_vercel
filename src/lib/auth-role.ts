import { isCorporateAdminEmail } from "@/lib/corp-email";

export type AppRole = "admin" | "vendedor" | "cliente";

const VALID_ROLES: ReadonlySet<string> = new Set(["admin", "vendedor"]);

export function isDevAuthEnabled(): boolean {
  if (process.env.ALLOW_DEV_AUTH === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function resolveRole(
  metadataRole: string | undefined | null,
  email: string | undefined | null,
): AppRole {
  const roleStr = metadataRole?.toLowerCase()?.trim();
  if (roleStr && VALID_ROLES.has(roleStr)) {
    return roleStr as AppRole;
  }
  if (email && isCorporateAdminEmail(email)) {
    return "admin";
  }
  return "cliente";
}

export function isDemoEmail(email: string | undefined | null): boolean {
  const emailLower = email?.toLowerCase()?.trim() ?? "";
  return emailLower.endsWith("@propcrm.com");
}
