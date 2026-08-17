import { createClient } from "@/lib/supabase/server";
import { isDemoEmail } from "@/lib/auth-role";
import {
  normalizeEmailKey,
  normalizePasswordInput,
} from "@/app/login/login-helpers";

function mapResetError(message: string): string {
  if (/rate limit/i.test(message)) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  return "No se pudo enviar el email de recuperación. Inténtalo más tarde.";
}

function mapUpdateError(message: string): string {
  if (/same as the old password/i.test(message)) {
    return "La nueva contraseña debe ser diferente a la anterior.";
  }
  return "No se pudo actualizar la contraseña. Inténtalo de nuevo.";
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = normalizeEmailKey(formData.get("email"));
  if (!email) {
    return { error: "Introduce un email válido." };
  }
  if (isDemoEmail(email)) {
    return { error: "Las cuentas demo no pueden restablecer su contraseña." };
  }

  try {
    const supabase = await createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_ORIGIN || "";
    const redirectTo = appUrl ? `${appUrl}/login/reset` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      console.warn("[requestPasswordReset] Supabase error:", error.message);
      return { error: mapResetError(error.message) };
    }
    return { success: true };
  } catch (e) {
    console.error("[requestPasswordReset] Exception:", e);
    return { error: "Error de conexión. Inténtalo más tarde." };
  }
}

export async function updatePassword(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const password = normalizePasswordInput(formData.get("password"));
  const confirmPassword = normalizePasswordInput(
    formData.get("confirmPassword"),
  );

  if (!password || password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.warn("[updatePassword] Supabase error:", error.message);
      return { error: mapUpdateError(error.message) };
    }
    return { success: true };
  } catch (e) {
    console.error("[updatePassword] Exception:", e);
    return { error: "Error de conexión. Inténtalo más tarde." };
  }
}
