import { cookies } from "next/headers";
import { ensureCompradorForEmail } from "@/app/actions/compradores";
import { ensureVendedorForDemoEmail } from "@/app/actions/ensure-vendedor-demo";
import { cookieBase, clearAuthCookies } from "@/app/login/auth-cookies";
import { DEV_USERS } from "@/app/login/dev-users";

export async function signInDevUser(
  emailKey: string,
  passwordKey: string,
): Promise<{ error?: string }> {
  const devUser = DEV_USERS[emailKey];
  if (!devUser) return { error: "Cuenta demo no encontrada." };
  if (devUser.password !== passwordKey) {
    return { error: "Contraseña incorrecta." };
  }

  let vendedorId: string | undefined;
  let compradorId: string | undefined;
  if (devUser.role === "vendedor") {
    try {
      vendedorId = await ensureVendedorForDemoEmail(emailKey, devUser.nombre);
    } catch {
      /* BD no disponible — continuamos sin vendedorId */
    }
  } else if (devUser.role === "cliente") {
    try {
      compradorId = await ensureCompradorForEmail(emailKey, devUser.nombre);
    } catch {
      /* BD no disponible — continuamos sin compradorId */
    }
  }

  await clearAuthCookies();
  const cookieStore = await cookies();
  cookieStore.set(
    "dev-auth",
    JSON.stringify({
      email: emailKey,
      role: devUser.role,
      nombre: devUser.nombre,
      ...(vendedorId ? { vendedorId } : {}),
      ...(compradorId ? { compradorId } : {}),
    }),
    cookieBase,
  );

  return {};
}
