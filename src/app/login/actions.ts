"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthEnabled } from "@/lib/auth-role";
import { clearAuthCookies, clearDevAuthOnly } from "@/app/login/auth-cookies";
import { DEV_USERS } from "@/app/login/dev-users";
import { signInDevUser } from "@/app/login/dev-sign-in";
import { trySupabaseSignIn } from "@/app/login/supabase-sign-in";
import { signUp as signUpAction } from "@/app/login/sign-up";
import {
  requestPasswordReset as requestPasswordResetAction,
  updatePassword as updatePasswordAction,
} from "@/app/login/password-actions";
import {
  normalizeEmailKey,
  normalizePasswordInput,
  destinationForRole,
  withWelcome,
} from "@/app/login/login-helpers";

export async function signUp(formData: FormData): Promise<{ error?: string }> {
  return signUpAction(formData);
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  return requestPasswordResetAction(formData);
}

export async function updatePassword(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  return updatePasswordAction(formData);
}

export async function signIn(formData: FormData) {
  const emailRaw = formData.get("email");
  const password = formData.get("password");
  const redirectTo = (formData.get("redirect") as string) || "";

  const emailKey = normalizeEmailKey(emailRaw);
  const passwordKey = normalizePasswordInput(password);

  if (!emailKey) {
    return { error: "Introduce un email válido." };
  }
  if (!passwordKey) {
    return { error: "Introduce tu contraseña." };
  }

  if (isDevAuthEnabled() && DEV_USERS[emailKey]) {
    const devResult = await signInDevUser(emailKey, passwordKey);
    if (devResult.error) return devResult;
    redirect(
      withWelcome(destinationForRole(DEV_USERS[emailKey].role, redirectTo)),
    );
  }

  const result = await trySupabaseSignIn(emailKey, passwordKey);
  if (result.error) return result.error;

  await clearDevAuthOnly();
  redirect(withWelcome(destinationForRole(result.role, redirectTo)));
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* sin Supabase: ignoramos */
  }
  await clearAuthCookies();
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
