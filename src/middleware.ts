import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type SessionInfo = {
  role: "admin" | "vendedor" | "cliente";
  email?: string;
} | null;

const VALID_ROLES = new Set(["admin", "vendedor"]);
const CORP_DOMAIN = "@unihabitat.net";

function isDevAuthEnabled(): boolean {
  if (process.env.ALLOW_DEV_AUTH === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function resolveRoleMiddleware(metadataRole: string | undefined | null, email: string | undefined | null): "admin" | "vendedor" | "cliente" {
  const roleStr = metadataRole?.toLowerCase()?.trim();
  if (roleStr && VALID_ROLES.has(roleStr)) {
    return roleStr as "admin" | "vendedor";
  }
  const emailLower = email?.toLowerCase()?.trim() ?? "";
  if (emailLower.endsWith(CORP_DOMAIN)) {
    return "admin";
  }
  return "cliente";
}

/** Lee el dev-auth cookie usado para los usuarios demo en local. */
function getDevUser(request: NextRequest): SessionInfo {
  if (!isDevAuthEnabled()) return null;
  const raw = request.cookies.get("dev-auth")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.role === "string") {
      return { role: parsed.role, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resuelve la sesión usando Supabase si hay cookies sb-*-auth-token.
 * Devuelve role y email del usuario, o null si no hay sesión válida.
 *
 * IMPORTANTE: si Supabase necesita refrescar el access_token durante getUser(),
 * las cookies actualizadas se devuelven en `outResponse` para que las copiemos
 * en cualquier NextResponse.redirect que generemos. Sin esta copia, el siguiente
 * hop pierde la sesión y rebota al login.
 */
async function getSupabaseUser(
  request: NextRequest,
): Promise<{ user: SessionInfo; outResponse: NextResponse }> {
  let outResponse = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { user: null, outResponse };
  }

  // Atajo: si no hay ninguna cookie sb-*-auth-token, evitamos el round-trip a Supabase.
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  if (!hasSupabaseCookie) {
    return { user: null, outResponse };
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        outResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          outResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, outResponse };
    const metadataRole = user.user_metadata?.role as string | undefined;
    const role = resolveRoleMiddleware(metadataRole, user.email);
    return { user: { role, email: user.email ?? undefined }, outResponse };
  } catch {
    return { user: null, outResponse };
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1) dev-auth (usuarios demo) tiene prioridad si existe.
  const devUser = getDevUser(request);

  // 2) Si no hay dev-auth, intentamos resolver con Supabase.
  const supabaseLookup = devUser
    ? null
    : await getSupabaseUser(request);
  const session: SessionInfo = devUser ?? supabaseLookup?.user ?? null;
  const baseResponse = supabaseLookup?.outResponse ?? NextResponse.next();

  /** Crea un redirect preservando cualquier cookie refrescada por Supabase. */
  const redirectWithCookies = (
    target: string,
    redirectParam?: string,
  ) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    if (redirectParam) {
      url.searchParams.set("redirect", redirectParam);
    } else {
      url.searchParams.delete("redirect");
    }
    const res = NextResponse.redirect(url);
    if (supabaseLookup?.outResponse) {
      for (const c of supabaseLookup.outResponse.cookies.getAll()) {
        res.cookies.set(c);
      }
    }
    return res;
  };

  // Admin: requiere admin o vendedor
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return redirectWithCookies("/login", pathname);
    }
    if (session.role !== "admin" && session.role !== "vendedor") {
      return redirectWithCookies("/portal/privado");
    }
    if (
      session.role === "vendedor" &&
      pathname.startsWith("/admin/config")
    ) {
      return redirectWithCookies("/admin");
    }
  }

  // Portal privado: requiere cualquier sesión
  if (pathname.startsWith("/portal/privado") && !session) {
    return redirectWithCookies("/login", pathname);
  }

  // Login: si ya hay sesión, manda al área correspondiente
  if (pathname === "/login" && session) {
    return redirectWithCookies(
      session.role === "admin" || session.role === "vendedor"
        ? "/admin"
        : "/portal/privado",
    );
  }

  return baseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/privado/:path*", "/login"],
};
