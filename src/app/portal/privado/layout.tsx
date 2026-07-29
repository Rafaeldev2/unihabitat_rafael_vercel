import Link from "next/link";
import { Lock } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchCompradorByEmail } from "@/app/actions/compradores";

/**
 * Bloquea /portal/privado si el comprador tiene acceso = sin_acceso.
 * Admin/vendedor pasan; el resto (incl. cuentas demo) requiere acceso activo en BD.
 */
export default async function PortalPrivadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("dev-auth")?.value;
  let email: string | null = null;
  let role: string | null = null;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { email?: string; role?: string };
      email = parsed.email?.trim().toLowerCase() ?? null;
      role = parsed.role ?? null;
    } catch {
      /* ignore */
    }
  }

  if (!email) {
    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      email = user?.email?.trim().toLowerCase() ?? null;
      role = (user?.user_metadata?.role as string | undefined) ?? (user ? "cliente" : null);
    } catch {
      /* ignore */
    }
  }

  if (role === "admin" || role === "vendedor") {
    return <>{children}</>;
  }

  if (!email) {
    redirect("/login?redirect=/portal/privado");
  }

  let acceso = "sin_acceso";
  try {
    const comprador = await fetchCompradorByEmail(email);
    if (comprador) {
      acceso = comprador.acceso;
    }
  } catch (err) {
    console.warn("[portal/privado] acceso check failed (fail-closed):", err);
    acceso = "sin_acceso";
  }

  if (acceso === "sin_acceso") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <Lock size={40} strokeWidth={1} className="text-border" />
        <h1 className="mt-4 text-lg font-semibold text-navy">Acceso pendiente de validación</h1>
        <p className="mt-2 text-sm text-muted">
          Tu cuenta está registrada, pero un administrador debe activar tu acceso al área privada
          (validación manual / NDA). Te avisaremos cuando esté listo.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/portal" className="rounded-lg bg-navy px-4 py-2 text-xs font-medium text-white hover:bg-navy3">
            Ver catálogo público
          </Link>
          <Link href="/login" className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-navy hover:bg-cream">
            Cambiar de cuenta
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
