import { cookies } from "next/headers";

export const cookieBase = {
  path: "/" as const,
  httpOnly: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24,
  secure: Boolean(process.env.VERCEL),
};

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("dev-auth");
  for (const c of cookieStore.getAll()) {
    if (/^sb-.*-auth-token(\.\d+)?$/.test(c.name)) {
      cookieStore.delete(c.name);
    }
  }
}

export async function clearDevAuthOnly() {
  const cookieStore = await cookies();
  cookieStore.delete("dev-auth");
}
