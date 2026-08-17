import { ensureCompradorForEmail } from "@/app/actions/compradores";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/auth-role";

async function tryAutoConfirmEmail(email: string): Promise<boolean> {
  try {
    const admin = await createServiceClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error || !data?.users) return false;

    const user = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!user) return false;
    if (user.email_confirmed_at) return true;

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updErr) {
      console.warn("[tryAutoConfirmEmail] updateUserById falló:", updErr.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(
      "[tryAutoConfirmEmail] excepción:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

async function attemptPasswordSignIn(email: string, password: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    console.error("[signIn] signInWithPassword falló:", msg);
    return { data: null, error: msg };
  }
}

function signInErrorPayload(supabaseError: string | null): { error: string } {
  if (supabaseError && /fetch failed/i.test(supabaseError)) {
    return {
      error:
        "No se pudo contactar al servidor de autenticación. Revisa tu conexión.",
    };
  }
  if (supabaseError && /rate limit/i.test(supabaseError)) {
    return {
      error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    };
  }
  return { error: "Email o contraseña incorrectos." };
}

export async function trySupabaseSignIn(
  email: string,
  password: string,
): Promise<{ role?: string; error?: { error: string } }> {
  let attempt = await attemptPasswordSignIn(email, password);

  if (
    !attempt.data &&
    attempt.error &&
    (/email not confirmed/i.test(attempt.error) ||
      /invalid login credentials/i.test(attempt.error))
  ) {
    const confirmed = await tryAutoConfirmEmail(email);
    if (confirmed) {
      attempt = await attemptPasswordSignIn(email, password);
    }
  }

  if (!attempt.data) {
    return { error: signInErrorPayload(attempt.error) };
  }

  const data = attempt.data;
  const metadataRole = data.user?.user_metadata?.role as string | undefined;
  const role = resolveRole(metadataRole, data.user?.email);

  if (role === "cliente" && data.user?.email) {
    try {
      const nombreFromMeta =
        (data.user.user_metadata?.nombre as string | undefined) ||
        data.user.email;
      await ensureCompradorForEmail(data.user.email, nombreFromMeta);
    } catch {
      /* No bloqueante */
    }
  }

  return { role };
}
