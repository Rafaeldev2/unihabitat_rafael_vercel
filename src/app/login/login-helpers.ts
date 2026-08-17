const ZW_RE = /[\u200b\u200c\u200d\ufeff]/g;

export function normalizeEmailKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(ZW_RE, "").trim().toLowerCase();
}

export function normalizePasswordInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(ZW_RE, "").trim().normalize("NFC");
}

export function destinationForRole(
  role: string | undefined,
  redirectTo: string,
): string {
  if (redirectTo) return redirectTo;
  return role === "admin" || role === "vendedor" ? "/admin" : "/portal/privado";
}

export function withWelcome(path: string): string {
  if (!path) return "";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}welcome=1`;
}
