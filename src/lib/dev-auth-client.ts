/** Lee la cookie dev-auth (solo entorno desarrollo / login sin Supabase). */

export function getDevAuthFromDocument(): { email: string; nombre: string; role: string } | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith("dev-auth="));
  if (!raw) return null;
  try {
    const json = decodeURIComponent(raw.split("=").slice(1).join("="));
    const o = JSON.parse(json) as { email?: string; nombre?: string; role?: string };
    if (!o.email || !o.role) return null;
    return { email: o.email, nombre: o.nombre || "Usuario", role: o.role };
  } catch {
    return null;
  }
}
