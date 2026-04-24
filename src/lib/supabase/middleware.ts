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

  // Admin routes: require authenticated admin user
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/privado";
      return NextResponse.redirect(url);
    }
  }

  // Portal privado requires authentication
  if (pathname.startsWith("/portal/privado") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Login page: redirect authenticated users to their zone
  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin" : "/portal/privado";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
