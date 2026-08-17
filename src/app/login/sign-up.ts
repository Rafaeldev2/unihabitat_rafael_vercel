import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { upsertComprador } from "@/app/actions/compradores";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isDevAuthEnabled, isDemoEmail } from "@/lib/auth-role";
import {
  cookieBase,
  clearAuthCookies,
  clearDevAuthOnly,
} from "@/app/login/auth-cookies";
import { DEV_USERS } from "@/app/login/dev-users";
import {
  normalizeEmailKey,
  normalizePasswordInput,
  withWelcome,
} from "@/app/login/login-helpers";

export async function signUp(
  formData: FormData,
): Promise<{ error?: string }> {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const nombre = ((formData.get("nombre") as string) || "").trim();
  const tel = (formData.get("tel") as string) || "";
  const redirectTo = (formData.get("redirect") as string) || "";

  const email = normalizeEmailKey(emailRaw);
  const password = normalizePasswordInput(passwordRaw);

  if (!email) return { error: "Introduce un email válido." };
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (!nombre) return { error: "Introduce tu nombre." };
  if (isDevAuthEnabled() && DEV_USERS[email]) {
    return { error: "Este email está reservado para una cuenta demo." };
  }
  if (isDemoEmail(email)) {
    return { error: "No se puede registrar con un email @propcrm.com" };
  }

  const initials = nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  let authUserId: string | null = null;
  let hasSupabaseSession = false;
  let supabaseError: string | null = null;

  try {
    const admin = await createServiceClient();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "cliente", nombre, tel },
    });
    if (createErr) {
      supabaseError = createErr.message;
    } else {
      authUserId = created.user?.id ?? null;
    }
  } catch (e) {
    supabaseError = e instanceof Error ? e.message : "Error de conexión";
    console.warn("[signUp] admin.createUser lanzó excepción:", supabaseError);
  }

  if (supabaseError && !authUserId) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "cliente", nombre, tel } },
      });
      if (error) {
        supabaseError = error.message;
      } else {
        supabaseError = null;
        authUserId = data.user?.id ?? null;
        hasSupabaseSession = Boolean(data.session);
      }
    } catch (e) {
      supabaseError = e instanceof Error ? e.message : "Error de conexión";
      console.warn("[signUp] auth.signUp fallback falló:", supabaseError);
    }
  }

  if (supabaseError && !authUserId) {
    if (
      /already (registered|exists)/i.test(supabaseError) ||
      /User already/i.test(supabaseError)
    ) {
      return { error: "Ya existe una cuenta con ese email. Prueba a iniciar sesión." };
    }
    if (/password.*(weak|short|6)/i.test(supabaseError)) {
      return { error: "La contraseña no cumple los requisitos mínimos de seguridad." };
    }
    if (/rate limit/i.test(supabaseError)) {
      return {
        error:
          "Demasiados intentos de registro. Espera unos minutos e inténtalo de nuevo.",
      };
    }
    console.warn("[signUp] Supabase falló — usando fallback dev-auth:", supabaseError);
  }

  if (authUserId && !hasSupabaseSession) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error && data.session) {
        hasSupabaseSession = true;
      } else if (error) {
        console.warn("[signUp] auto-login post-createUser falló:", error.message);
      }
    } catch (e) {
      console.warn(
        "[signUp] auto-login post-createUser excepción:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  const compradorId = authUserId || crypto.randomUUID();

  try {
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
      acceso: "sin_acceso",
    });
  } catch (e) {
    console.warn(
      "[signUp] upsertComprador falló, continuamos solo con la sesión:",
      e instanceof Error ? e.message : e,
    );
  }

  if (!hasSupabaseSession) {
    await clearAuthCookies();
    const cookieStore = await cookies();
    cookieStore.set(
      "dev-auth",
      JSON.stringify({ email, role: "cliente", nombre, compradorId }),
      cookieBase,
    );
  } else {
    await clearDevAuthOnly();
  }

  redirect(withWelcome(redirectTo || "/portal/privado"));
}
