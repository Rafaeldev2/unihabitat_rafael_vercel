"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { upsertComprador } from "@/app/actions/compradores";
import { createServiceClient } from "@/lib/supabase/server";

const cookieBase = {
  path: "/" as const,
  httpOnly: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24,
  // Vercel define VERCEL en deploy (HTTPS). En local sin VERCEL la cookie sigue siendo usable en http.
  secure: Boolean(process.env.VERCEL),
};

// ── Dev-only hardcoded users (no Supabase needed) ──
const DEV_USERS: Record<string, { password: string; role: string; nombre: string }> = {
  "admin@propcrm.com": { password: "Admin1234!", role: "admin", nombre: "Administrador" },
  "cliente@propcrm.com": { password: "Cliente1234!", role: "cliente", nombre: "Cliente Demo" },
  "vendedor@propcrm.com": { password: "Vendedor1234!", role: "vendedor", nombre: "Carlos Martínez" },
};

const ZW_RE = /[\u200b\u200c\u200d\ufeff]/g;

function normalizeEmailKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(ZW_RE, "").trim().toLowerCase();
}

function normalizePasswordInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(ZW_RE, "").trim().normalize("NFC");
}

export async function signIn(formData: FormData) {
  const emailRaw = formData.get("email");
  const password = formData.get("password");
  const redirectTo = (formData.get("redirect") as string) || "";

  const emailKey = normalizeEmailKey(emailRaw);
  const passwordKey = normalizePasswordInput(password);
  const devUser = emailKey ? DEV_USERS[emailKey] : undefined;

  if (!emailKey) {
    return { error: "Introduce un email válido." };
  }
  if (!devUser) {
    return {
      error:
        "Email no reconocido. Cuentas demo: admin@propcrm.com, vendedor@propcrm.com o cliente@propcrm.com.",
    };
  }
  if (devUser.password !== passwordKey) {
    return { error: "Contraseña incorrecta." };
  }

  let vendedorId: string | undefined;
  if (devUser.role === "vendedor") {
    try {
      const sb = await createServiceClient();
      const { data } = await sb
        .from("vendedores")
        .select("id")
        .eq("email", emailKey)
        .maybeSingle();
      vendedorId = data?.id ?? undefined;
    } catch { /* BD no disponible — continuamos sin vendedorId */ }
  }

  const cookieStore = await cookies();
  cookieStore.set(
    "dev-auth",
    JSON.stringify({ email: emailKey, role: devUser.role, nombre: devUser.nombre, ...(vendedorId ? { vendedorId } : {}) }),
    cookieBase,
  );
  const dest = redirectTo || (devUser.role === "admin" || devUser.role === "vendedor" ? "/admin" : "/portal/privado");
  redirect(dest);
}

export async function signUp(formData: FormData): Promise<{ error?: string; success?: string }> {
  const email = formData.get("email") as string;
  const nombre = (formData.get("nombre") as string) || "";
  const tel = (formData.get("tel") as string) || "";

  const initials = nombre
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const compradorId = crypto.randomUUID();

  try {
    // Create dev-auth cookie
    const cookieStore = await cookies();
    cookieStore.set("dev-auth", JSON.stringify({ email, role: "cliente", nombre }), cookieBase);

    // Create comprador record via server action
    await upsertComprador({
      id: compradorId,
      nombre,
      ini: initials || "??",
      col: "",
      tipo: "Privado",
      agente: "",
      email,
      tel,
      intereses: "",
      presupuesto: "",
      activos: "",
      actividad: "",
      estado: "Nuevo",
      estadoC: "fp-nd",
      nda: "Pendiente",
    });

    return { success: "Cuenta creada correctamente. Bienvenido a PropCRM." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al crear la cuenta" };
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("dev-auth");
  redirect("/login");
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("dev-auth")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
