import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Dev-auth helper: reads the hardcoded dev cookie ──
function getDevUser(request: NextRequest): { email: string; role: string; nombre: string } | null {
  const raw = request.cookies.get("dev-auth")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // ── Check dev-auth cookie first ──
  const devUser = getDevUser(request);
  if (devUser) {
    // Login page: redirect dev-authenticated users to their zone
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = devUser.role === "admin" ? "/admin" : "/portal/privado";
      return NextResponse.redirect(url);
    }
    // Admin routes: only allow admin role
    if (pathname.startsWith("/admin") && devUser.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/privado";
      return NextResponse.redirect(url);
    }
    // Dev user authenticated — allow through
    return supabaseResponse;
  }

  // ── Supabase auth (production path) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role ?? "cliente";

  // Crea un redirect preservando las cookies que el cliente Supabase haya
  // refrescado durante getUser() (p. ej. nuevo access_token tras refresh).
  // Sin esto, una redirección dentro del middleware borraba la sesión recién
  // emitida y el usuario rebotaba al /login en el siguiente hop.
  const redirectWithCookies = (pathnameTarget: string, addRedirectParam?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathnameTarget;
    if (addRedirectParam) {
      url.searchParams.set("redirect", addRedirectParam);
    } else {
      url.searchParams.delete("redirect");
    }
    const res = NextResponse.redirect(url);
    for (const c of supabaseResponse.cookies.getAll()) {
      res.cookies.set(c);
    }
    return res;
  };

  // Admin routes: require authenticated admin user
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return redirectWithCookies("/login", pathname);
    }
    if (role !== "admin") {
      return redirectWithCookies("/portal/privado");
    }
  }

  // Portal privado requires authentication
  if (pathname.startsWith("/portal/privado") && !user) {
    return redirectWithCookies("/login", pathname);
  }

  // Login page: redirect authenticated users to their zone
  if (pathname === "/login" && user) {
    return redirectWithCookies(role === "admin" ? "/admin" : "/portal/privado");
  }

  return supabaseResponse;
}
